// scripts/verifyTrialConversionReferralWiring.js
//
// Fixture-based verification for the referral wiring gap found in
// updateSubscription's trial-conversion branch — the branch that (per its own
// in-code comment) is what ACTUALLY runs for the common "new subscriber"
// moment (every org starts on a trial via startFreeTrial, then converts via
// updateSubscription), NOT createSubscription. Tonight's earlier
// referee-immediate-discount work only touched createSubscription; this
// fixture proves the SAME wiring now also works at trial conversion, plus the
// separate gap where an org's own already-earned referrer Reward was never
// reserved/applied when THAT org converts trial->paid.
//
// WRITES disposable documents and deletes them after each fixture — do NOT
// point this at a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyTrialConversionReferralWiring.js

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
const Coupon = require('../models/Coupon');
const BillingInvoice = require('../models/BillingInvoice');

const razorpayClient = require('../config/razorpay');
razorpayClient.subscriptions = razorpayClient.subscriptions || {};
razorpayClient.subscriptions.createRegistrationLink = async (params) => ({
  id: `inv_fixture_stub_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  short_url: 'https://rzp.io/rzp/fixture_stub',
  expire_by: Math.floor(Date.now() / 1000) + 86400,
  customer_id: `cust_fixture_stub_${Date.now()}`,
});

const { updateSubscription, runFirstPaymentSettlement } = require('../controllers/subscriptionController');
const couponController = require('../controllers/couponController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], ReferralCode: [], ReferralProgram: [], Referral: [], Reward: [], RewardUsage: [], Coupon: [], BillingInvoice: [] };
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
  await BillingInvoice.deleteMany({ _id: { $in: registry.BillingInvoice } });
  await Coupon.deleteMany({ _id: { $in: registry.Coupon } });
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

// Mirrors startFreeTrial's own write shape exactly — this fixture must start
// from the real trial-doc shape updateSubscription branches on
// (subscription.isPaymentConfirmed === false, no razorpaySubscriptionId).
async function makeTrialSubscription(registry, org) {
  const trialStart = new Date();
  const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const subscription = await trackedCreate(Subscription, 'Subscription', registry, {
    organization: org._id,
    razorpayPlanId: 'plan_trial',
    planName: 'growth',
    status: 'active',
    appStatus: 'trial',
    billingCycle: 'monthly',
    pricePerUser: 0,
    userCount: 1,
    totalAmount: 0,
    trialStart,
    trialEnd,
    isTrialActive: true,
    trialUsed: true,
    isPaymentConfirmed: false,
    currentPeriodStart: trialStart,
    currentPeriodEnd: trialEnd,
  });
  return subscription;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('Trial-conversion branch: referral wiring (the branch real signups actually use)\n');

  const plan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
  assert.ok(plan, 'Expected an active "growth" PlanConfig');

  await test('referee: trial-conversion pricing reflects the referral discount immediately (the gap createSubscription-only testing missed)', async (registry) => {
    const referrerOrg = await trackedCreate(Organization, 'Organization', registry, { name: 'Referrer Org', code: `referrer-${Date.now()}` });
    await trackedCreate(ReferralProgram, 'ReferralProgram', registry, {
      organization: referrerOrg._id, enabled: true, rewardType: 'percentage', rewardValue: 20, maxRewardAmount: null,
    });
    const referralCode = await trackedCreate(ReferralCode, 'ReferralCode', registry, {
      organization: referrerOrg._id, code: `REF${Date.now()}`.slice(0, 12), isActive: true,
    });
    const { org: refereeOrg, user: refereeUser } = await makeOrgAndUser(registry, 'Referee');
    await trackedCreate(Referral, 'Referral', registry, {
      referrerOrganization: referrerOrg._id,
      referredOrganization: refereeOrg._id,
      referralCode: referralCode._id,
      status: 'pending',
    });
    await makeTrialSubscription(registry, refereeOrg);

    const { req, res, getResult } = mockReqRes(
      { organization: refereeOrg._id, _id: refereeUser._id, name: refereeUser.name, email: refereeUser.email, phone: refereeUser.phone },
      { planId: 'growth', billingCycle: 'monthly', addons: [] }
    );
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected trial conversion to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);

    const subscription = await Subscription.findOne({ organization: refereeOrg._id });

    // Bug 1 fix (recurring price corruption, found via live QA): the
    // referee's discount is one-time (first invoice only) — the FIRST
    // INVOICE must reflect it, but the stored recurring baseline must not.
    const signupInvoice = await BillingInvoice.findOne({ subscription: subscription._id, reason: 'NEW_SUBSCRIPTION' });
    assert.ok(signupInvoice, 'Expected the conversion BillingInvoice to have been persisted');
    registry.BillingInvoice.push(signupInvoice._id);
    assert.equal(signupInvoice.taxable, plan.monthlyPrice * 0.8, '20% referral discount must reflect at trial-conversion pricing, not just createSubscription');
    assert.equal(subscription.totalAmount, plan.monthlyPrice, 'the stored recurring baseline must NOT carry the one-time referral discount forward');
  });

  await test('referrer: an already-earned Reward is reserved and applied when THIS org converts trial->paid', async (registry) => {
    const { org: referrerOrg, user: referrerUser } = await makeOrgAndUser(registry, 'EarnedReferrer');
    const reward = await trackedCreate(Reward, 'Reward', registry, {
      organization: referrerOrg._id,
      source: 'REFERRAL',
      rewardType: 'percentage',
      rewardValue: 15,
      maxRewardAmount: null,
    });
    await makeTrialSubscription(registry, referrerOrg);

    const { req, res, getResult } = mockReqRes(
      { organization: referrerOrg._id, _id: referrerUser._id, name: referrerUser.name, email: referrerUser.email, phone: referrerUser.phone },
      { planId: 'growth', billingCycle: 'monthly', addons: [] }
    );
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected trial conversion to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);

    const subscription = await Subscription.findOne({ organization: referrerOrg._id });

    // Bug 1 fix (recurring price corruption, found via live QA): an earned
    // referral Reward is a one-time benefit applied to the first invoice
    // only — the FIRST INVOICE must reflect it, but the stored recurring
    // baseline must not carry it forward.
    // calculateInvoice() rounds the DISCOUNT itself (Math.round(subtotal * pct/100)),
    // then subtracts — not the same as rounding the final discounted total.
    const conversionInvoice = await BillingInvoice.findOne({ subscription: subscription._id, reason: 'NEW_SUBSCRIPTION' });
    assert.ok(conversionInvoice, 'Expected the conversion BillingInvoice to have been persisted');
    registry.BillingInvoice.push(conversionInvoice._id);
    assert.equal(conversionInvoice.taxable, plan.monthlyPrice - Math.round(plan.monthlyPrice * 0.15), "referrer's earned 15% Reward must apply at their own trial-conversion pricing");
    assert.equal(subscription.totalAmount, plan.monthlyPrice, 'the stored recurring baseline must NOT carry the one-time earned-Reward discount forward');
    assert.ok(subscription.pendingReferralRewardUsageId, 'a RewardUsage reservation must be recorded pending settlement');

    const usage = await RewardUsage.findById(subscription.pendingReferralRewardUsageId);
    registry.RewardUsage.push(usage._id);
    assert.equal(usage.status, 'reserved', 'must be reserved, not yet consumed, before settlement runs');

    // Simulate the mandate confirming (settlement).
    await runFirstPaymentSettlement(subscription);
    const reloadedUsage = await RewardUsage.findById(usage._id);
    assert.equal(reloadedUsage.status, 'consumed', 'settlement must consume the reservation exactly once');
    const reloadedSub = await Subscription.findById(subscription._id);
    assert.equal(reloadedSub.pendingReferralRewardUsageId, undefined, 'the pending pointer must be cleared after consumption');
  });

  await test('referrer with an earned Reward, but payment fails: reservation is released, not left occupied', async (registry) => {
    const { org: referrerOrg, user: referrerUser } = await makeOrgAndUser(registry, 'FailedConversion');
    await trackedCreate(Reward, 'Reward', registry, {
      organization: referrerOrg._id,
      source: 'REFERRAL',
      rewardType: 'percentage',
      rewardValue: 10,
      maxRewardAmount: null,
    });
    await makeTrialSubscription(registry, referrerOrg);

    const { req, res } = mockReqRes(
      { organization: referrerOrg._id, _id: referrerUser._id, name: referrerUser.name, email: referrerUser.email, phone: referrerUser.phone },
      { planId: 'growth', billingCycle: 'monthly', addons: [] }
    );
    await updateSubscription(req, res);

    const subscription = await Subscription.findOne({ organization: referrerOrg._id });
    const usageId = subscription.pendingReferralRewardUsageId;
    assert.ok(usageId, 'expected a reservation to have been made');
    registry.RewardUsage.push(usageId);

    const { releaseReservation } = require('../utils/referralRewards');
    await releaseReservation(usageId, 'PAYMENT_FAILED');
    const releasedUsage = await RewardUsage.findById(usageId);
    assert.equal(releasedUsage.status, 'released', 'a failed payment must release the reservation, freeing the reward for a future attempt');
  });

  await test('no referral involvement at all: trial-conversion pricing unaffected (regression check)', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'PlainConversion');
    await makeTrialSubscription(registry, org);

    const { req, res, getResult } = mockReqRes(
      { organization: org._id, _id: user._id, name: user.name, email: user.email, phone: user.phone },
      { planId: 'growth', billingCycle: 'monthly', addons: [] }
    );
    await updateSubscription(req, res);
    const { statusCode } = getResult();
    assert.ok(statusCode < 400, `Expected trial conversion to succeed, got ${statusCode}`);

    const subscription = await Subscription.findOne({ organization: org._id });
    assert.equal(subscription.totalAmount, plan.monthlyPrice, 'no referral present — total must be the full, undiscounted price');
  });

  await test('coupon: a real coupon (created via createCoupon()) applies at trial-conversion pricing — closes the "by inspection" gap in tonight\'s accounting', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'CouponConversion');
    await makeTrialSubscription(registry, org);

    const superAdminId = new mongoose.Types.ObjectId();
    const { req: createReq, res: createRes, getResult: getCreateResult } = mockReqRes(
      null,
      {
        code: `TRIALCONV-${Date.now()}`,
        name: 'Trial Conversion Fixture Coupon',
        scope: { type: 'global' },
        rules: [{ productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 40 }],
        duration: { type: 'lifetime' },
      },
      { superAdmin: { _id: superAdminId } }
    );
    await couponController.createCoupon(createReq, createRes);
    const { statusCode: createStatus, jsonBody: createBody } = getCreateResult();
    assert.equal(createStatus, 201, `Expected 201 creating the coupon, got ${createStatus}: ${JSON.stringify(createBody)}`);
    registry.Coupon.push(createBody.coupon._id);

    const { req, res, getResult } = mockReqRes(
      { organization: org._id, _id: user._id, name: user.name, email: user.email, phone: user.phone },
      { planId: 'growth', billingCycle: 'monthly', addons: [], couponCode: createBody.coupon.code }
    );
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected trial conversion to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);

    const subscription = await Subscription.findOne({ organization: org._id });
    assert.ok(subscription.appliedCoupon, 'Expected appliedCoupon to be set on the subscription at trial conversion, not just at createSubscription');
    assert.equal(subscription.appliedCoupon.discountAmount, 40, 'appliedCoupon must record the correct discount amount');
    assert.equal(subscription.totalAmount, plan.monthlyPrice - 40, "the coupon must actually discount THIS branch's pricing, proven by fixture rather than left as an inspection-only claim");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
