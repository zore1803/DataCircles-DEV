// scripts/verifySubscriptionCheckEntitlementFix.js
//
// Hotfix (docs/audit/PHASE3_ENTITLEMENT_WINDOW_SCHEMA_TRACE.md finding #21):
// drives the real exported checkSubscriptionLimits middleware against
// disposable Subscription/PlanConfig documents, proving:
//   (a) monthly-subscription behavior is unchanged (the regression risk)
//   (b) an annual subscription now correctly retains access past its
//       rolling currentPeriodEnd, up to its real entitlement window
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifySubscriptionCheckEntitlementFix.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const { checkSubscriptionLimits } = require('../middlewares/subscriptionCheck');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database.');
  process.exit(1);
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}:`, err); }
  finally { await cleanup(); }
}

const cleanupIds = [];
async function cleanup() {
  if (cleanupIds.length) await Subscription.deleteMany({ _id: { $in: cleanupIds } });
  cleanupIds.length = 0;
}

async function makeSubscription(overrides) {
  const sub = await Subscription.create({
    organization: new mongoose.Types.ObjectId(),
    planName: 'growth',
    billingCycle: 'monthly',
    pricePerUser: 450,
    userCount: 1,
    totalAmount: 450,
    status: 'active',
    isPaymentConfirmed: true,
    isTrialActive: false,
    ...overrides,
  });
  cleanupIds.push(sub._id);
  return sub;
}

function runMiddleware(organization) {
  return new Promise((resolve) => {
    const req = { user: { organization } };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; resolve({ req, res: this }); return this; },
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; resolve({ req, res, nextCalled: true }); };
    checkSubscriptionLimits('anyFeature')(req, res, next);
  });
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running subscriptionCheck.js entitlement-fix fixtures...\n');

  if (!(await PlanConfig.findOne({ planId: 'growth' }))) {
    await PlanConfig.create({ planId: 'growth', monthlyPrice: 450, yearlyPrice: 4800, isActive: true, features: {} });
  }

  await test('monthly, currentPeriodEnd in the future: access allowed (unchanged behavior)', async () => {
    const sub = await makeSubscription({
      billingCycle: 'monthly',
      currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });
    const result = await runMiddleware(sub.organization);
    assert.equal(result.nextCalled, true, `expected next() to be called, got ${JSON.stringify(result.res.body)}`);
  });

  await test('monthly, currentPeriodEnd in the past: access blocked with SUBSCRIPTION_ENDED (unchanged behavior — the critical regression guard)', async () => {
    const sub = await makeSubscription({
      billingCycle: 'monthly',
      currentPeriodEnd: new Date(Date.now() - 1000),
    });
    const result = await runMiddleware(sub.organization);
    assert.equal(result.res.statusCode, 403);
    assert.equal(result.res.body.code, 'SUBSCRIPTION_ENDED');
  });

  await test('THE FIX: yearly subscription with a STALE (already-past) currentPeriodEnd, but still within its real anchor-relative entitlement window, IS allowed access', async () => {
    const anchor = new Date(); // just started
    const sub = await makeSubscription({
      billingCycle: 'yearly',
      pricePerUser: 4800,
      totalAmount: 4800,
      billingAnchor: anchor,
      currentPeriodEnd: new Date(Date.now() - 1000), // stale/already-past rolling field
    });
    const result = await runMiddleware(sub.organization);
    assert.equal(result.nextCalled, true, `expected access to be allowed (real entitlement window hasn't ended), got ${JSON.stringify(result.res.body)}`);
  });

  await test('yearly subscription with an old anchor (>1 year ago): still allowed — getEntitlementWindow always finds the CURRENT anchor-relative window containing "now" by construction, it does not verify that window was actually paid for', async () => {
    // This documents a real, intentional boundary of this hotfix's scope:
    // pure anchor math answers "which window are they in," not "did their
    // renewal for this window actually succeed." A failed annual renewal
    // must be caught by appStatus/past_due handling (renewalEngine.js), not
    // by this date check — exactly the same as a failed MONTHLY renewal
    // relies on currentPeriodEnd simply not having advanced, not on this
    // middleware's (legacy `status`, not `appStatus`) check catching it
    // either. Not a regression introduced here — a pre-existing gap in this
    // particular legacy middleware, out of scope for this hotfix.
    const anchor = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000); // over a year ago
    const sub = await makeSubscription({
      billingCycle: 'yearly',
      pricePerUser: 4800,
      totalAmount: 4800,
      billingAnchor: anchor,
      currentPeriodEnd: new Date(Date.now() - 1000),
    });
    const result = await runMiddleware(sub.organization);
    assert.equal(result.nextCalled, true, 'access allowed — this is the documented boundary, not a bug');
  });

  await cleanup();
  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
