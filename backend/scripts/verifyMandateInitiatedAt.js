// scripts/verifyMandateInitiatedAt.js
//
// Fixture-based verification for the B2 fix (found via live QA): nothing
// previously recorded WHEN a CAW Registration Link/mandate attempt actually
// began — registrationLinkId had no companion timestamp, and mandateExpiresAt
// is only populated reactively by a later webhook. Added Subscription.mandateInitiatedAt,
// set at both Registration Link creation sites (createSubscription's
// fresh-signup path, and updateSubscription's trial-conversion / pending-
// resume re-entry branch), and confirmed it's replaced (not left stale) on
// every re-entry — the exact mechanism "Resume Payment" and "Change Plan
// while pending" both drive.
//
// Drives the REAL exports.createSubscription / exports.updateSubscription
// handlers (not copies of their logic). Stubs the Razorpay SDK's
// createRegistrationLink call — same pattern as
// verifyTrialConversionRetryIdempotency.js.
//
// WRITES disposable documents and deletes them after each fixture — do NOT
// point this at a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyMandateInitiatedAt.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const Coupon = require('../models/Coupon');

const razorpayClient = require('../config/razorpay');
razorpayClient.subscriptions = razorpayClient.subscriptions || {};
let registrationLinkCounter = 0;
razorpayClient.subscriptions.createRegistrationLink = async () => {
  registrationLinkCounter += 1;
  return {
    id: `inv_fixture_stub_${Date.now()}_${registrationLinkCounter}`,
    short_url: 'https://rzp.io/rzp/fixture_stub',
    expire_by: Math.floor(Date.now() / 1000) + 86400,
    customer_id: `cust_fixture_stub_${Date.now()}`,
  };
};

const { createSubscription, updateSubscription } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], Coupon: [] };
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
  await Subscription.deleteMany({ _id: { $in: registry.Subscription } });
  await User.deleteMany({ _id: { $in: registry.User } });
  await Organization.deleteMany({ _id: { $in: registry.Organization } });
  await Coupon.deleteMany({ _id: { $in: registry.Coupon } });
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

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('B2 — mandateInitiatedAt set at both Registration Link creation sites, replaced on re-entry\n');

  const starterPlan = await PlanConfig.findOne({ planId: 'starter', isActive: true });
  const growthPlan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
  assert.ok(starterPlan && growthPlan);

  await test('fresh signup (createSubscription): mandateInitiatedAt is set', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'MandateFresh');
    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id, name: user.name, email: user.email, phone: user.phone }, {
      planId: 'starter', billingCycle: 'monthly', addons: [],
    });
    const before = Date.now();
    await createSubscription(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected signup to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);

    const subscription = await Subscription.findById(jsonBody.subscription._id);
    registry.Subscription.push(subscription._id);
    assert.ok(subscription.mandateInitiatedAt, 'mandateInitiatedAt must be set on fresh signup');
    assert.ok(subscription.mandateInitiatedAt.getTime() >= before - 1000, 'mandateInitiatedAt must reflect roughly now, not some default/stale value');
  });

  await test('trial-conversion (updateSubscription): mandateInitiatedAt is set', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'MandateConversion');
    const trialSub = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'growth', appStatus: 'trial', status: 'created',
      billingCycle: 'monthly', pricePerUser: growthPlan.monthlyPrice, userCount: 1, totalAmount: 0,
      isPaymentConfirmed: false, paymentStatus: 'pending_payment', isTrialActive: true,
      trialStart: new Date(), trialEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    assert.equal(trialSub.mandateInitiatedAt, undefined, 'sanity: trial doc starts with no mandateInitiatedAt');

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id, name: user.name, email: user.email, phone: user.phone }, {
      planId: 'growth', billingCycle: 'monthly', addons: [],
    });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected conversion to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);

    const reloaded = await Subscription.findById(trialSub._id);
    assert.ok(reloaded.mandateInitiatedAt, 'mandateInitiatedAt must be set on trial-conversion');
  });

  await test('re-entry (Resume Payment / Change Plan while pending): mandateInitiatedAt is REPLACED, not left stale — coupon preserved when explicitly passed', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'MandateReentry');
    const coupon = await trackedCreate(Coupon, 'Coupon', registry, {
      code: `MANDATE-REENTRY-${Date.now()}`, name: 'Mandate re-entry fixture', isActive: true,
      scope: { type: 'global' },
      rules: [{ productType: 'plan', productKey: 'starter', discountType: 'fixed', discountValue: 20 }],
      duration: { type: 'until_cancelled' },
    });

    const { org: org2, user: user2 } = { org, user };
    const trialSub = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org2._id, planName: 'starter', appStatus: 'trial', status: 'created',
      billingCycle: 'monthly', pricePerUser: starterPlan.monthlyPrice, userCount: 1, totalAmount: 0,
      isPaymentConfirmed: false, paymentStatus: 'pending_payment', isTrialActive: true,
      trialStart: new Date(), trialEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // First attempt — abandon it (mandateInitiatedAt gets set here).
    const first = mockReqRes({ organization: org2._id, _id: user2._id, name: user2.name, email: user2.email, phone: user2.phone }, {
      planId: 'starter', billingCycle: 'monthly', addons: [], couponCode: coupon.code,
    });
    await updateSubscription(first.req, first.res);
    assert.ok(first.getResult().statusCode < 400);
    const afterFirst = await Subscription.findById(trialSub._id);
    const firstMandateInitiatedAt = afterFirst.mandateInitiatedAt;
    assert.ok(firstMandateInitiatedAt, 'first attempt must set mandateInitiatedAt');
    assert.equal(afterFirst.appliedCoupon?.code, coupon.code, 'first attempt must correctly apply the coupon');

    // Simulate real elapsed time between the two attempts.
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Re-entry ("Resume Payment") — must explicitly re-pass the coupon code,
    // per the verified safety requirement, and must get a FRESH timestamp.
    const second = mockReqRes({ organization: org2._id, _id: user2._id, name: user2.name, email: user2.email, phone: user2.phone }, {
      planId: 'starter', billingCycle: 'monthly', addons: [], couponCode: coupon.code,
    });
    await updateSubscription(second.req, second.res);
    assert.ok(second.getResult().statusCode < 400);
    const afterSecond = await Subscription.findById(trialSub._id);

    assert.ok(afterSecond.mandateInitiatedAt.getTime() > firstMandateInitiatedAt.getTime(), 'mandateInitiatedAt must be REPLACED on re-entry, not left stale from the first attempt');
    assert.equal(afterSecond.appliedCoupon?.code, coupon.code, 'coupon must still be attached after re-entry when explicitly re-passed');
    assert.notEqual(afterSecond.registrationLinkId, afterFirst.registrationLinkId, 'a fresh Registration Link must be created on re-entry, not the same stale one reused');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
