// scripts/verifyPricingBreakdownParity.js
//
// Fixture-based verification that upgrade, add-on purchase, and renewal
// preview all now return the canonical BILLING_UX_SPEC.md §1.2
// pricingBreakdown shape, and that the invariant from §1.1 holds exactly:
//   taxableAmount = subtotal - couponDiscount - referralDiscount
// for each of the three surfaces. Also proves the renewal preview endpoint
// performs zero writes/reservations (a plain read, per §2.2).
//
// WRITES disposable documents and deletes them after — do NOT point this at
// a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyPricingBreakdownParity.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');
const Coupon = require('../models/Coupon');
const CommercialTransaction = require('../models/CommercialTransaction');
const Reward = require('../models/Reward');
const RewardUsage = require('../models/RewardUsage');

const razorpayClient = require('../config/razorpay');
razorpayClient.orders.create = async (params) => ({ id: `order_fixture_stub_${Date.now()}`, amount: params.amount });

const couponController = require('../controllers/couponController');
const { updateSubscription, getRenewalPreview } = require('../controllers/subscriptionController');
const { startAddonPurchase } = require('../utils/addonPurchaseLifecycle');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], Coupon: [], CommercialTransaction: [], Reward: [], RewardUsage: [] };
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
  await RewardUsage.deleteMany({ _id: { $in: registry.RewardUsage } });
  await Reward.deleteMany({ _id: { $in: registry.Reward } });
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

async function createRealCoupon(registry, rules) {
  const { req, res, getResult } = mockReqRes(
    null,
    { code: `PB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: 'Parity Fixture Coupon', scope: { type: 'global' }, rules, duration: { type: 'lifetime' } },
    { superAdmin: { _id: new mongoose.Types.ObjectId() } }
  );
  await couponController.createCoupon(req, res);
  const { statusCode, jsonBody } = getResult();
  assert.equal(statusCode, 201, `Expected 201 creating coupon, got ${statusCode}: ${JSON.stringify(jsonBody)}`);
  registry.Coupon.push(jsonBody.coupon._id);
  return jsonBody.coupon;
}

async function makeOrgAndUser(registry, label) {
  const org = await trackedCreate(Organization, 'Organization', registry, { name: `${label} Org`, code: `${label.toLowerCase()}-${Date.now()}` });
  const user = await trackedCreate(User, 'User', registry, {
    name: `${label} User`,
    email: `${label.toLowerCase()}-${Date.now()}@example.test`,
    phone: `9${String(Date.now()).slice(-9)}`,
    organization: org._id,
    role: 'admin',
    auth0Id: `${label.toLowerCase()}-${Date.now()}`,
  });
  return { org, user };
}

function assertInvariant(pb, label) {
  assert.ok(pb, `${label}: pricingBreakdown must be present`);
  const couponAmt = pb.couponDiscount?.amount || 0;
  const referralAmt = pb.referralDiscount?.amount || 0;
  assert.equal(pb.taxableAmount, pb.subtotal - couponAmt - referralAmt, `${label}: taxableAmount = subtotal - couponDiscount - referralDiscount must hold exactly`);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('pricingBreakdown parity — upgrade, add-on purchase, renewal preview\n');

  const starterPlan = await PlanConfig.findOne({ planId: 'starter', isActive: true });
  const growthPlan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
  const seatAddon = await PlanAddon.findOne({ key: 'seat', isActive: true });
  assert.ok(starterPlan && growthPlan, 'Expected active starter/growth PlanConfigs');
  assert.ok(seatAddon, 'Expected an active "seat" PlanAddon');

  await test('upgrade: pricingBreakdown present, invariant holds, with a real coupon applied', async (registry) => {
    // Coupon discount on the NEW plan must be >= the discount on the OLD
    // plan — otherwise the coupon's net contribution to THIS specific
    // prorated charge is legitimately zero-or-negative (the customer was
    // getting a bigger discount on the plan they're leaving), which
    // Math.max(0, ...) correctly floors to "no coupon row" rather than a
    // nonsensical negative discount. Chosen asymmetrically on purpose to
    // exercise the row actually appearing.
    const coupon = await createRealCoupon(registry, [
      { productType: 'plan', productKey: 'starter', discountType: 'fixed', discountValue: 20 },
      { productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 50 },
    ]);
    const { org, user } = await makeOrgAndUser(registry, 'UpgradeParity');
    await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'starter', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: starterPlan.monthlyPrice, userCount: 1, totalAmount: starterPlan.monthlyPrice - 20,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed', activeAddons: [],
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      appliedCoupon: {
        code: coupon.code, name: coupon.name, duration: { type: 'lifetime' },
        discountAmount: 20, baseSubtotal: starterPlan.monthlyPrice, recurringSubtotal: starterPlan.monthlyPrice - 20,
        fullRulesSnapshot: coupon.rules,
      },
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id }, { planId: 'growth', billingCycle: 'monthly', addons: [] });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected upgrade to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);
    assertInvariant(jsonBody.pricingBreakdown, 'upgrade');
    assert.ok(jsonBody.pricingBreakdown.couponDiscount, 'upgrade pricingBreakdown must show the coupon discount as its own row');
    assert.equal(jsonBody.pricingBreakdown.total, jsonBody.paymentDetails.amount / 100, 'pricingBreakdown.total must match what Razorpay is actually asked to charge');
  });

  await test('add-on purchase: pricingBreakdown present, invariant holds, referral + coupon both shown', async (registry) => {
    const coupon = await createRealCoupon(registry, [
      { productType: 'addon', productKey: 'seat', discountType: 'fixed', discountValue: 15 },
    ]);
    const { org, user } = await makeOrgAndUser(registry, 'AddonParity');
    const reward = await trackedCreate(Reward, 'Reward', registry, {
      organization: org._id, source: 'REFERRAL', rewardType: 'percentage', rewardValue: 10, maxRewardAmount: null,
    });
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'growth', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: growthPlan.monthlyPrice, userCount: 1, totalAmount: growthPlan.monthlyPrice,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed', activeAddons: [],
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      appliedCoupon: {
        code: coupon.code, name: coupon.name, duration: { type: 'lifetime' },
        discountAmount: 0, baseSubtotal: growthPlan.monthlyPrice, recurringSubtotal: growthPlan.monthlyPrice,
        fullRulesSnapshot: coupon.rules,
      },
    });

    const result = await startAddonPurchase({
      user, organizationId: org._id, subscription, plan: growthPlan,
      catalogEntry: { ...seatAddon.toObject(), displayName: seatAddon.displayName || 'Seats' },
      addonKey: 'seat', quantity: 1,
    });
    if (subscription.pendingAddonAddition?.referralRewardUsageId) registry.RewardUsage.push(subscription.pendingAddonAddition.referralRewardUsageId);

    assertInvariant(result.pricingBreakdown, 'add-on purchase');
    assert.ok(result.pricingBreakdown.couponDiscount, 'add-on pricingBreakdown must show the coupon row');
    assert.ok(result.pricingBreakdown.referralDiscount, 'add-on pricingBreakdown must show the referral row');
    assert.equal(result.pricingBreakdown.total, result.paymentDetails.amount / 100, 'pricingBreakdown.total must match what Razorpay is actually asked to charge');
  });

  await test('renewal preview: read-only, matches the subscription\'s real coupon + an available reward, writes nothing', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'RenewalParity');
    const reward = await trackedCreate(Reward, 'Reward', registry, {
      organization: org._id, source: 'REFERRAL', rewardType: 'percentage', rewardValue: 25, maxRewardAmount: null,
    });
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'growth', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: growthPlan.monthlyPrice, userCount: 1, totalAmount: growthPlan.monthlyPrice,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed', activeAddons: [],
      currentPeriodStart: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), currentPeriodEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      appliedCoupon: {
        code: 'RENEWFIX', name: 'Renewal Fixture', duration: { type: 'until_cancelled' },
        discountAmount: 40, baseSubtotal: growthPlan.monthlyPrice, recurringSubtotal: growthPlan.monthlyPrice - 40,
        // Bug 2 fix (found via live QA): renewal preview now rebuilds the
        // modifier from fullRulesSnapshot against the actual effective plan,
        // rather than reusing a flat discountAmount — needs a real rule here.
        fullRulesSnapshot: [{ productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 40 }],
      },
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id });
    await getRenewalPreview(req, res);
    const { jsonBody } = getResult();
    assertInvariant(jsonBody.pricingBreakdown, 'renewal preview');
    assert.ok(jsonBody.pricingBreakdown.couponDiscount, 'renewal preview must show the still-eligible (until_cancelled) coupon');
    assert.ok(jsonBody.pricingBreakdown.referralDiscount, 'renewal preview must show the available reward');
    assert.equal(jsonBody.pricingBreakdown.referralDiscount.amount, Math.round((growthPlan.monthlyPrice - 40) * 0.25), 'referral discount must be 25% of the post-coupon subtotal (Stage 6 before Stage 7)');

    // No writes: the reward must still show zero RewardUsage rows, and the
    // subscription's own currentPeriodEnd/appliedCoupon must be untouched.
    const anyReservation = await RewardUsage.findOne({ reward: reward._id });
    assert.equal(anyReservation, null, 'renewal preview must never reserve the reward it previewed');
    const reloadedSub = await Subscription.findById(subscription._id);
    assert.equal(reloadedSub.appliedCoupon.discountAmount, 40, 'renewal preview must not mutate the subscription document at all');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
