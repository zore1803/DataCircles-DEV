// scripts/verifyRecurringBaselineCorrectness.js
//
// Fixture-based verification for "recurring price corruption" (Bug 1, found
// via live QA): createSubscription and trial-conversion both wrote
// `invoice.taxable`/`snapshot.taxable` — which includes ONE-TIME modifiers
// (a first_payment coupon, the referee's first-invoice referral discount) —
// directly into Subscription.totalAmount, the field every other surface
// (Manage Subscription, Billing dashboard, PlanCard) reads as THE ongoing
// recurring price. Fixed by computing a separate "recurring baseline"
// (durable modifiers only) and storing that instead.
//
// This fixture drives the REAL exports.createSubscription handler (not a
// copy of its logic) and additionally cross-checks the stored baseline
// against what renewSubscription() would independently compute for the same
// plan/add-ons with no coupon (the durable-modifier-free case) — per the
// explicit instruction that these must be proven to agree, not just each
// individually "look right."
//
// createSubscription makes a real (test-mode) Razorpay createRegistrationLink
// API call — same as verifyTrialConversionCAW.js's own documented behavior.
//
// WRITES disposable Organization/User/Subscription/Coupon documents and
// deletes them after each fixture — do NOT point this at a production
// database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyRecurringBaselineCorrectness.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const Coupon = require('../models/Coupon');
const BillingInvoice = require('../models/BillingInvoice');
const CommercialTransaction = require('../models/CommercialTransaction');
const BillingCycle = require('../models/BillingCycle');
const { calculateInvoice } = require('../utils/invoiceEngine');
const { renewSubscription } = require('../utils/renewalEngine');
const { createSubscription } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], Coupon: [], BillingInvoice: [], CommercialTransaction: [], BillingCycle: [] };
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
  await CommercialTransaction.deleteMany({ _id: { $in: registry.CommercialTransaction } });
  await BillingInvoice.deleteMany({ _id: { $in: registry.BillingInvoice } });
  await Subscription.deleteMany({ _id: { $in: registry.Subscription } });
  await User.deleteMany({ _id: { $in: registry.User } });
  await Organization.deleteMany({ _id: { $in: registry.Organization } });
  await Coupon.deleteMany({ _id: { $in: registry.Coupon } });
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

async function makeOrgAndUser(registry, label) {
  const org = await trackedCreate(Organization, 'Organization', registry, { name: `${label} Org`, code: `${label.toLowerCase()}-${Date.now()}` });
  const user = await trackedCreate(User, 'User', registry, {
    name: `${label} User`, email: `${label.toLowerCase()}-${Date.now()}@example.test`,
    phone: `9${String(Date.now()).slice(-9)}`, organization: org._id, role: 'admin', auth0Id: `${label.toLowerCase()}-${Date.now()}`,
  });
  return { org, user };
}

const okCharge = async () => ({ success: true, paymentId: 'pay_test_baseline', orderId: 'order_test_baseline' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('Bug 1 — recurring baseline must exclude one-time modifiers, and must agree with renewSubscription()\n');

  const starterPlan = await PlanConfig.findOne({ planId: 'starter', isActive: true });
  assert.ok(starterPlan, 'Expected an active "starter" PlanConfig to already exist in this DB');

  await test('signup with a first_payment coupon — stored totalAmount excludes the discount, matches an independent no-coupon renewal computation', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'BaselineFP');
    const coupon = await trackedCreate(Coupon, 'Coupon', registry, {
      code: `BASELINE-FP-${Date.now()}`,
      name: 'Baseline first_payment fixture',
      isActive: true,
      scope: { type: 'global' },
      rules: [{ productType: 'plan', productKey: 'starter', discountType: 'fixed', discountValue: 20 }],
      duration: { type: 'first_payment' },
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id, phone: user.phone, email: user.email }, {
      planId: 'starter', billingCycle: 'monthly', addons: [], couponCode: coupon.code,
    });
    await createSubscription(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected signup to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);

    const subscription = await Subscription.findById(jsonBody.subscription._id);
    registry.Subscription.push(subscription._id);

    // The bug: totalAmount would be starterPlan.monthlyPrice - 20 (the
    // discounted first-invoice figure). Fixed: must be the full plan price.
    assert.equal(subscription.totalAmount, starterPlan.monthlyPrice, `A first_payment coupon must NOT reduce the stored recurring baseline — got ${subscription.totalAmount}, expected ${starterPlan.monthlyPrice}`);

    // Cross-check: what would an independent renewal (no scheduled changes,
    // coupon correctly excluded per R7) actually charge for this same plan?
    // These two numbers must agree exactly — proving signup's new baseline
    // isn't merely "different from the old wrong number" but the SAME
    // figure the renewal engine will independently compute weeks from now.
    subscription.isPaymentConfirmed = true;
    subscription.currentPeriodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    subscription.currentPeriodEnd = new Date();
    subscription.nextBillingDate = subscription.currentPeriodEnd;
    subscription.mandateTokenId = 'token_test_baseline_fp';
    await subscription.save();

    const renewalResult = await renewSubscription(subscription, { chargeMandateFn: okCharge });
    assert.equal(renewalResult.outcome, 'RENEWED');
    const invoice = await BillingInvoice.findById(renewalResult.invoice);
    registry.BillingInvoice.push(invoice._id);
    registry.BillingCycle.push(renewalResult.billingCycle);
    const ct = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'RENEWAL' });
    registry.CommercialTransaction.push(ct._id);

    assert.equal(invoice.taxable, subscription.totalAmount, `Signup's stored recurring baseline (₹${subscription.totalAmount}) must exactly match what the real renewal engine independently charges (₹${invoice.taxable}) — a mismatch would mean two disagreeing formulas, not just one fixed bug`);
  });

  await test('signup with a lifetime coupon — recurring baseline correctly INCLUDES the discount (must not regress the working case)', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'BaselineLifetime');
    const coupon = await trackedCreate(Coupon, 'Coupon', registry, {
      code: `BASELINE-LIFETIME-${Date.now()}`,
      name: 'Baseline lifetime fixture',
      isActive: true,
      scope: { type: 'global' },
      rules: [{ productType: 'plan', productKey: 'starter', discountType: 'fixed', discountValue: 20 }],
      duration: { type: 'lifetime' },
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id, phone: user.phone, email: user.email }, {
      planId: 'starter', billingCycle: 'monthly', addons: [], couponCode: coupon.code,
    });
    await createSubscription(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected signup to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);

    const subscription = await Subscription.findById(jsonBody.subscription._id);
    registry.Subscription.push(subscription._id);

    assert.equal(subscription.totalAmount, starterPlan.monthlyPrice - 20, `A lifetime coupon must STILL reduce the stored recurring baseline — got ${subscription.totalAmount}, expected ${starterPlan.monthlyPrice - 20}`);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
