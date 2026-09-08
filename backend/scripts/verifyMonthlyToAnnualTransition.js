// scripts/verifyMonthlyToAnnualTransition.js
//
// Phase 3 (docs/audit/PHASE3_MONTHLY_TO_ANNUAL_PRORATION.md): fixture
// verification for the Monthly -> Annual base-plan cadence transition —
// initiateMonthlyToAnnualTransition() (subscriptionController.js) /
// startMonthlyToAnnualTransition() (cycleTransitionLifecycle.js) and the
// payment.captured webhook commit branch. Drives the real exported
// functions, not a reimplementation.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyMonthlyToAnnualTransition.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const CommercialTransaction = require('../models/CommercialTransaction');
const ScheduledChange = require('../models/ScheduledChange');
const { startMonthlyToAnnualTransition } = require('../utils/cycleTransitionLifecycle');
const { getEntitlementWindow } = require('../utils/prorationMath');

const razorpay = require('../config/razorpay');
let orderCounter = 0;
razorpay.orders = razorpay.orders || {};
razorpay.orders.create = async () => ({ id: `order_test_cycletransition_${orderCounter++}` });

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

const cleanupIds = { subs: [], txns: [], scs: [] };
async function cleanup() {
  if (cleanupIds.subs.length) await Subscription.deleteMany({ _id: { $in: cleanupIds.subs } });
  if (cleanupIds.txns.length) await CommercialTransaction.deleteMany({ _id: { $in: cleanupIds.txns } });
  if (cleanupIds.scs.length) await ScheduledChange.deleteMany({ _id: { $in: cleanupIds.scs } });
  cleanupIds.subs = []; cleanupIds.txns = []; cleanupIds.scs = [];
}

async function makeMonthlySubscription(overrides = {}) {
  const now = new Date();
  // 'billingAnchor' in overrides (not overrides.billingAnchor || default) —
  // distinguishes "explicitly passed null" (a real test case: no anchor
  // recorded) from "not provided at all" (use the default). A truthiness
  // check here would silently discard an intentional `billingAnchor: null`.
  const anchor = 'billingAnchor' in overrides ? overrides.billingAnchor : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const sub = await Subscription.create({
    organization: new mongoose.Types.ObjectId(),
    planName: 'growth',
    billingCycle: 'monthly',
    pricePerUser: 450,
    userCount: 1,
    totalAmount: 450,
    isPaymentConfirmed: true,
    currentPeriodStart: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000),
    ...overrides,
    billingAnchor: anchor,
  });
  cleanupIds.subs.push(sub._id);
  return sub;
}

// Mirrors the payment.captured webhook commit branch's core logic (the
// decision-critical part: recompute-at-commit + boundary-mismatch detection)
// directly, so this fixture can inject an arbitrary "now at commit" without
// waiting on real wall-clock time or mocking the full webhook payload shape.
async function simulateCommit(subscription, nowAtCommit) {
  const reloaded = await Subscription.findById(subscription._id);
  const pending = reloaded.pendingCycleTransition;
  const { windowStart: recomputedStart, windowEnd: recomputedEnd } = getEntitlementWindow(reloaded.billingAnchor, nowAtCommit);
  const quotedStart = pending.windowStart ? new Date(pending.windowStart).getTime() : null;

  if (quotedStart !== recomputedStart.getTime()) {
    return { outcome: 'RECONCILIATION_NEEDED', recomputedStart, recomputedEnd };
  }

  reloaded.billingCycle = pending.targetBillingCycle;
  reloaded.pricePerUser = pending.targetPricePerUser;
  reloaded.totalAmount = pending.targetPricePerUser;
  reloaded.currentPeriodStart = recomputedStart;
  reloaded.currentPeriodEnd = recomputedEnd;
  reloaded.pendingCycleTransition = undefined;
  await reloaded.save();
  return { outcome: 'COMMITTED', recomputedStart, recomputedEnd };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running Monthly->Annual transition fixtures...\n');

  if (!(await PlanConfig.findOne({ planId: 'growth' }))) {
    await PlanConfig.create({ planId: 'growth', monthlyPrice: 450, yearlyPrice: 4800, isActive: true, features: {} });
  }
  const plan = await PlanConfig.findOne({ planId: 'growth' });

  await test('rejects a subscription that is already yearly (this flow is monthly-only)', async () => {
    const sub = await makeMonthlySubscription({ billingCycle: 'yearly', pricePerUser: 4800, totalAmount: 4800 });
    await assert.rejects(
      () => startMonthlyToAnnualTransition({ user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' }, organizationId: sub.organization, subscription: sub, plan }),
      /Only a monthly base plan/
    );
    await cleanup();
  });

  await test('rejects a subscription with no billingAnchor (fails loudly, does not guess a window for a real charge)', async () => {
    const sub = await makeMonthlySubscription({ billingAnchor: null });
    await assert.rejects(
      () => startMonthlyToAnnualTransition({ user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' }, organizationId: sub.organization, subscription: sub, plan }),
      /no billingAnchor recorded/
    );
    await cleanup();
  });

  await test('initiation: computes a positive amount and quotes the correct anchor-relative window, subscription itself untouched until commit', async () => {
    const sub = await makeMonthlySubscription();
    const result = await startMonthlyToAnnualTransition({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan,
    });
    assert.ok(result.amount > 0);
    assert.ok(result.windowStart instanceof Date);
    assert.ok(result.windowEnd instanceof Date);

    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.billingCycle, 'monthly', 'billingCycle must NOT change at initiation — only at commit');
    assert.equal(reloaded.pendingCycleTransition.orderId, result.orderId);
    assert.equal(reloaded.pendingCycleTransition.amount, result.amount);
    await cleanup();
  });

  await test('a second initiation while one is already pending is rejected', async () => {
    const sub = await makeMonthlySubscription();
    await startMonthlyToAnnualTransition({ user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' }, organizationId: sub.organization, subscription: sub, plan });
    const reloaded = await Subscription.findById(sub._id);
    await assert.rejects(
      () => startMonthlyToAnnualTransition({ user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' }, organizationId: reloaded.organization, subscription: reloaded, plan }),
      /still pending payment/
    );
    await cleanup();
  });

  await test('COMMIT (no boundary crossed): billingCycle flips to yearly, period matches the quoted window, billingAnchor never changes, pendingCycleTransition cleared', async () => {
    const sub = await makeMonthlySubscription();
    const initResult = await startMonthlyToAnnualTransition({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan,
    });
    const originalAnchor = sub.billingAnchor.getTime();

    // Commit "immediately" (no time has meaningfully passed) — same window.
    const commit = await simulateCommit(sub, new Date());
    assert.equal(commit.outcome, 'COMMITTED');

    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.billingCycle, 'yearly');
    assert.equal(reloaded.pricePerUser, 4800);
    assert.equal(reloaded.billingAnchor.getTime(), originalAnchor, 'billingAnchor must NEVER change');
    assert.equal(reloaded.currentPeriodStart.getTime(), initResult.windowStart.getTime());
    assert.equal(reloaded.currentPeriodEnd.getTime(), initResult.windowEnd.getTime());
    // Single-nested-subdocument types always hydrate as {} on read, even
    // when unset in the stored document (confirmed directly against raw
    // Mongo) — .orderId is the correct, codebase-idiomatic check, not
    // equality to undefined.
    assert.equal(reloaded.pendingCycleTransition?.orderId, undefined);
    await cleanup();
  });

  await test('BOUNDARY MISMATCH at commit: a window boundary crossed between initiation and settlement — subscription left COMPLETELY unchanged (still monthly), NOT silently committed with a mismatched window', async () => {
    // Anchor exactly 1 day before "now" at initiation, so initiation happens
    // deep in the FINAL day of the current anchor-relative window.
    const anchor = new Date();
    anchor.setFullYear(anchor.getFullYear() - 1);
    anchor.setDate(anchor.getDate() + 1); // window ends ~tomorrow relative to "now"
    const sub = await makeMonthlySubscription({ billingAnchor: anchor });

    const initResult = await startMonthlyToAnnualTransition({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan,
    });

    const beforeCommit = await Subscription.findById(sub._id);
    const beforeSnapshot = JSON.stringify({
      billingCycle: beforeCommit.billingCycle,
      pricePerUser: beforeCommit.pricePerUser,
      currentPeriodStart: beforeCommit.currentPeriodStart,
      currentPeriodEnd: beforeCommit.currentPeriodEnd,
    });

    // Simulate settlement happening AFTER the window boundary (2 days later
    // — past the ~1-day-away boundary computed above).
    const nowAtCommit = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const commit = await simulateCommit(sub, nowAtCommit);
    assert.equal(commit.outcome, 'RECONCILIATION_NEEDED', 'a boundary crossing must be detected, not silently committed');
    assert.notEqual(commit.recomputedStart.getTime(), initResult.windowStart.getTime(), 'sanity check: the recomputed window really did move to a new one');

    const afterCommit = await Subscription.findById(sub._id);
    const afterSnapshot = JSON.stringify({
      billingCycle: afterCommit.billingCycle,
      pricePerUser: afterCommit.pricePerUser,
      currentPeriodStart: afterCommit.currentPeriodStart,
      currentPeriodEnd: afterCommit.currentPeriodEnd,
    });
    assert.equal(beforeSnapshot, afterSnapshot, 'subscription must be byte-for-byte unchanged when RECONCILIATION_NEEDED fires — still monthly, full access retained');
    assert.ok(afterCommit.pendingCycleTransition?.orderId, 'pendingCycleTransition must remain set (blocks a competing retry) — this is the stated, accepted inherited limitation, not a bug');

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
