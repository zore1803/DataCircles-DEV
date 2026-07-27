// scripts/verifyRefereeImmediateDiscount.js
//
// Fixture-based verification for the referee's immediate first-invoice
// referral discount (§3.6b correction) — replaces the old "both sides get a
// deferred Reward" behavior. Drives the REAL createSubscription() and
// maybeQualifyReferral() (via the exported settlement helper) end to end.
//
// WRITES disposable documents and deletes them after each fixture — do NOT
// point this at a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyRefereeImmediateDiscount.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const ReferralCode = require('../models/ReferralCode');
const ReferralProgram = require('../models/ReferralProgram');
const Referral = require('../models/Referral');
const Reward = require('../models/Reward');
const RewardUsage = require('../models/RewardUsage');

const razorpayClient = require('../config/razorpay');
razorpayClient.subscriptions = razorpayClient.subscriptions || {};
razorpayClient.subscriptions.createRegistrationLink = async (params) => ({
  id: `inv_fixture_stub_${Date.now()}`,
  short_url: 'https://rzp.io/rzp/fixture_stub',
  expire_by: Math.floor(Date.now() / 1000) + 86400,
  customer_id: `cust_fixture_stub_${Date.now()}`,
});

const { createSubscription, maybeQualifyReferral } = require('../controllers/subscriptionController');
const { findPendingReferralForSignup } = require('../utils/referralUtils');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], ReferralCode: [], ReferralProgram: [], Referral: [], Reward: [], RewardUsage: [] };
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
  const req = { user, body };
  return { req, res, getResult: () => ({ statusCode, jsonBody }) };
}

// Sets up a referrer org with an enabled program + code, and a referee org
// with a Referral(pending) already recorded — mirrors what
// authController.completeRegistration writes at registration, per this
// session's trace (§1.1), so this fixture starts from the real data shape.
async function setupReferrerAndPendingReferral(registry, rewardValue = 20) {
  const referrerOrg = await trackedCreate(Organization, 'Organization', registry, { name: 'Referrer Org', code: `referrer-${Date.now()}` });
  await trackedCreate(ReferralProgram, 'ReferralProgram', registry, {
    organization: referrerOrg._id, enabled: true, rewardType: 'percentage', rewardValue, maxRewardAmount: null,
  });
  const referralCode = await trackedCreate(ReferralCode, 'ReferralCode', registry, {
    organization: referrerOrg._id, code: `REF${Date.now()}`.slice(0, 12), isActive: true,
  });

  const { org: refereeOrg, user: refereeUser } = await makeOrgAndUser(registry, 'Referee');
  const referral = await trackedCreate(Referral, 'Referral', registry, {
    referrerOrganization: referrerOrg._id,
    referredOrganization: refereeOrg._id,
    referralCode: referralCode._id,
    status: 'pending',
  });
  return { referrerOrg, refereeOrg, refereeUser, referral };
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
  console.log('Referee immediate first-invoice referral discount\n');

  const plan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
  assert.ok(plan, 'Expected an active "growth" PlanConfig');

  await test('happy path: referee\'s first invoice reflects the referral discount immediately', async (registry) => {
    const { refereeOrg, refereeUser } = await setupReferrerAndPendingReferral(registry, 20);

    const { req, res, getResult } = mockReqRes(
      { organization: refereeOrg._id, _id: refereeUser._id, name: refereeUser.name, email: refereeUser.email, phone: refereeUser.phone },
      { planId: 'growth', billingCycle: 'monthly', addons: [] }
    );
    await createSubscription(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected signup to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);

    const subscription = await Subscription.findOne({ organization: refereeOrg._id });
    registry.Subscription.push(subscription._id);
    assert.equal(subscription.totalAmount, plan.monthlyPrice * 0.8, '20% referral discount must reflect in the priced total, immediately, on the first invoice');
  });

  await test('settlement: referral qualifies, referrer gets ONE Reward, referee gets NONE, no RewardUsage for referee', async (registry) => {
    const { referrerOrg, refereeOrg, refereeUser, referral } = await setupReferrerAndPendingReferral(registry, 15);

    const { req, res, getResult } = mockReqRes(
      { organization: refereeOrg._id, _id: refereeUser._id, name: refereeUser.name, email: refereeUser.email, phone: refereeUser.phone },
      { planId: 'growth', billingCycle: 'monthly', addons: [] }
    );
    await createSubscription(req, res);
    const { statusCode } = getResult();
    assert.ok(statusCode < 400, `Expected signup to succeed, got ${statusCode}`);

    const subscription = await Subscription.findOne({ organization: refereeOrg._id });
    registry.Subscription.push(subscription._id);

    // Simulate the referee's first payment settling.
    await maybeQualifyReferral(subscription);

    const reloadedReferral = await Referral.findById(referral._id);
    assert.equal(reloadedReferral.status, 'qualified', 'Referral must transition to qualified on settlement');
    assert.ok(reloadedReferral.qualifiedAt, 'qualifiedAt must be set');

    const referrerRewards = await Reward.find({ organization: referrerOrg._id, referral: referral._id });
    referrerRewards.forEach((r) => registry.Reward.push(r._id));
    assert.equal(referrerRewards.length, 1, 'Referrer must get exactly ONE Reward');

    const refereeRewards = await Reward.find({ organization: refereeOrg._id, referral: referral._id });
    refereeRewards.forEach((r) => registry.Reward.push(r._id));
    assert.equal(refereeRewards.length, 0, 'Referee must get ZERO Reward objects — their immediate signup discount IS their reward, not a second deferred one');

    const anyUsageForReferee = await RewardUsage.find({ subscription: subscription._id });
    anyUsageForReferee.forEach((u) => registry.RewardUsage.push(u._id));
    assert.equal(anyUsageForReferee.length, 0, 'No RewardUsage reservation should ever be created for the referee — nothing to reserve/consume, the discount already happened at pricing');
  });

  await test('abandoned/failed payment: referral stays pending, and is still resolvable for pricing (nothing was consumed by pricing it once)', async (registry) => {
    const { refereeOrg, refereeUser, referral } = await setupReferrerAndPendingReferral(registry, 20);

    // First attempt — price the invoice (this is what createSubscription
    // does regardless of whether payment ultimately succeeds). Note:
    // createSubscription itself refuses a second call once a Subscription
    // document exists for the org (a real, correct, unrelated constraint —
    // confirmed live while writing this fixture, not assumed) — so "retry"
    // for an abandoned CAW registration link happens through a different
    // path (a fresh registration link against the SAME pending Subscription,
    // not a second createSubscription call). What actually needs proving
    // here is narrower and more precise: that pricing the invoice once does
    // not itself consume or alter the pending referral — i.e. the discount
    // is a pricing INPUT, read fresh every time, never a resource that gets
    // spent by being priced.
    const { req: req1, res: res1 } = mockReqRes(
      { organization: refereeOrg._id, _id: refereeUser._id, name: refereeUser.name, email: refereeUser.email, phone: refereeUser.phone },
      { planId: 'growth', billingCycle: 'monthly', addons: [] }
    );
    await createSubscription(req1, res1);
    // No settlement call here — simulates the payment never completing.
    const subscription = await Subscription.findOne({ organization: refereeOrg._id });
    registry.Subscription.push(subscription._id);

    const reloadedReferral = await Referral.findById(referral._id);
    assert.equal(reloadedReferral.status, 'pending', 'Referral must remain pending — nothing commits before payment actually succeeds');

    // Prove the SAME referral is still fully resolvable for pricing purposes
    // — nothing about having priced it once marked it used, reserved, or
    // otherwise unavailable.
    const stillPending = await findPendingReferralForSignup(refereeOrg._id);
    assert.ok(stillPending, 'The pending referral must still resolve for pricing after an abandoned/failed attempt');
    assert.equal(String(stillPending.referral._id), String(referral._id), 'Must resolve to the SAME referral record, not a new one');
    assert.equal(stillPending.program.rewardValue, 20, 'Program config must still be readable and unchanged');
  });

  await test('no pending referral — signup pricing completely unaffected (regression check)', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'NoReferral');
    const { req, res, getResult } = mockReqRes(
      { organization: org._id, _id: user._id, name: user.name, email: user.email, phone: user.phone },
      { planId: 'growth', billingCycle: 'monthly', addons: [] }
    );
    await createSubscription(req, res);
    const { statusCode } = getResult();
    assert.ok(statusCode < 400, `Expected signup to succeed, got ${statusCode}`);

    const subscription = await Subscription.findOne({ organization: org._id });
    registry.Subscription.push(subscription._id);
    assert.equal(subscription.totalAmount, plan.monthlyPrice, 'No referral present — total must be the full, undiscounted price');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
