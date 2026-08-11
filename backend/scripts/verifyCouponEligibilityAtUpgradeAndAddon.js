// scripts/verifyCouponEligibilityAtUpgradeAndAddon.js
//
// Fixture-based verification for "Coupon P0" — the architectural fix found
// via live QA: only renewal ever asked "is this coupon still eligible for a
// FUTURE commercial event." Upgrade and add-on purchase unconditionally
// rebuilt a coupon modifier from fullRulesSnapshot regardless of
// duration.type, so a first_payment coupon (correctly excluded at renewal)
// kept discounting every upgrade/add-on purchase forever. Both now reuse
// isCouponStillEligibleForRenewal directly — this proves both are gated
// correctly, and that a lifetime/until_cancelled coupon (which SHOULD keep
// discounting) still does.
//
// WRITES disposable documents and deletes them after — do NOT point this at
// a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyCouponEligibilityAtUpgradeAndAddon.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');
const CommercialTransaction = require('../models/CommercialTransaction');

const razorpayClient = require('../config/razorpay');
razorpayClient.orders.create = async (params) => ({ id: `order_fixture_${Date.now()}`, amount: params.amount });

const { updateSubscription } = require('../controllers/subscriptionController');
const { startAddonPurchase } = require('../utils/addonPurchaseLifecycle');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], CommercialTransaction: [] };
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

async function makeOrgAndUser(registry, label) {
  const org = await trackedCreate(Organization, 'Organization', registry, { name: `${label} Org`, code: `${label.toLowerCase()}-${Date.now()}` });
  const user = await trackedCreate(User, 'User', registry, {
    name: `${label} User`, email: `${label.toLowerCase()}-${Date.now()}@example.test`,
    phone: `9${String(Date.now()).slice(-9)}`, organization: org._id, role: 'admin', auth0Id: `${label.toLowerCase()}-${Date.now()}`,
  });
  return { org, user };
}

function firstPaymentCouponSnapshot(basePrice) {
  return {
    code: 'FP-ELIG-FIXTURE', name: 'First Payment Eligibility Fixture', duration: { type: 'first_payment' },
    discountAmount: 20, baseSubtotal: basePrice, recurringSubtotal: basePrice - 20, redeemed: true,
    fullRulesSnapshot: [
      { productType: 'plan', productKey: 'starter', discountType: 'fixed', discountValue: 20 },
      { productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 20 },
      { productType: 'addon', productKey: 'seat', discountType: 'fixed', discountValue: 20 },
    ],
  };
}

// Percentage rules, asymmetric (growth discount > starter discount) — same
// lesson already learned in verifyPricingBreakdownParity.js: if the OLD
// plan's coupon discount >= the NEW plan's, the upgrade's net contribution
// to the one-time prorated charge legitimately nets to zero-or-negative
// (Math.max(0, ...) correctly floors it), which would make this fixture
// meaningless for proving "the coupon still discounts an upgrade."
function lifetimeCouponSnapshot() {
  return {
    code: 'LIFETIME-ELIG-FIXTURE', name: 'Lifetime Eligibility Fixture', duration: { type: 'lifetime' },
    discountAmount: 7, baseSubtotal: 0, recurringSubtotal: 0, redeemed: true,
    fullRulesSnapshot: [
      { productType: 'plan', productKey: 'starter', discountType: 'percentage', discountValue: 2 },
      { productType: 'plan', productKey: 'growth', discountType: 'percentage', discountValue: 5 },
    ],
  };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('Coupon P0 — upgrade/add-on now respect the same eligibility question renewal already asked\n');

  const starterPlan = await PlanConfig.findOne({ planId: 'starter', isActive: true });
  const growthPlan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
  const seatAddon = await PlanAddon.findOne({ key: 'seat', isActive: true });
  assert.ok(starterPlan && growthPlan && seatAddon);

  await test('upgrade: a redeemed first_payment coupon no longer discounts — no couponDiscount row at all', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'FPUpgrade');
    await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'starter', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: starterPlan.monthlyPrice, userCount: 1, totalAmount: starterPlan.monthlyPrice,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed', activeAddons: [],
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      appliedCoupon: firstPaymentCouponSnapshot(starterPlan.monthlyPrice),
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id }, { planId: 'growth', billingCycle: 'monthly', addons: [] });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected upgrade to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);
    assert.equal(jsonBody.pricingBreakdown.couponDiscount, null, 'A redeemed first_payment coupon must NOT discount an upgrade — this is the exact bug that was fixed');
  });

  await test('upgrade: a lifetime coupon KEEPS discounting — the fix must not have broken the still-correct case', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'LifetimeUpgrade');
    await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'starter', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: starterPlan.monthlyPrice, userCount: 1, totalAmount: starterPlan.monthlyPrice - 20,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed', activeAddons: [],
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      appliedCoupon: lifetimeCouponSnapshot(),
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id }, { planId: 'growth', billingCycle: 'monthly', addons: [] });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected upgrade to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);
    assert.ok(jsonBody.pricingBreakdown.couponDiscount, 'A lifetime coupon must STILL discount the upgrade — the fix must be additive, not a regression');
  });

  await test('add-on purchase: a redeemed first_payment coupon no longer discounts', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'FPAddon');
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'growth', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: growthPlan.monthlyPrice, userCount: 1, totalAmount: growthPlan.monthlyPrice,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed', activeAddons: [],
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      appliedCoupon: firstPaymentCouponSnapshot(growthPlan.monthlyPrice),
    });

    const result = await startAddonPurchase({
      user, organizationId: org._id, subscription, plan: growthPlan,
      catalogEntry: { ...seatAddon.toObject(), displayName: seatAddon.displayName || 'Seats' },
      addonKey: 'seat', quantity: 1,
    });

    assert.equal(result.couponDiscountAmount, 0, 'A redeemed first_payment coupon must NOT discount an add-on purchase — this is the exact bug that was fixed');
    assert.equal(result.discountedProrationAmount, result.prorationAmount, 'No discount means the discounted and raw proration amounts must be identical');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
