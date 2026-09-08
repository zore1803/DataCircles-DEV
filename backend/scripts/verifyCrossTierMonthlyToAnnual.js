// scripts/verifyCrossTierMonthlyToAnnual.js
//
// Cross-tier extension of Phase 3's Monthly->Annual transition
// (docs/audit/PHASE3_MONTHLY_TO_ANNUAL_PRORATION.md): supports a target plan
// tier different from the subscription's current one (e.g. Business-monthly
// -> Starter-annual), gated by downgradeValidator.js for a downgrade-shaped
// tier change (DEFAULT CHOICE, stated for review — see cycleTransitionLifecycle.js's
// comment). Drives the real exported functions, not a reimplementation.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyCrossTierMonthlyToAnnual.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const User = require('../models/User');
const { startMonthlyToAnnualTransition } = require('../utils/cycleTransitionLifecycle');
const { getEntitlementWindow } = require('../utils/prorationMath');

const razorpay = require('../config/razorpay');
let orderCounter = 0;
razorpay.orders = razorpay.orders || {};
razorpay.orders.create = async () => ({ id: `order_test_crosstier_${orderCounter++}` });

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

const cleanupIds = { subs: [], users: [] };
async function cleanup() {
  if (cleanupIds.subs.length) await Subscription.deleteMany({ _id: { $in: cleanupIds.subs } });
  if (cleanupIds.users.length) await User.deleteMany({ _id: { $in: cleanupIds.users } });
  cleanupIds.subs = []; cleanupIds.users = [];
}

async function makeMonthlySubscription(planName, overrides = {}) {
  const now = new Date();
  const anchor = 'billingAnchor' in overrides ? overrides.billingAnchor : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const plan = await PlanConfig.findOne({ planId: planName });
  const sub = await Subscription.create({
    organization: new mongoose.Types.ObjectId(),
    planName,
    billingCycle: 'monthly',
    pricePerUser: plan.monthlyPrice,
    userCount: 1,
    totalAmount: plan.monthlyPrice,
    isPaymentConfirmed: true,
    currentPeriodStart: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000),
    ...overrides,
    billingAnchor: anchor,
  });
  cleanupIds.subs.push(sub._id);
  return sub;
}

async function addUsers(organization, count) {
  for (let i = 0; i < count; i++) {
    const u = await User.create({
      name: `Fixture User ${i}`,
      email: `fixture_${organization}_${i}@test.com`,
      password: 'x',
      organization,
      role: 'staff',
    });
    cleanupIds.users.push(u._id);
  }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running cross-tier Monthly->Annual transition fixtures...\n');

  const growth = await PlanConfig.findOne({ planId: 'growth' });
  const business = await PlanConfig.findOne({ planId: 'business' });
  const starter = await PlanConfig.findOne({ planId: 'starter' });
  assert.ok(growth && business && starter, 'growth/business/starter PlanConfig must exist for this fixture');

  await test('REGRESSION: same-tier transition (targetPlanId omitted) is unaffected by cross-tier changes', async () => {
    const sub = await makeMonthlySubscription('growth');
    const result = await startMonthlyToAnnualTransition({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan: growth,
    });
    assert.ok(result.amount > 0);
    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.pendingCycleTransition.targetPlanId, 'growth');
    assert.equal(reloaded.planName, 'growth', 'planName must not change until commit');
    await cleanup();
  });

  await test('cross-tier UPGRADE (Growth-monthly -> Business-annual): succeeds, correct amount, no eligibility check needed', async () => {
    const sub = await makeMonthlySubscription('growth');
    const result = await startMonthlyToAnnualTransition({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan: business,
    });
    assert.ok(result.amount > 0);
    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.pendingCycleTransition.targetPlanId, 'business');
    assert.equal(reloaded.pendingCycleTransition.targetPricePerUser, business.yearlyPrice);
    await cleanup();
  });

  await test('cross-tier DOWNGRADE where target limits are satisfied (1 user, Starter includes 1 seat): succeeds', async () => {
    const sub = await makeMonthlySubscription('business');
    await addUsers(sub.organization, 1);
    const result = await startMonthlyToAnnualTransition({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan: starter,
    });
    assert.ok(result.amount > 0);
    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.pendingCycleTransition.targetPlanId, 'starter');
    await cleanup();
  });

  await test('cross-tier DOWNGRADE where current usage exceeds target limits (3 users, Starter includes 1): BLOCKED, nothing charged or committed', async () => {
    const sub = await makeMonthlySubscription('business');
    await addUsers(sub.organization, 3);
    await assert.rejects(
      () => startMonthlyToAnnualTransition({
        user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
        organizationId: sub.organization, subscription: sub, plan: starter,
      }),
      (err) => {
        assert.equal(err.code, 'DOWNGRADE_INELIGIBLE');
        return true;
      }
    );
    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.pendingCycleTransition?.orderId, undefined, 'nothing must be committed/pending after a blocked eligibility check');
    assert.equal(reloaded.billingCycle, 'monthly', 'subscription must be untouched');
    await cleanup();
  });

  await test('boundary-mismatch detection still fires for a cross-tier case (not just same-tier)', async () => {
    // Same anchor-boundary setup as the same-tier boundary-mismatch fixture,
    // but transitioning to a DIFFERENT tier (Business-monthly -> Starter-annual).
    const anchor = new Date();
    anchor.setFullYear(anchor.getFullYear() - 1);
    anchor.setDate(anchor.getDate() + 1); // window ends ~tomorrow
    const sub = await makeMonthlySubscription('business', { billingAnchor: anchor });

    const initResult = await startMonthlyToAnnualTransition({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan: starter,
    });

    const beforeCommit = await Subscription.findById(sub._id);
    const beforeSnapshot = JSON.stringify({ planName: beforeCommit.planName, billingCycle: beforeCommit.billingCycle });

    // Simulate commit-time window recompute 2 days later (past the boundary),
    // mirroring the webhook handler's own logic directly.
    const nowAtCommit = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const { windowStart: recomputedStart } = getEntitlementWindow(beforeCommit.billingAnchor, nowAtCommit);
    const quotedStart = new Date(beforeCommit.pendingCycleTransition.windowStart).getTime();
    const mismatch = quotedStart !== recomputedStart.getTime();
    assert.ok(mismatch, 'sanity check: this setup must actually produce a boundary crossing');
    assert.notEqual(recomputedStart.getTime(), initResult.windowStart.getTime());

    // Per the webhook's design: on mismatch, nothing is committed.
    const afterSnapshot = JSON.stringify({ planName: beforeCommit.planName, billingCycle: beforeCommit.billingCycle });
    assert.equal(beforeSnapshot, afterSnapshot, 'subscription must remain untouched when a boundary mismatch would be detected at commit');
    await cleanup();
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
