// scripts/verifyUpgradeCouponCommitFix.js
//
// Fixture-based verification for the P0 bug found during live QA: the
// upgrade webhook commit (handlePaymentCaptured's pendingPlanChange branch)
// recomputed the new recurring totalAmount WITHOUT the coupon modifier —
// even though the PREVIEW step (updateSubscription) correctly included it.
// This meant ANY coupon (not just first_payment — including lifetime/
// until_cancelled, which should keep discounting every renewal) silently
// lost its discount the instant an upgrade committed, while appliedCoupon
// itself stayed on the document unchanged, so the UI kept showing "Coupon
// Applied" against an undiscounted total.
//
// Drives the REAL exports.updateSubscription AND exports.handleWebhook (a
// correctly-signed payment.captured event) end to end — not a copy of
// either's logic.
//
// WRITES disposable documents and deletes them after — do NOT point this at
// a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyUpgradeCouponCommitFix.js

const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const Coupon = require('../models/Coupon');
const CommercialTransaction = require('../models/CommercialTransaction');

const razorpayClient = require('../config/razorpay');
razorpayClient.orders.create = async (params) => ({ id: `order_fixture_${Date.now()}`, amount: params.amount });

const couponController = require('../controllers/couponController');
const { updateSubscription, handleWebhook } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}
if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
  console.error('❌ RAZORPAY_WEBHOOK_SECRET not set — required to sign the fixture webhook.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], Coupon: [], CommercialTransaction: [] };
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
  await CommercialTransaction.deleteMany({ _id: { $in: registry.CommercialTransaction } });
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

function mockReqRes(user, body) {
  let statusCode = 200;
  let jsonBody = null;
  const res = { status(code) { statusCode = code; return this; }, json(body) { jsonBody = body; return this; } };
  return { req: { user, body }, res, getResult: () => ({ statusCode, jsonBody }) };
}

async function createRealCoupon(registry, rules) {
  const { req, res, getResult } = mockReqRes(null, {
    code: `UPGCOMMIT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Upgrade Commit Fixture Coupon', scope: { type: 'global' }, rules, duration: { type: 'lifetime' },
  });
  req.superAdmin = { _id: new mongoose.Types.ObjectId() };
  await couponController.createCoupon(req, res);
  const { statusCode, jsonBody } = getResult();
  assert.equal(statusCode, 201, `Expected 201 creating coupon, got ${statusCode}: ${JSON.stringify(jsonBody)}`);
  registry.Coupon.push(jsonBody.coupon._id);
  return jsonBody.coupon;
}

async function makeOrgAndUser(registry, label) {
  const org = await trackedCreate(Organization, 'Organization', registry, { name: `${label} Org`, code: `${label.toLowerCase()}-${Date.now()}` });
  const user = await trackedCreate(User, 'User', registry, {
    name: `${label} User`, email: `${label.toLowerCase()}-${Date.now()}@example.test`,
    phone: `9${String(Date.now()).slice(-9)}`, organization: org._id, role: 'admin', auth0Id: `${label.toLowerCase()}-${Date.now()}`,
  });
  return { org, user };
}

function buildSignedPaymentCapturedCall(paymentEntity, eventId) {
  const body = { event: 'payment.captured', payload: { payment: { entity: paymentEntity } } };
  const rawBody = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  const req = { headers: { 'x-razorpay-signature': signature, 'x-razorpay-event-id': eventId }, rawBody, body };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(o) { this.body = o; return this; } };
  return { req, res };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('Upgrade commit-time coupon fix — the P0 bug found via live QA\n');

  const starterPlan = await PlanConfig.findOne({ planId: 'starter', isActive: true });
  const growthPlan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
  assert.ok(starterPlan && growthPlan);

  await test('upgrade commit: subscription.totalAmount reflects the coupon discount, matching what the preview quoted', async (registry) => {
    const coupon = await createRealCoupon(registry, [
      { productType: 'plan', productKey: 'starter', discountType: 'percentage', discountValue: 2 },
      { productType: 'plan', productKey: 'growth', discountType: 'percentage', discountValue: 2 },
    ]);
    const { org, user } = await makeOrgAndUser(registry, 'UpgradeCommitFix');
    await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'starter', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: starterPlan.monthlyPrice, userCount: 1,
      totalAmount: Math.round(starterPlan.monthlyPrice * 0.98),
      isPaymentConfirmed: true, paymentStatus: 'payment_completed', activeAddons: [],
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      appliedCoupon: {
        code: coupon.code, name: coupon.name, duration: { type: 'lifetime' },
        discountAmount: Math.round(starterPlan.monthlyPrice * 0.02),
        baseSubtotal: starterPlan.monthlyPrice, recurringSubtotal: Math.round(starterPlan.monthlyPrice * 0.98),
        fullRulesSnapshot: coupon.rules,
      },
    });

    // --- Preview step (the real, already-correct half) ---
    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id }, { planId: 'growth', billingCycle: 'monthly', addons: [] });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected upgrade preview to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);
    assert.ok(jsonBody.pricingBreakdown.couponDiscount, 'preview must show the coupon discount (this half already worked before the fix)');

    const subscriptionAfterPreview = await Subscription.findOne({ organization: org._id });
    registry.Subscription.push(subscriptionAfterPreview._id);
    const orderId = subscriptionAfterPreview.pendingPlanChange.orderId;
    const expectedChargeAmount = jsonBody.paymentDetails.amount;

    // --- Commit step (the actually-broken half, now fixed) ---
    const { req: whReq, res: whRes } = buildSignedPaymentCapturedCall(
      { id: `pay_fixture_${Date.now()}`, order_id: orderId, invoice_id: null, amount: expectedChargeAmount, status: 'captured' },
      `evt_fixture_upgcommit_${Date.now()}`
    );
    await handleWebhook(whReq, whRes);
    assert.equal(whRes.statusCode, 200, `Expected the webhook to be accepted, got ${whRes.statusCode}`);

    const committed = await Subscription.findById(subscriptionAfterPreview._id);
    assert.equal(committed.planName, 'growth', 'Expected the plan to have actually upgraded');

    // The math the live QA session did by hand: growth (450) with a 2% coupon
    // discount = 450 - 9 = 441 pre-GST. Before this fix, totalAmount would
    // have been the full undiscounted 450.
    const expectedDiscountedTotal = Math.round(growthPlan.monthlyPrice * 0.98);
    assert.equal(committed.totalAmount, expectedDiscountedTotal, `Expected the committed recurring total to reflect the coupon (₹${expectedDiscountedTotal}), not the undiscounted plan price (₹${growthPlan.monthlyPrice}) — this is the exact bug found live`);
    assert.ok(committed.appliedCoupon?.code, 'appliedCoupon must still be present — the bug was never that this disappeared, it was that totalAmount silently stopped reflecting it');

    // Regression (found via live QA, second pass — the "stale coupon
    // snapshot" bug): appliedCoupon.baseSubtotal/discountAmount/recurringSubtotal
    // must ALSO refresh to the new (Growth) tier's own figures, not stay
    // frozen at Starter's — this is exactly the field PlanCard.jsx's
    // "current plan" snapshot display reads, and a stale value here is what
    // made an upgraded org's plan card show an entirely different, earlier
    // plan's price.
    const expectedDiscountAmount = growthPlan.monthlyPrice - expectedDiscountedTotal;
    assert.equal(committed.appliedCoupon.baseSubtotal, growthPlan.monthlyPrice, `appliedCoupon.baseSubtotal must reflect the NEW plan's price (₹${growthPlan.monthlyPrice}), not the old Starter figure`);
    assert.equal(committed.appliedCoupon.discountAmount, expectedDiscountAmount, `appliedCoupon.discountAmount must reflect the discount actually applied on Growth (₹${expectedDiscountAmount}), not the frozen Starter-era amount`);
    assert.equal(committed.appliedCoupon.recurringSubtotal, expectedDiscountedTotal, `appliedCoupon.recurringSubtotal must match the new committed totalAmount exactly — these two fields must never disagree`);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
