// scripts/verifyTimelineReferralEvents.js
//
// Fixture-based verification for BILLING_UX_SPEC.md §5's timeline rules:
//   - REFERRAL_DISCOUNT_APPLIED emitted for the REFEREE at signup, never
//     REFERRAL_REWARD_EARNED (which stays referrer-only, per §3's one-benefit
//     -per-participant design, already proven earlier tonight).
//   - REFERRAL_REWARD_RESERVED/RELEASED are excluded from the customer-facing
//     getBillingTimeline() read (transient in-progress states, not durable
//     timeline entries) while still existing in BillingEvent for admin audit.
//
// WRITES disposable documents and deletes them after — do NOT point this at
// a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyTimelineReferralEvents.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Referral = require('../models/Referral');
const ReferralProgram = require('../models/ReferralProgram');
const ReferralCode = require('../models/ReferralCode');
const Reward = require('../models/Reward');
const RewardUsage = require('../models/RewardUsage');
const BillingEvent = require('../models/BillingEvent');

const razorpayClient = require('../config/razorpay');
razorpayClient.subscriptions = razorpayClient.subscriptions || {};
razorpayClient.subscriptions.createRegistrationLink = async () => ({
  id: `inv_fixture_stub_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  short_url: 'https://rzp.io/rzp/fixture_stub',
  expire_by: Math.floor(Date.now() / 1000) + 86400,
  customer_id: `cust_fixture_stub_${Date.now()}`,
});

const { createSubscription, getBillingTimeline } = require('../controllers/subscriptionController');
const { reserveNextAvailableReward, releaseReservation } = require('../utils/referralRewards');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], Referral: [], ReferralProgram: [], ReferralCode: [], Reward: [], RewardUsage: [], BillingEvent: [] };
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
  await BillingEvent.deleteMany({ _id: { $in: registry.BillingEvent } });
  await RewardUsage.deleteMany({ _id: { $in: registry.RewardUsage } });
  await Reward.deleteMany({ _id: { $in: registry.Reward } });
  await Referral.deleteMany({ _id: { $in: registry.Referral } });
  await ReferralProgram.deleteMany({ _id: { $in: registry.ReferralProgram } });
  await ReferralCode.deleteMany({ _id: { $in: registry.ReferralCode } });
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
  return { req: { user, body, query: {} }, res, getResult: () => ({ statusCode, jsonBody }) };
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
  console.log('Timeline: referral event routing (referee vs referrer), reservation exclusion\n');

  await test('referee signup: REFERRAL_DISCOUNT_APPLIED emitted, REFERRAL_REWARD_EARNED never emitted to the referee', async (registry) => {
    const referrerOrg = await trackedCreate(Organization, 'Organization', registry, { name: 'TimelineReferrer', code: `tlref-${Date.now()}` });
    await trackedCreate(ReferralProgram, 'ReferralProgram', registry, {
      organization: referrerOrg._id, enabled: true, rewardType: 'percentage', rewardValue: 20, maxRewardAmount: null,
    });
    const referralCode = await trackedCreate(ReferralCode, 'ReferralCode', registry, {
      organization: referrerOrg._id, code: `TL${Date.now()}`.slice(0, 12), isActive: true,
    });
    const { org: refereeOrg, user: refereeUser } = await makeOrgAndUser(registry, 'TimelineReferee');
    await trackedCreate(Referral, 'Referral', registry, {
      referrerOrganization: referrerOrg._id, referredOrganization: refereeOrg._id, referralCode: referralCode._id, status: 'pending',
    });

    const { req, res, getResult } = mockReqRes(
      { organization: refereeOrg._id, _id: refereeUser._id, name: refereeUser.name, email: refereeUser.email, phone: refereeUser.phone },
      { planId: 'growth', billingCycle: 'monthly', addons: [] }
    );
    await createSubscription(req, res);
    const { statusCode } = getResult();
    assert.ok(statusCode < 400, `Expected signup to succeed, got ${statusCode}`);
    const subscription = await Subscription.findOne({ organization: refereeOrg._id });
    registry.Subscription.push(subscription._id);

    const refereeEvents = await BillingEvent.find({ organization: refereeOrg._id });
    refereeEvents.forEach((e) => registry.BillingEvent.push(e._id));
    const discountEvent = refereeEvents.find((e) => e.eventType === 'REFERRAL_DISCOUNT_APPLIED');
    assert.ok(discountEvent, 'Expected a REFERRAL_DISCOUNT_APPLIED event for the referee');
    assert.equal(discountEvent.summary.title, 'Referral Discount Applied');
    assert.ok(!refereeEvents.some((e) => e.eventType === 'REFERRAL_REWARD_EARNED'), 'The referee must NEVER receive a REFERRAL_REWARD_EARNED event — that stays referrer-only');
  });

  await test('reservation/release events exist in BillingEvent but are excluded from getBillingTimeline()', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'TimelineReservation');
    const reward = await trackedCreate(Reward, 'Reward', registry, {
      organization: org._id, source: 'REFERRAL', rewardType: 'percentage', rewardValue: 15, maxRewardAmount: null,
    });
    const reservation = await reserveNextAvailableReward(org._id, { context: 'UPGRADE' });
    registry.RewardUsage.push(reservation.usage._id);
    await releaseReservation(reservation.usage._id, 'PAYMENT_FAILED');

    const rawEvents = await BillingEvent.find({ organization: org._id });
    rawEvents.forEach((e) => registry.BillingEvent.push(e._id));
    assert.ok(rawEvents.some((e) => e.eventType === 'REFERRAL_REWARD_RESERVED'), 'RESERVED must still be written to BillingEvent (admin audit)');
    assert.ok(rawEvents.some((e) => e.eventType === 'REFERRAL_REWARD_RELEASED'), 'RELEASED must still be written to BillingEvent (admin audit)');

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id });
    await getBillingTimeline(req, res);
    const { jsonBody } = getResult();
    assert.ok(!jsonBody.events.some((e) => e.eventType === 'REFERRAL_REWARD_RESERVED'), 'getBillingTimeline() must exclude RESERVED — a transient in-progress state, not a durable event');
    assert.ok(!jsonBody.events.some((e) => e.eventType === 'REFERRAL_REWARD_RELEASED'), 'getBillingTimeline() must exclude RELEASED for the same reason');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
