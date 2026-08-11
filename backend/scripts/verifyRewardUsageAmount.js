// scripts/verifyRewardUsageAmount.js
//
// Fixture-based verification for RewardUsage.amount — BILLING_UX_SPEC.md
// §4's "Saved ₹70" card detail. Proves the real referral discount amount
// gets recorded on the RewardUsage row at the two reserve-before-pricing
// call sites (upgrade, add-on purchase), where the amount isn't known until
// AFTER reservation.
//
// WRITES disposable documents and deletes them after — do NOT point this at
// a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyRewardUsageAmount.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');
const Reward = require('../models/Reward');
const RewardUsage = require('../models/RewardUsage');
const CommercialTransaction = require('../models/CommercialTransaction');

const razorpayClient = require('../config/razorpay');
razorpayClient.orders.create = async (params) => ({ id: `order_fixture_stub_${Date.now()}`, amount: params.amount });

const { updateSubscription } = require('../controllers/subscriptionController');
const { startAddonPurchase } = require('../utils/addonPurchaseLifecycle');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], Reward: [], RewardUsage: [], CommercialTransaction: [] };
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
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { jsonBody = body; return this; },
  };
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

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('RewardUsage.amount — recorded after reserve-before-pricing\n');

  const starterPlan = await PlanConfig.findOne({ planId: 'starter', isActive: true });
  const growthPlan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
  const seatAddon = await PlanAddon.findOne({ key: 'seat', isActive: true });
  assert.ok(starterPlan && growthPlan && seatAddon);

  await test('upgrade: RewardUsage.amount matches the real referral discount, not left null', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'AmountUpgrade');
    const reward = await trackedCreate(Reward, 'Reward', registry, {
      organization: org._id, source: 'REFERRAL', rewardType: 'percentage', rewardValue: 10, maxRewardAmount: null,
    });
    await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'starter', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: starterPlan.monthlyPrice, userCount: 1, totalAmount: starterPlan.monthlyPrice,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed', activeAddons: [],
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id }, { planId: 'growth', billingCycle: 'monthly', addons: [] });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected upgrade to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);

    const usage = await RewardUsage.findOne({ reward: reward._id });
    registry.RewardUsage.push(usage._id);
    assert.ok(usage.amount > 0, 'RewardUsage.amount must be recorded as a positive real number, not left null');
    assert.equal(usage.amount, jsonBody.pricingBreakdown.referralDiscount.amount, 'the recorded amount must match what pricingBreakdown actually showed the customer');
  });

  await test('add-on purchase: RewardUsage.amount matches the real referral discount', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'AmountAddon');
    const reward = await trackedCreate(Reward, 'Reward', registry, {
      organization: org._id, source: 'REFERRAL', rewardType: 'percentage', rewardValue: 20, maxRewardAmount: null,
    });
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'growth', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: growthPlan.monthlyPrice, userCount: 1, totalAmount: growthPlan.monthlyPrice,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed', activeAddons: [],
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    });

    const result = await startAddonPurchase({
      user, organizationId: org._id, subscription, plan: growthPlan,
      catalogEntry: { ...seatAddon.toObject(), displayName: seatAddon.displayName || 'Seats' },
      addonKey: 'seat', quantity: 1,
    });
    if (subscription.pendingAddonAddition?.referralRewardUsageId) registry.RewardUsage.push(subscription.pendingAddonAddition.referralRewardUsageId);

    const usage = await RewardUsage.findOne({ reward: reward._id });
    assert.ok(usage.amount > 0, 'RewardUsage.amount must be recorded for the add-on purchase reservation');
    assert.equal(usage.amount, result.pricingBreakdown.referralDiscount.amount, 'the recorded amount must match what pricingBreakdown actually showed');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
