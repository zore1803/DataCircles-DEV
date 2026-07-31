// scripts/verifyPreviewSubscription.js
//
// Fixture-based verification for previewSubscription() — BILLING_UX_SPEC.md
// §0/Option A: the pre-payment checkout preview must be backend-computed,
// and critically must NEVER diverge from what createSubscription() actually
// charges moments later. This fixture proves exactly that: call preview,
// call create, assert the numbers match — plus confirm preview performs no
// writes (no Subscription document, no reservation) even when a reward or
// pending referral exists.
//
// WRITES disposable documents and deletes them after — do NOT point this at
// a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyPreviewSubscription.js

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
const Referral = require('../models/Referral');
const ReferralProgram = require('../models/ReferralProgram');
const ReferralCode = require('../models/ReferralCode');
const BillingInvoice = require('../models/BillingInvoice');

const razorpayClient = require('../config/razorpay');
razorpayClient.subscriptions = razorpayClient.subscriptions || {};
razorpayClient.subscriptions.createRegistrationLink = async () => ({
  id: `inv_fixture_stub_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  short_url: 'https://rzp.io/rzp/fixture_stub',
  expire_by: Math.floor(Date.now() / 1000) + 86400,
  customer_id: `cust_fixture_stub_${Date.now()}`,
});

const { previewSubscription, createSubscription } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], Reward: [], RewardUsage: [], Referral: [], ReferralProgram: [], ReferralCode: [], BillingInvoice: [] };
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

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('previewSubscription() — no drift from createSubscription(), no side effects\n');

  const plan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
  assert.ok(plan, 'Expected an active "growth" PlanConfig');

  await test('plain signup: preview matches the actual create total exactly', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'PreviewPlain');
    const userCtx = { organization: org._id, _id: user._id, name: user.name, email: user.email, phone: user.phone };

    const { req: pReq, res: pRes, getResult: pResult } = mockReqRes(userCtx, { planId: 'growth', billingCycle: 'monthly', addons: [] });
    await previewSubscription(pReq, pRes);
    const { jsonBody: preview } = pResult();
    assert.equal(preview.pricingBreakdown.total, plan.monthlyPrice + Math.round(plan.monthlyPrice * 0.18), 'preview total must match plain plan price + GST');

    const { req: cReq, res: cRes } = mockReqRes(userCtx, { planId: 'growth', billingCycle: 'monthly', addons: [] });
    await createSubscription(cReq, cRes);
    const subscription = await Subscription.findOne({ organization: org._id });
    registry.Subscription.push(subscription._id);

    const actualTotal = subscription.totalAmount + Math.round(subscription.totalAmount * 0.18);
    assert.equal(preview.pricingBreakdown.total, actualTotal, 'preview and actual create must charge the exact same total — zero drift');
  });

  await test('referee with a pending referral: preview shows the discount, matches actual create, and writes nothing', async (registry) => {
    const referrerOrg = await trackedCreate(Organization, 'Organization', registry, { name: 'PreviewReferrer', code: `pref-${Date.now()}` });
    await trackedCreate(ReferralProgram, 'ReferralProgram', registry, {
      organization: referrerOrg._id, enabled: true, rewardType: 'percentage', rewardValue: 20, maxRewardAmount: null,
    });
    const referralCode = await trackedCreate(ReferralCode, 'ReferralCode', registry, {
      organization: referrerOrg._id, code: `PREF${Date.now()}`.slice(0, 12), isActive: true,
    });
    const { org: refereeOrg, user: refereeUser } = await makeOrgAndUser(registry, 'PreviewReferee');
    await trackedCreate(Referral, 'Referral', registry, {
      referrerOrganization: referrerOrg._id, referredOrganization: refereeOrg._id, referralCode: referralCode._id, status: 'pending',
    });
    const userCtx = { organization: refereeOrg._id, _id: refereeUser._id, name: refereeUser.name, email: refereeUser.email, phone: refereeUser.phone };

    const { req: pReq, res: pRes, getResult: pResult } = mockReqRes(userCtx, { planId: 'growth', billingCycle: 'monthly', addons: [] });
    await previewSubscription(pReq, pRes);
    const { jsonBody: preview } = pResult();
    assert.ok(preview.pricingBreakdown.referralDiscount, 'preview must show a referral discount row');
    assert.equal(preview.pricingBreakdown.referralDiscount.amount, Math.round(plan.monthlyPrice * 0.2), 'preview referral discount must be 20% of the base price');

    // No writes: no Subscription for this org yet.
    const noSub = await Subscription.findOne({ organization: refereeOrg._id });
    assert.equal(noSub, null, 'preview must never create a Subscription document');

    const { req: cReq, res: cRes } = mockReqRes(userCtx, { planId: 'growth', billingCycle: 'monthly', addons: [] });
    await createSubscription(cReq, cRes);
    const subscription = await Subscription.findOne({ organization: refereeOrg._id });
    registry.Subscription.push(subscription._id);

    // Bug 1 fix (recurring price corruption, found via live QA): the referee's
    // referral discount is one-time-only (first invoice only), so the ACTUAL
    // FIRST INVOICE must match the preview's discounted figure — but
    // subscription.totalAmount (the recurring baseline) must NOT carry the
    // discount forward, since a referral never applies past the first invoice.
    const signupInvoice = await BillingInvoice.findOne({ subscription: subscription._id, reason: 'NEW_SUBSCRIPTION' });
    assert.ok(signupInvoice, 'Expected the signup BillingInvoice to have been persisted');
    registry.BillingInvoice.push(signupInvoice._id);
    assert.equal(signupInvoice.taxable, plan.monthlyPrice - Math.round(plan.monthlyPrice * 0.2), 'actual first invoice must charge the same discounted amount the preview showed');
    assert.equal(subscription.totalAmount, plan.monthlyPrice, 'the stored recurring baseline must NOT carry the one-time referral discount forward');
  });

  await test('referrer with an earned Reward: preview shows it available WITHOUT reserving it', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'PreviewEarned');
    const reward = await trackedCreate(Reward, 'Reward', registry, {
      organization: org._id, source: 'REFERRAL', rewardType: 'percentage', rewardValue: 15, maxRewardAmount: null,
    });
    const userCtx = { organization: org._id, _id: user._id, name: user.name, email: user.email, phone: user.phone };

    const { req: pReq, res: pRes, getResult: pResult } = mockReqRes(userCtx, { planId: 'growth', billingCycle: 'monthly', addons: [] });
    await previewSubscription(pReq, pRes);
    const { jsonBody: preview } = pResult();
    assert.ok(preview.pricingBreakdown.referralDiscount, 'preview must show the earned reward as a referral discount');

    // Scoped to THIS reward specifically — an unscoped query would pick up
    // unrelated RewardUsage rows already in the DB from other fixture runs.
    const anyReservation = await RewardUsage.findOne({ reward: reward._id });
    assert.equal(anyReservation, null, 'preview must never reserve THIS reward — getNextAvailableReward is read-only, no RewardUsage row should exist for it yet');

    const { req: cReq, res: cRes } = mockReqRes(userCtx, { planId: 'growth', billingCycle: 'monthly', addons: [] });
    await createSubscription(cReq, cRes);
    const subscription = await Subscription.findOne({ organization: org._id });
    registry.Subscription.push(subscription._id);
    const nowReservation = await RewardUsage.findOne({ reward: reward._id });
    if (nowReservation) registry.RewardUsage.push(nowReservation._id);
    assert.ok(nowReservation, 'the actual create call (unlike preview) DOES reserve the reward');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
