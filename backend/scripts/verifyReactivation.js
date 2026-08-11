// scripts/verifyReactivation.js
//
// Task 3 (Aug 2026): fixture verification for resuming a LAPSED subscription
// — previewReactivation()/startReactivation() (utils/reactivationLifecycle.js)
// and the payment.captured webhook commit branch (subscriptionController.js).
// Drives the real exported initiation functions; the commit branch is
// simulated with the same reimplemented-inline pattern this codebase already
// uses for the equivalent cycle-transition commit fixture
// (verifyMonthlyToAnnualTransition.js's own simulateCommit helper).
//
// Explicit assumption under test (stated, not silently picked): lapsed time
// is NOT charged for. An annual reactivation charges only the REMAINING
// portion of whichever anchor-relative window "now" falls into — nothing for
// the lapsed portion behind it, and no fresh 12-month price. A monthly
// reactivation is a fresh full-price single-month period starting today.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyReactivation.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const CommercialTransaction = require('../models/CommercialTransaction');
const { previewReactivation, startReactivation } = require('../utils/reactivationLifecycle');
const { getEntitlementWindow, addCalendarMonths } = require('../utils/prorationMath');

const razorpay = require('../config/razorpay');
let orderCounter = 0;
razorpay.orders = razorpay.orders || {};
razorpay.orders.create = async () => ({ id: `order_test_reactivation_${orderCounter++}` });

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database.');
  process.exit(1);
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}:`, err); }
}

const cleanupIds = { subs: [], orgs: [], txns: [] };
async function cleanup() {
  if (cleanupIds.txns.length) await CommercialTransaction.deleteMany({ _id: { $in: cleanupIds.txns } });
  if (cleanupIds.subs.length) await Subscription.deleteMany({ _id: { $in: cleanupIds.subs } });
  if (cleanupIds.orgs.length) await Organization.deleteMany({ _id: { $in: cleanupIds.orgs } });
  cleanupIds.subs = []; cleanupIds.orgs = []; cleanupIds.txns = [];
}

async function makeLapsedSubscription(overrides = {}) {
  const org = await Organization.create({ name: 'Reactivation Fixture', code: 'react-lapse-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) });
  cleanupIds.orgs.push(org._id);

  const anchor = ('billingAnchor' in overrides) ? overrides.billingAnchor : (() => {
    const a = new Date();
    a.setFullYear(a.getFullYear() - 1);
    a.setMonth(a.getMonth() - 5); // 17 months ago — mid-way into the second annual window
    return a;
  })();

  const sub = await Subscription.create({
    organization: org._id, planName: 'growth', appStatus: 'cancelled', status: 'cancelled',
    billingCycle: 'yearly', pricePerUser: 4800, userCount: 1, totalAmount: 4800,
    isPaymentConfirmed: false, paymentStatus: 'payment_failed',
    cancelAtPeriodEnd: true, cancelledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    currentPeriodStart: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    billingAnchor: anchor,
    ...overrides,
  });
  cleanupIds.subs.push(sub._id);
  return sub;
}

async function simulateCommit(subscription, targetBillingCycle, nowAtCommit) {
  const reloaded = await Subscription.findById(subscription._id);
  const pending = reloaded.pendingReactivation;

  let recomputedStart, recomputedEnd;
  if (targetBillingCycle === 'yearly') {
    const recomputed = getEntitlementWindow(reloaded.billingAnchor, nowAtCommit);
    const quotedStart = pending.windowStart ? new Date(pending.windowStart).getTime() : null;
    if (quotedStart !== recomputed.windowStart.getTime()) {
      return { outcome: 'RECONCILIATION_NEEDED', recomputedStart: recomputed.windowStart, recomputedEnd: recomputed.windowEnd };
    }
    recomputedStart = recomputed.windowStart;
    recomputedEnd = recomputed.windowEnd;
  } else {
    recomputedStart = nowAtCommit;
    recomputedEnd = addCalendarMonths(nowAtCommit, 1);
  }

  reloaded.planName = pending.targetPlanId;
  reloaded.billingCycle = pending.targetBillingCycle;
  reloaded.pricePerUser = pending.targetPricePerUser;
  reloaded.totalAmount = pending.targetPricePerUser;
  reloaded.currentPeriodStart = recomputedStart;
  reloaded.currentPeriodEnd = recomputedEnd;
  reloaded.cancelAtPeriodEnd = false;
  reloaded.isPaymentConfirmed = true;
  reloaded.appStatus = 'active';
  reloaded.pendingReactivation = undefined;
  await reloaded.save();
  return { outcome: 'COMMITTED', recomputedStart, recomputedEnd };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running reactivation fixtures...\n');

  if (!(await PlanConfig.findOne({ planId: 'growth' }))) {
    await PlanConfig.create({ planId: 'growth', monthlyPrice: 450, yearlyPrice: 4800, isActive: true, features: {} });
  }
  const plan = await PlanConfig.findOne({ planId: 'growth' });

  await test('rejects a subscription that has not actually lapsed (appStatus still active)', async () => {
    const sub = await makeLapsedSubscription({ appStatus: 'active', cancelAtPeriodEnd: false });
    await assert.rejects(
      () => previewReactivation({ subscription: sub, plan, billingCycle: 'yearly' }),
      /has not lapsed/
    );
    await cleanup();
  });

  await test('rejects a yearly reactivation with no billingAnchor (fails loudly, does not guess a window for a real charge)', async () => {
    const sub = await makeLapsedSubscription({ billingAnchor: null });
    await assert.rejects(
      () => previewReactivation({ subscription: sub, plan, billingCycle: 'yearly' }),
      /billingAnchor/
    );
    await cleanup();
  });

  await test('PREVIEW == INITIATE: annual reactivation amount matches exactly (single source of truth)', async () => {
    const sub = await makeLapsedSubscription();
    const preview = await previewReactivation({ subscription: sub, plan, billingCycle: 'yearly' });
    const initResult = await startReactivation({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan, billingCycle: 'yearly',
    });
    assert.equal(initResult.amount, preview.amount);
    assert.equal(preview.amount > 0, true);
    assert.equal(preview.amount < plan.yearlyPrice, true, 'remaining-window proration must charge LESS than a full fresh annual price, not the full ₹4,800');
    await cleanup();
  });

  await test('ANNUAL COMMIT (no boundary crossed): billingAnchor unchanged, subscription reactivated, charge is remaining-window proration off the ORIGINAL anchor — not a fresh 12-month price', async () => {
    const sub = await makeLapsedSubscription();
    const originalAnchor = sub.billingAnchor.getTime();

    const initResult = await startReactivation({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan, billingCycle: 'yearly',
    });
    assert.equal(initResult.amount < plan.yearlyPrice, true, 'must not be a fresh full annual price');

    const commit = await simulateCommit(sub, 'yearly', new Date());
    assert.equal(commit.outcome, 'COMMITTED');

    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.billingAnchor.getTime(), originalAnchor, 'billingAnchor must be BYTE-FOR-BYTE unchanged — this is the whole point of Task D\'s amendment');
    assert.equal(reloaded.appStatus, 'active');
    assert.equal(reloaded.cancelAtPeriodEnd, false);
    assert.equal(reloaded.billingCycle, 'yearly');
    assert.equal(reloaded.planName, 'growth');
    assert.equal(reloaded.currentPeriodStart.getTime(), initResult.windowStart.getTime());
    assert.equal(reloaded.currentPeriodEnd.getTime(), initResult.windowEnd.getTime());
    assert.equal(reloaded.pendingReactivation?.orderId, undefined);
    await cleanup();
  });

  await test('MONTHLY reactivation: fresh full-price single-month period starting today, anchor still untouched', async () => {
    const sub = await makeLapsedSubscription({ billingCycle: 'monthly', pricePerUser: 450, totalAmount: 450 });
    const originalAnchor = sub.billingAnchor.getTime();

    const preview = await previewReactivation({ subscription: sub, plan, billingCycle: 'monthly' });
    assert.equal(preview.amount, 450, 'monthly reactivation must be the flat full monthly price, no proration');

    const initResult = await startReactivation({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan, billingCycle: 'monthly',
    });
    assert.equal(initResult.amount, 450);

    const commit = await simulateCommit(sub, 'monthly', new Date());
    assert.equal(commit.outcome, 'COMMITTED');

    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.billingAnchor.getTime(), originalAnchor, 'billingAnchor must remain untouched even for a monthly reactivation');
    assert.equal(reloaded.appStatus, 'active');
    assert.equal(reloaded.billingCycle, 'monthly');
    await cleanup();
  });

  await test('a second reactivation initiation while one is already pending is rejected', async () => {
    const sub = await makeLapsedSubscription();
    await startReactivation({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan, billingCycle: 'yearly',
    });
    await assert.rejects(
      () => startReactivation({
        user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
        organizationId: sub.organization, subscription: sub, plan, billingCycle: 'yearly',
      }),
      /still pending payment/
    );
    await cleanup();
  });

  await test('BOUNDARY MISMATCH at commit: an anchor window boundary crossed between initiation and settlement — subscription left COMPLETELY unchanged (still lapsed), NOT silently committed with a mismatched window', async () => {
    // Anchor exactly 1 day before "now" at initiation, so initiation happens
    // deep in the FINAL day of the current anchor-relative window.
    const anchor = new Date();
    anchor.setFullYear(anchor.getFullYear() - 1);
    anchor.setDate(anchor.getDate() + 1);
    const sub = await makeLapsedSubscription({ billingAnchor: anchor });

    await startReactivation({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan, billingCycle: 'yearly',
    });

    const beforeCommit = await Subscription.findById(sub._id);
    const beforeSnapshot = JSON.stringify({ appStatus: beforeCommit.appStatus, billingCycle: beforeCommit.billingCycle, cancelAtPeriodEnd: beforeCommit.cancelAtPeriodEnd });

    // Settlement happens 2 days later — past the ~1-day-away boundary.
    const nowAtCommit = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const commit = await simulateCommit(sub, 'yearly', nowAtCommit);
    assert.equal(commit.outcome, 'RECONCILIATION_NEEDED', 'a boundary crossing must be detected, not silently committed');

    const afterCommit = await Subscription.findById(sub._id);
    const afterSnapshot = JSON.stringify({ appStatus: afterCommit.appStatus, billingCycle: afterCommit.billingCycle, cancelAtPeriodEnd: afterCommit.cancelAtPeriodEnd });
    assert.equal(afterSnapshot, beforeSnapshot, 'subscription must be left COMPLETELY unchanged — still lapsed, not reactivated with a mismatched window');
    await cleanup();
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
