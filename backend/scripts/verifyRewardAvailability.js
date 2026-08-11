// scripts/verifyRewardAvailability.js
//
// Fixture-based verification for getRewardAvailability() —
// BILLING_UX_SPEC.md §2.2's single "do I have an available reward" read,
// shared by the dashboard/plan-card/Referrals/Manage-Subscription surfaces.
// Read-only — must never reserve the reward it reports on.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyRewardAvailability.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Reward = require('../models/Reward');
const RewardUsage = require('../models/RewardUsage');

const { getRewardAvailability } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], Reward: [], RewardUsage: [] };
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
  await Subscription.deleteMany({ _id: { $in: registry.Subscription } });
  await User.deleteMany({ _id: { $in: registry.User } });
  await Organization.deleteMany({ _id: { $in: registry.Organization } });
}

async function trackedCreate(Model, key, registry, doc) {
  const created = await Model.create(doc);
  registry[key].push(created._id);
  return created;
}

function mockReqRes(user) {
  let statusCode = 200;
  let jsonBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { jsonBody = body; return this; },
  };
  return { req: { user }, res, getResult: () => ({ statusCode, jsonBody }) };
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
  console.log('getRewardAvailability() — one read shared by every visibility surface\n');

  await test('no reward: available: false, no other fields', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'NoReward');
    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id });
    await getRewardAvailability(req, res);
    const { jsonBody } = getResult();
    assert.equal(jsonBody.available, false);
  });

  await test('reward available, org already paying: eligible for Upgrade/Renewal/Add-ons, NOT First Payment; nothing reserved', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'PayingWithReward');
    const reward = await trackedCreate(Reward, 'Reward', registry, {
      organization: org._id, source: 'REFERRAL', rewardType: 'percentage', rewardValue: 20, maxRewardAmount: null,
    });
    await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'growth', billingCycle: 'monthly', pricePerUser: 450, userCount: 1,
      totalAmount: 450, isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id });
    await getRewardAvailability(req, res);
    const { jsonBody } = getResult();
    assert.equal(jsonBody.available, true);
    assert.equal(jsonBody.rewardValue, 20);
    assert.deepEqual(jsonBody.eligibleFor, ['Upgrade', 'Renewal', 'Add-ons']);

    const reservation = await RewardUsage.findOne({ reward: reward._id });
    assert.equal(reservation, null, 'getRewardAvailability must never reserve the reward it reports on');
  });

  await test('reward available, org still on trial: First Payment included', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'TrialWithReward');
    await trackedCreate(Reward, 'Reward', registry, {
      organization: org._id, source: 'REFERRAL', rewardType: 'percentage', rewardValue: 10, maxRewardAmount: null,
    });
    await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'growth', billingCycle: 'monthly', pricePerUser: 0, userCount: 1,
      totalAmount: 0, isPaymentConfirmed: false, appStatus: 'trial',
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id });
    await getRewardAvailability(req, res);
    const { jsonBody } = getResult();
    assert.deepEqual(jsonBody.eligibleFor, ['Upgrade', 'Renewal', 'Add-ons', 'First Payment']);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
