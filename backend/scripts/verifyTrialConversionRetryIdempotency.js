// scripts/verifyTrialConversionRetryIdempotency.js
//
// Fixture-based verification for the P0 retry/back-button bug found during
// live QA: updateSubscription's trial-conversion branch, called twice for
// the same org (simulating abandon -> return -> "Complete Payment" retry),
// used to orphan the first reward reservation and double-emit
// SUBSCRIPTION_CREATED/REFERRAL_DISCOUNT_APPLIED. Fixed by (1) releasing any
// prior pendingReferralRewardUsageId before reserving again, mirroring the
// upgrade path's existing recycle pattern, and (2) gating both billing
// events on "has this subscription already recorded one."
//
// WRITES disposable documents and deletes them after — do NOT point this at
// a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyTrialConversionRetryIdempotency.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const Reward = require('../models/Reward');
const RewardUsage = require('../models/RewardUsage');
const BillingEvent = require('../models/BillingEvent');
const Referral = require('../models/Referral');
const ReferralProgram = require('../models/ReferralProgram');
const ReferralCode = require('../models/ReferralCode');

const razorpayClient = require('../config/razorpay');
razorpayClient.subscriptions = razorpayClient.subscriptions || {};
razorpayClient.subscriptions.createRegistrationLink = async () => ({
  id: `inv_fixture_stub_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  short_url: 'https://rzp.io/rzp/fixture_stub',
  expire_by: Math.floor(Date.now() / 1000) + 86400,
  customer_id: `cust_fixture_stub_${Date.now()}`,
});

const { updateSubscription } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], Reward: [], RewardUsage: [], BillingEvent: [], Referral: [], ReferralProgram: [], ReferralCode: [] };
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

async function makeTrialSubscription(registry, org) {
  const trialStart = new Date();
  const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  return trackedCreate(Subscription, 'Subscription', registry, {
    organization: org._id, razorpayPlanId: 'plan_trial', planName: 'growth', status: 'active', appStatus: 'trial',
    billingCycle: 'monthly', pricePerUser: 0, userCount: 1, totalAmount: 0, trialStart, trialEnd,
    isTrialActive: true, trialUsed: true, isPaymentConfirmed: false, currentPeriodStart: trialStart, currentPeriodEnd: trialEnd,
  });
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('Trial-conversion retry idempotency — the P0 bug found via live QA\n');

  const plan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
  assert.ok(plan, 'Expected an active "growth" PlanConfig');

  await test('referrer with an earned reward, retrying trial-conversion twice: exactly one active reservation, no orphan', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'RetryReferrer');
    const reward = await trackedCreate(Reward, 'Reward', registry, {
      organization: org._id, source: 'REFERRAL', rewardType: 'percentage', rewardValue: 20, maxRewardAmount: null,
    });
    await makeTrialSubscription(registry, org);
    const userCtx = { organization: org._id, _id: user._id, name: user.name, email: user.email, phone: user.phone };

    // Attempt 1 — abandoned (user goes back without paying).
    const { req: req1, res: res1, getResult: getResult1 } = mockReqRes(userCtx, { planId: 'growth', billingCycle: 'monthly', addons: [] });
    await updateSubscription(req1, res1);
    const { jsonBody: body1 } = getResult1();
    assert.ok(body1.pricingBreakdown.referralDiscount, 'attempt 1 must show the referral discount');

    const subAfter1 = await Subscription.findOne({ organization: org._id });
    const firstReservationId = subAfter1.pendingReferralRewardUsageId;
    assert.ok(firstReservationId, 'attempt 1 must have reserved the reward');
    registry.RewardUsage.push(firstReservationId);

    // Attempt 2 — the retry ("Complete Payment" / back-button-return).
    const { req: req2, res: res2, getResult: getResult2 } = mockReqRes(userCtx, { planId: 'growth', billingCycle: 'monthly', addons: [] });
    await updateSubscription(req2, res2);
    const { jsonBody: body2 } = getResult2();

    // The core bug: without the fix, this would be null/no discount, because
    // the first (still-reserved) reservation blocked a second one from being
    // made and the org only has one reward.
    assert.ok(body2.pricingBreakdown.referralDiscount, 'attempt 2 (the retry) must STILL show the referral discount — this is the exact bug that was fixed');
    assert.equal(body2.pricingBreakdown.referralDiscount.amount, body1.pricingBreakdown.referralDiscount.amount, 'the retry must show the SAME discount amount, not a different/missing one');

    const subAfter2 = await Subscription.findOne({ organization: org._id });
    registry.Subscription.push(subAfter2._id);
    const secondReservationId = subAfter2.pendingReferralRewardUsageId;
    assert.ok(secondReservationId, 'attempt 2 must have reserved the reward again');
    registry.RewardUsage.push(secondReservationId);

    const firstUsage = await RewardUsage.findById(firstReservationId);
    assert.equal(firstUsage.status, 'released', 'the FIRST reservation must be released (not left orphaned as \'reserved\') once the retry reserves again');

    const secondUsage = await RewardUsage.findById(secondReservationId);
    assert.equal(secondUsage.status, 'reserved', 'the SECOND (current) reservation must be the one actually reserved');

    // No orphan: exactly one 'reserved' RewardUsage row for this reward, ever.
    const reservedCount = await RewardUsage.countDocuments({ reward: reward._id, status: 'reserved' });
    assert.equal(reservedCount, 1, 'exactly one reservation should be in \'reserved\' status — no orphaned duplicate');
  });

  await test('referee signup, retrying trial-conversion twice: exactly ONE SUBSCRIPTION_CREATED and ONE REFERRAL_DISCOUNT_APPLIED event, not two', async (registry) => {
    const referrerOrg = await trackedCreate(Organization, 'Organization', registry, { name: 'RetryEventsReferrer', code: `retryevt-${Date.now()}` });
    await trackedCreate(ReferralProgram, 'ReferralProgram', registry, {
      organization: referrerOrg._id, enabled: true, rewardType: 'percentage', rewardValue: 15, maxRewardAmount: null,
    });
    const referralCode = await trackedCreate(ReferralCode, 'ReferralCode', registry, {
      organization: referrerOrg._id, code: `RE${Date.now()}`.slice(0, 12), isActive: true,
    });
    const { org: refereeOrg, user: refereeUser } = await makeOrgAndUser(registry, 'RetryEventsReferee');
    await trackedCreate(Referral, 'Referral', registry, {
      referrerOrganization: referrerOrg._id, referredOrganization: refereeOrg._id, referralCode: referralCode._id, status: 'pending',
    });
    await makeTrialSubscription(registry, refereeOrg);
    const userCtx = { organization: refereeOrg._id, _id: refereeUser._id, name: refereeUser.name, email: refereeUser.email, phone: refereeUser.phone };

    // Two attempts — same simulated abandon-and-retry sequence.
    const { req: req1, res: res1 } = mockReqRes(userCtx, { planId: 'growth', billingCycle: 'monthly', addons: [] });
    await updateSubscription(req1, res1);
    const { req: req2, res: res2 } = mockReqRes(userCtx, { planId: 'growth', billingCycle: 'monthly', addons: [] });
    await updateSubscription(req2, res2);

    const subscription = await Subscription.findOne({ organization: refereeOrg._id });
    registry.Subscription.push(subscription._id);

    const events = await BillingEvent.find({ subscription: subscription._id });
    events.forEach((e) => registry.BillingEvent.push(e._id));

    const createdEvents = events.filter((e) => e.eventType === 'SUBSCRIPTION_CREATED');
    const discountEvents = events.filter((e) => e.eventType === 'REFERRAL_DISCOUNT_APPLIED');
    assert.equal(createdEvents.length, 1, 'exactly one SUBSCRIPTION_CREATED event must exist after two retries — not two');
    assert.equal(discountEvents.length, 1, 'exactly one REFERRAL_DISCOUNT_APPLIED event must exist after two retries — not two');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
