// scripts/verifyFirstPaymentCouponEnabled.js
//
// Fixture-based verification for enabling 'first_payment' as a creatable
// coupon duration (couponController.js's ENFORCEABLE_DURATIONS). Unlike R7's
// fixture, this one exercises the REAL creation path end to end — this is
// the one duration type that just became genuinely creatable, so it must be
// proven through real code, not a fixture-constructed document:
//   1. Create a real coupon via the real createCoupon() controller.
//   2. Apply it to a real signup via the real createSubscription() controller
//      (constructing the mock req/res, same pattern as verifyTrialConversionCAW.js),
//      confirming the first invoice is correctly discounted and the
//      appliedCoupon snapshot correctly stores duration.type: 'first_payment'.
//   3. Feed that real subscription into the real renewSubscription() engine,
//      confirming R7's existing eligibility gate (unchanged by this brief)
//      correctly excludes it — proving the gate against a REAL creation path,
//      not just R7's own fixture-constructed document.
//
// WRITES disposable documents and deletes them after — do NOT point this at
// a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyFirstPaymentCouponEnabled.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');
const CommercialTransaction = require('../models/CommercialTransaction');
const BillingInvoice = require('../models/BillingInvoice');
const BillingCycle = require('../models/BillingCycle');

const razorpayClient = require('../config/razorpay');
razorpayClient.orders.create = async () => ({ id: `order_fixture_stub_${Date.now()}`, amount: 0 });
razorpayClient.subscriptions = razorpayClient.subscriptions || {};
razorpayClient.subscriptions.create = async () => ({
  id: `sub_fixture_stub_${Date.now()}`,
  status: 'created',
  current_start: Math.floor(Date.now() / 1000),
  current_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  charge_at: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
});

const couponController = require('../controllers/couponController');
const { renewSubscription } = require('../utils/renewalEngine');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], Coupon: [], CouponRedemption: [], CommercialTransaction: [], BillingInvoice: [], BillingCycle: [] };
  try {
    await fn(registry);
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  } finally {
    await cleanup(registry);
  }
}

async function cleanup(registry) {
  await BillingCycle.deleteMany({ _id: { $in: registry.BillingCycle } });
  await BillingInvoice.deleteMany({ _id: { $in: registry.BillingInvoice } });
  await CommercialTransaction.deleteMany({ _id: { $in: registry.CommercialTransaction } });
  await CouponRedemption.deleteMany({ _id: { $in: registry.CouponRedemption } });
  await Coupon.deleteMany({ _id: { $in: registry.Coupon } });
  await Subscription.deleteMany({ _id: { $in: registry.Subscription } });
  await User.deleteMany({ _id: { $in: registry.User } });
  await Organization.deleteMany({ _id: { $in: registry.Organization } });
}

async function trackedCreate(Model, key, registry, doc) {
  const created = await Model.create(doc);
  registry[key].push(created._id);
  return created;
}

function mockReqRes(user, body, extra = {}) {
  let statusCode = 200;
  let jsonBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { jsonBody = body; return this; },
  };
  const req = { user, body, ...extra };
  return { req, res, getResult: () => ({ statusCode, jsonBody }) };
}

const okCharge = async () => ({ success: true, paymentId: 'pay_test_fp', orderId: 'order_test_fp' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('first_payment coupon — real creation path, real signup, real renewal exclusion\n');

  await test('a real first_payment coupon created via createCoupon() discounts a real signup and is correctly excluded at renewal', async (registry) => {
    const plan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
    assert.ok(plan, 'Expected an active "growth" PlanConfig to already exist in this DB');

    // --- 1. Create the coupon via the REAL controller ---
    const superAdminId = new mongoose.Types.ObjectId();
    const { req: createReq, res: createRes, getResult: getCreateResult } = mockReqRes(
      null,
      {
        code: `FP-FIXTURE-${Date.now()}`,
        name: 'First Payment Fixture Coupon',
        scope: { type: 'global' },
        rules: [{ productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 60 }],
        duration: { type: 'first_payment' },
      },
      { superAdmin: { _id: superAdminId } }
    );
    await couponController.createCoupon(createReq, createRes);
    const { statusCode: createStatus, jsonBody: createBody } = getCreateResult();
    assert.equal(createStatus, 201, `Expected 201 creating the coupon, got ${createStatus}: ${JSON.stringify(createBody)}`);
    registry.Coupon.push(createBody.coupon._id);
    assert.equal(createBody.coupon.duration.type, 'first_payment', 'Coupon must persist duration.type: first_payment');

    // --- 2. Apply it to a REAL signup via createSubscription() ---
    const org = await trackedCreate(Organization, 'Organization', registry, { name: 'FP Signup Fixture Org', code: `fp-signup-${Date.now()}` });
    const user = await trackedCreate(User, 'User', registry, {
      name: 'FP Fixture User',
      email: `fp-fixture-${Date.now()}@example.test`,
      phone: `9${String(Date.now()).slice(-9)}`,
      organization: org._id,
      role: 'admin',
      auth0Id: `fp-fixture-${Date.now()}`,
    });

    const { createSubscription } = require('../controllers/subscriptionController');
    const { req: signupReq, res: signupRes, getResult: getSignupResult } = mockReqRes(
      { organization: org._id, _id: user._id, name: user.name, email: user.email, phone: user.phone },
      { planId: 'growth', billingCycle: 'monthly', addons: [], couponCode: createBody.coupon.code }
    );
    await createSubscription(signupReq, signupRes);
    const { statusCode: signupStatus, jsonBody: signupBody } = getSignupResult();
    assert.ok(signupStatus < 400, `Expected signup to succeed, got ${signupStatus}: ${JSON.stringify(signupBody)}`);

    const subscription = await Subscription.findOne({ organization: org._id });
    assert.ok(subscription, 'Expected a Subscription to have been created for this signup');
    registry.Subscription.push(subscription._id);

    assert.ok(subscription.appliedCoupon, 'Expected appliedCoupon to be set on the subscription');
    assert.equal(subscription.appliedCoupon.duration.type, 'first_payment', 'appliedCoupon snapshot must correctly record duration.type: first_payment');
    assert.equal(subscription.appliedCoupon.discountAmount, 60, 'appliedCoupon must record the correct discount amount');
    assert.equal(subscription.totalAmount, plan.monthlyPrice - 60, 'First invoice must reflect the discount (same math as lifetime would)');

    // --- 3. Feed this REAL subscription into the REAL renewal engine ---
    // Make it due for renewal and give it a mandate (renewSubscription()'s
    // own precondition), same fixture pattern as R7/R8's own scripts.
    subscription.mandateTokenId = 'token_test_fp_renewal';
    subscription.currentPeriodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    subscription.currentPeriodEnd = new Date();
    subscription.nextBillingDate = new Date();
    subscription.appStatus = 'active';
    await subscription.save();

    const result = await renewSubscription(subscription, { chargeMandateFn: okCharge });
    assert.equal(result.outcome, 'RENEWED', `Expected RENEWED, got ${JSON.stringify(result)}`);

    const invoice = await BillingInvoice.findById(result.invoice);
    registry.BillingInvoice.push(invoice._id);
    const commercialTransaction = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'RENEWAL' });
    registry.CommercialTransaction.push(commercialTransaction._id);
    const billingCycle = await BillingCycle.findOne({ subscription: subscription._id });
    if (billingCycle) registry.BillingCycle.push(billingCycle._id);

    assert.equal(invoice.discount, 0, 'R7\'s eligibility gate must exclude this first_payment coupon at renewal — discount must be 0');
    assert.equal(invoice.taxable, plan.monthlyPrice, 'Renewal must price at full rate — the first_payment discount must never repeat');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
