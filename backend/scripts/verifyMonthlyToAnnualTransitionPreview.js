// scripts/verifyMonthlyToAnnualTransitionPreview.js
//
// The missing frontend requirement, per live QA feedback (Aug 2026): a
// pre-payment confirmation screen explaining the Monthly->Annual transition
// calculation before Razorpay checkout opens. This verifies the read-only
// preview function backing that screen — previewMonthlyToAnnualTransition()
// (cycleTransitionLifecycle.js) — computes the SAME numbers the real
// transaction-creating flow would, without creating any Order,
// CommercialTransaction, or subscription mutation.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyMonthlyToAnnualTransitionPreview.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Subscription = require('../models/Subscription');
const CommercialTransaction = require('../models/CommercialTransaction');
const PlanConfig = require('../models/PlanConfig');
const { previewMonthlyToAnnualTransition, startMonthlyToAnnualTransition } = require('../utils/cycleTransitionLifecycle');

const razorpay = require('../config/razorpay');
let orderCounter = 0;
razorpay.orders = razorpay.orders || {};
razorpay.orders.create = async () => ({ id: `order_test_previewfixture_${orderCounter++}` });

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database.');
  process.exit(1);
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}:`, err); }
}

const cleanupIds = { subs: [] };
async function cleanup() {
  if (cleanupIds.subs.length) await Subscription.deleteMany({ _id: { $in: cleanupIds.subs } });
  cleanupIds.subs = [];
}

async function makeMonthlySubscription(planName, overrides = {}) {
  const now = new Date();
  const anchor = 'billingAnchor' in overrides ? overrides.billingAnchor : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const plan = await PlanConfig.findOne({ planId: planName });
  const sub = await Subscription.create({
    organization: new mongoose.Types.ObjectId(),
    planName, billingCycle: 'monthly', pricePerUser: plan.monthlyPrice, userCount: 1,
    totalAmount: plan.monthlyPrice, isPaymentConfirmed: true,
    currentPeriodStart: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000),
    ...overrides, billingAnchor: anchor,
  });
  cleanupIds.subs.push(sub._id);
  return sub;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running Monthly->Annual transition PREVIEW fixtures...\n');

  const starter = await PlanConfig.findOne({ planId: 'starter' });
  const growth = await PlanConfig.findOne({ planId: 'growth' });

  await test('preview creates NOTHING — no CommercialTransaction, no pendingCycleTransition, subscription completely untouched', async () => {
    const countBefore = await CommercialTransaction.countDocuments({});
    const sub = await makeMonthlySubscription('starter');
    const preview = await previewMonthlyToAnnualTransition({ subscription: sub, plan: growth });
    assert.ok(preview.amount > 0);
    const countAfter = await CommercialTransaction.countDocuments({});
    assert.equal(countAfter, countBefore, 'preview must not create a CommercialTransaction');
    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.pendingCycleTransition?.orderId, undefined, 'preview must not set pendingCycleTransition');
    assert.equal(reloaded.billingCycle, 'monthly', 'preview must not mutate the subscription at all');
    await cleanup();
  });

  await test('preview amount EXACTLY matches what the real transaction-creating flow would charge (single source of truth, not two calculations)', async () => {
    const sub = await makeMonthlySubscription('starter');
    const preview = await previewMonthlyToAnnualTransition({ subscription: sub, plan: growth });

    const reloaded = await Subscription.findById(sub._id); // unaffected by the preview, still monthly
    const real = await startMonthlyToAnnualTransition({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: reloaded.organization, subscription: reloaded, plan: growth,
    });
    assert.equal(preview.amount, real.amount, 'preview and real commit must charge the identical amount');
    assert.equal(preview.windowStart.getTime(), real.windowStart.getTime());
    assert.equal(preview.windowEnd.getTime(), real.windowEnd.getTime());
    await cleanup();
  });

  await test('preview exposes the itemized breakdown the confirmation screen needs (newAnnualValue - unusedMonthlyValue = amount, before GST)', async () => {
    const sub = await makeMonthlySubscription('starter');
    const preview = await previewMonthlyToAnnualTransition({ subscription: sub, plan: growth });
    assert.equal(preview.fromPlanId, 'starter');
    assert.equal(preview.toPlanId, 'growth');
    assert.ok(preview.newAnnualValue > 0);
    assert.ok(preview.unusedMonthlyValue >= 0);
    // amount is the GST-inclusive total; the pre-GST net should equal
    // newAnnualValue - unusedMonthlyValue, floored at 1 — confirms the
    // exposed breakdown values are the actual ones used, not decorative.
    const expectedPreGST = Math.max(1, preview.newAnnualValue - preview.unusedMonthlyValue);
    assert.ok(Math.abs(preview.pricingBreakdown.taxableAmount - expectedPreGST) < 2, `pre-GST taxable amount should reconcile with newAnnualValue - unusedMonthlyValue, got taxable=${preview.pricingBreakdown.taxableAmount} expected=${expectedPreGST}`);
    await cleanup();
  });

  await test('preview reports monthsCompleted/monthsIntoWindow for the "17 months elapsed, 5 into your window" style explanation', async () => {
    const anchor = new Date(Date.now() - 17 * 30.44 * 24 * 60 * 60 * 1000); // ~17 months ago
    const sub = await makeMonthlySubscription('starter', { billingAnchor: anchor });
    const preview = await previewMonthlyToAnnualTransition({ subscription: sub, plan: growth });
    assert.ok(preview.monthsCompleted >= 15 && preview.monthsCompleted <= 19, `expected ~17 months completed, got ${preview.monthsCompleted}`);
    assert.ok(preview.monthsIntoWindow >= 3 && preview.monthsIntoWindow <= 7, `expected ~5 months into the second window, got ${preview.monthsIntoWindow}`);
    await cleanup();
  });

  await test('preview correctly blocks a cross-tier downgrade preview when current usage exceeds target limits (same gate as the real commit)', async () => {
    const User = require('../models/User');
    const business = await PlanConfig.findOne({ planId: 'business' });
    const starterPlan = await PlanConfig.findOne({ planId: 'starter' });
    const sub = await makeMonthlySubscription('business');
    const users = [];
    for (let i = 0; i < 3; i++) {
      const u = await User.create({ name: `U${i}`, email: `preview_test_${sub.organization}_${i}@test.com`, password: 'x', organization: sub.organization, role: 'staff' });
      users.push(u._id);
    }
    await assert.rejects(
      () => previewMonthlyToAnnualTransition({ subscription: sub, plan: starterPlan }),
      (err) => { assert.equal(err.code, 'DOWNGRADE_INELIGIBLE'); return true; }
    );
    await User.deleteMany({ _id: { $in: users } });
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
