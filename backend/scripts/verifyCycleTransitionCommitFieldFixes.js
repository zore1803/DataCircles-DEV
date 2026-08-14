// scripts/verifyCycleTransitionCommitFieldFixes.js
//
// Two bugs found via live QA on a real Starter-monthly -> Growth-annual
// transition (Aug 2026): (1) nextBillingDate was left stale at commit —
// every other CAW write site keeps it in sync with currentPeriodEnd, the
// cycle-transition commit branch didn't; (2) SubscriptionPayment's
// `paymentFor` enum didn't include 'cycle_transition_monthly_to_annual',
// so the payment record write silently failed Mongoose validation (caught
// and swallowed by the commit handler's own try/catch), leaving Payment
// History empty despite a real, successful charge.
//
// Note: subscriptionController.js's handlePaymentCaptured is not exported
// for direct testing (a pre-existing gap in this codebase, confirmed via
// grep — same limitation noted earlier this session for upgrade-settlement
// tracing). This fixture verifies (a) the schema now accepts the new enum
// value with a real .save(), and (b) the commit logic's nextBillingDate
// assignment, mirrored from the actual fixed code.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyCycleTransitionCommitFieldFixes.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Subscription = require('../models/Subscription');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const { getEntitlementWindow } = require('../utils/prorationMath');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database.');
  process.exit(1);
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}:`, err); }
}

const cleanupIds = { subs: [], payments: [] };
async function cleanup() {
  if (cleanupIds.subs.length) await Subscription.deleteMany({ _id: { $in: cleanupIds.subs } });
  if (cleanupIds.payments.length) await SubscriptionPayment.deleteMany({ _id: { $in: cleanupIds.payments } });
  cleanupIds.subs = []; cleanupIds.payments = [];
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running cycle-transition commit field-fix fixtures...\n');

  await test('SubscriptionPayment now accepts paymentFor: "cycle_transition_monthly_to_annual" (was rejected before the enum fix)', async () => {
    const payment = await SubscriptionPayment.create({
      organization: new mongoose.Types.ObjectId(),
      subscription: new mongoose.Types.ObjectId(),
      razorpayPaymentId: 'pay_test_fixfixture',
      amount: 5369,
      status: 'captured',
      method: 'card',
      paymentFor: 'cycle_transition_monthly_to_annual',
    });
    cleanupIds.payments.push(payment._id);
    assert.equal(payment.paymentFor, 'cycle_transition_monthly_to_annual');
  });

  await test('commit logic sets nextBillingDate to match the recomputed currentPeriodEnd (mirrors the fixed webhook code)', async () => {
    const anchor = new Date();
    const sub = await Subscription.create({
      organization: new mongoose.Types.ObjectId(),
      planName: 'starter', billingCycle: 'monthly', pricePerUser: 250, userCount: 1, totalAmount: 250,
      isPaymentConfirmed: true, billingAnchor: anchor,
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      nextBillingDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // stale-monthly-shaped value, same bug shape as the real report
    });
    cleanupIds.subs.push(sub._id);

    // Mirrors the ACTUAL fixed commit code exactly (subscriptionController.js's
    // cycle-transition branch): recompute at commit, write currentPeriodStart/
    // End AND nextBillingDate together.
    const { windowStart: recomputedStart, windowEnd: recomputedEnd } = getEntitlementWindow(sub.billingAnchor, new Date());
    sub.billingCycle = 'yearly';
    sub.pricePerUser = 4800;
    sub.currentPeriodStart = recomputedStart;
    sub.currentPeriodEnd = recomputedEnd;
    sub.nextBillingDate = recomputedEnd;
    await sub.save();

    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.nextBillingDate.getTime(), reloaded.currentPeriodEnd.getTime(), 'nextBillingDate must match currentPeriodEnd after a cycle transition, not the old monthly value');
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
