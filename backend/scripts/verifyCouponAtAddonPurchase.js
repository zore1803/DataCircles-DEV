// scripts/verifyCouponAtAddonPurchase.js
//
// Fixture-based verification for Brief 1 — appliedCoupon.fullRulesSnapshot
// + coupon wiring in addonPurchaseLifecycle.js's startAddonPurchase().
// Drives real controllers end to end: real createCoupon(), real
// createSubscription() signup, real startAddonPurchase() for the add-on
// purchase itself — not fixture-constructed documents standing in for the
// real path, per this session's established bar.
//
// WRITES disposable documents and deletes them after — do NOT point this at
// a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyCouponAtAddonPurchase.js

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
const Reward = require('../models/Reward');
const RewardUsage = require('../models/RewardUsage');
const CommercialTransaction = require('../models/CommercialTransaction');

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
razorpayClient.plans = razorpayClient.plans || {};
razorpayClient.plans.create = async () => ({ id: `plan_fixture_stub_${Date.now()}` });
razorpayClient.subscriptions.update = async () => ({ id: 'sub_fixture_stub_unused', status: 'active' });

const couponController = require('../controllers/couponController');
const { startAddonPurchase } = require('../utils/addonPurchaseLifecycle');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], Coupon: [], Reward: [], RewardUsage: [], CommercialTransaction: [] };
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
  await RewardUsage.deleteMany({ _id: { $in: registry.RewardUsage } });
  await Reward.deleteMany({ _id: { $in: registry.Reward } });
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
    { code: `CPN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: 'Fixture Coupon', scope: { type: 'global' }, rules, duration: { type: 'lifetime' } },
    { superAdmin: { _id: new mongoose.Types.ObjectId() } }
  );
  await couponController.createCoupon(req, res);
  const { statusCode, jsonBody } = getResult();
  assert.equal(statusCode, 201, `Expected 201 creating coupon, got ${statusCode}: ${JSON.stringify(jsonBody)}`);
  registry.Coupon.push(jsonBody.coupon._id);
  return jsonBody.coupon;
}

async function realSignup(registry, org, user, couponCode) {
  const { createSubscription } = require('../controllers/subscriptionController');
  const { req, res, getResult } = mockReqRes(
    { organization: org._id, _id: user._id, name: user.name, email: user.email, phone: user.phone },
    { planId: 'growth', billingCycle: 'monthly', addons: [], couponCode }
  );
  await createSubscription(req, res);
  const { statusCode, jsonBody } = getResult();
  assert.ok(statusCode < 400, `Expected signup to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);
  const subscription = await Subscription.findOne({ organization: org._id });
  registry.Subscription.push(subscription._id);
  return subscription;
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

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('Brief 1 — coupon at add-on purchase (fullRulesSnapshot + startAddonPurchase wiring)\n');

  const plan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
  assert.ok(plan, 'Expected an active "growth" PlanConfig');
  const seatAddon = await PlanAddon.findOne({ key: 'seat', isActive: true });
  assert.ok(seatAddon, 'Expected an active "seat" PlanAddon catalog entry');

  await test('signup writes fullRulesSnapshot with the COMPLETE rule set, not just what matched the order', async (registry) => {
    const coupon = await createRealCoupon(registry, [
      { productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 60 },
      { productType: 'addon', productKey: 'seat', discountType: 'fixed', discountValue: 20 },
    ]);
    const { org, user } = await makeOrgAndUser(registry, 'FullSnapshot');
    const subscription = await realSignup(registry, org, user, coupon.code);

    assert.equal(subscription.appliedCoupon.rulesApplied.length, 1, 'rulesApplied must stay filtered to what matched the signup order (plan only — no addon purchased at signup)');
    assert.equal(subscription.appliedCoupon.fullRulesSnapshot.length, 2, 'fullRulesSnapshot must record BOTH rules, including the addon rule never matched at signup');
    assert.ok(
      subscription.appliedCoupon.fullRulesSnapshot.some((r) => r.productType === 'addon' && r.productKey === 'seat'),
      'fullRulesSnapshot must include the seat-addon rule even though it was never purchased at signup'
    );
  });

  await test('coupon scoped to the purchased add-on applies at startAddonPurchase() — real end to end', async (registry) => {
    const coupon = await createRealCoupon(registry, [
      { productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 60 },
      { productType: 'addon', productKey: 'seat', discountType: 'fixed', discountValue: 20 },
    ]);
    const { org, user } = await makeOrgAndUser(registry, 'AddonCovered');
    const subscription = await realSignup(registry, org, user, coupon.code);
    subscription.isPaymentConfirmed = true;
    subscription.paymentStatus = 'payment_completed';
    subscription.currentPeriodStart = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    subscription.currentPeriodEnd = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000);
    await subscription.save();

    const result = await startAddonPurchase({
      user, organizationId: org._id, subscription, plan,
      catalogEntry: { ...seatAddon.toObject(), displayName: seatAddon.displayName || 'Seats' },
      addonKey: 'seat', quantity: 1,
    });

    // Fields now split by source (fixed after this fixture was first written —
    // see the P1 frontend/API fix): couponDiscountAmount and
    // referralDiscountAmount each mean exactly what they say;
    // totalDiscountAmount is the combined figure for callers that want one number.
    assert.equal(result.couponDiscountAmount, 20, 'couponDiscountAmount must equal the coupon amount');
    assert.equal(result.referralDiscountAmount, 0, 'referralDiscountAmount must be 0 — no referral reward exists in this fixture');
    assert.equal(result.totalDiscountAmount, 20, 'totalDiscountAmount must equal the coupon amount (the only discount present)');
    assert.ok(result.discountedProrationAmount < result.prorationAmount, 'Coupon must reduce the priced add-on amount');
  });

  await test('coupon NOT scoped to the purchased add-on — CP3 equivalent: add-on purchase succeeds, no discount, no error', async (registry) => {
    const coupon = await createRealCoupon(registry, [
      { productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 60 },
      // No 'seat' rule at all.
    ]);
    const { org, user } = await makeOrgAndUser(registry, 'AddonUncovered');
    const subscription = await realSignup(registry, org, user, coupon.code);
    subscription.isPaymentConfirmed = true;
    subscription.paymentStatus = 'payment_completed';
    subscription.currentPeriodStart = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    subscription.currentPeriodEnd = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000);
    await subscription.save();

    const result = await startAddonPurchase({
      user, organizationId: org._id, subscription, plan,
      catalogEntry: { ...seatAddon.toObject(), displayName: seatAddon.displayName || 'Seats' },
      addonKey: 'seat', quantity: 1,
    });

    assert.equal(result.discountedProrationAmount, result.prorationAmount, 'No coupon rule matches "seat" — the add-on must price at full amount, not throw, not silently discount');
  });

  await test('referral + coupon combined at add-on purchase — both apply, stacked correctly', async (registry) => {
    const coupon = await createRealCoupon(registry, [
      { productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 60 },
      { productType: 'addon', productKey: 'seat', discountType: 'fixed', discountValue: 20 },
    ]);
    const { org, user } = await makeOrgAndUser(registry, 'AddonBoth');
    const subscription = await realSignup(registry, org, user, coupon.code);
    subscription.isPaymentConfirmed = true;
    subscription.paymentStatus = 'payment_completed';
    subscription.currentPeriodStart = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    subscription.currentPeriodEnd = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000);
    await subscription.save();

    const reward = await trackedCreate(Reward, 'Reward', registry, { organization: org._id, source: 'MANUAL', rewardType: 'fixed', rewardValue: 15 });

    const result = await startAddonPurchase({
      user, organizationId: org._id, subscription, plan,
      catalogEntry: { ...seatAddon.toObject(), displayName: seatAddon.displayName || 'Seats' },
      addonKey: 'seat', quantity: 1,
    });

    const usage = await RewardUsage.findOne({ reward: reward._id });
    if (usage) registry.RewardUsage.push(usage._id);
    assert.ok(usage, 'Referral reservation must have occurred alongside the coupon');
    assert.equal(result.couponDiscountAmount, 20, 'couponDiscountAmount must equal the coupon amount');
    assert.equal(result.referralDiscountAmount, 15, 'referralDiscountAmount must equal the referral amount');
    assert.equal(result.totalDiscountAmount, 35, 'totalDiscountAmount must equal coupon (20) + referral (15) = 35');
    // Both discounts should reduce the final amount below what either alone would.
    const couponOnlyDiscounted = result.prorationAmount - 20;
    assert.ok(result.discountedProrationAmount < couponOnlyDiscounted, 'Combined coupon+referral must discount MORE than the coupon alone (Stage 6 -> Stage 7 both applied)');

    const ct = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'ADDON_PURCHASE' });
    if (ct) registry.CommercialTransaction.push(ct._id);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
