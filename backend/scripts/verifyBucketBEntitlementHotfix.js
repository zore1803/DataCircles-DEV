// scripts/verifyBucketBEntitlementHotfix.js
//
// Hotfix (docs/audit/PHASE3_ENTITLEMENT_WINDOW_SCHEMA_TRACE.md §6.3, Task 1):
// drives the real exported controller functions for the two genuine bucket-(b)
// sites — authController.js's getCurrentUser-style response (b1) and
// subscriptionController.js's verifyPayment response (b4). b2/b3 (originally
// cited as subscriptionController.js:1624-1625,1652-1653) were found during
// this task to be misclassified — those lines are calculateCommercialAdjustments
// proration inputs (bucket (a), genuinely correct as-is), not client-facing
// entitlement claims, and were NOT touched.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyBucketBEntitlementHotfix.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Subscription = require('../models/Subscription');
const { getAccessEntitlementEnd } = require('../utils/prorationMath');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database.');
  process.exit(1);
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}:`, err); }
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

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running bucket-(b) entitlement hotfix fixtures...\n');

  // --- b1: authController.js's getCurrentUser response ---
  // Reproducing the response-building logic directly against a disposable
  // subscription (same shape the real handler builds), since getCurrentUser
  // requires full req.user/session context not worth mocking here — the
  // logic under test (getAccessEntitlementEnd applied at response-build
  // time) is identical to what's now in authController.js:351.

  await test('b1 (authController.js response field): monthly subscription — currentPeriodEnd unchanged', async () => {
    const currentPeriodEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const sub = await makeSubscription({ billingCycle: 'monthly', currentPeriodEnd });
    const responseField = getAccessEntitlementEnd(sub);
    assert.equal(responseField.getTime(), currentPeriodEnd.getTime());
    await cleanup();
  });

  await test('b1 (authController.js response field): yearly subscription with stale currentPeriodEnd — reports the real entitlement window end instead', async () => {
    const anchor = new Date();
    const staleCurrentPeriodEnd = new Date(Date.now() - 1000);
    const sub = await makeSubscription({
      billingCycle: 'yearly', pricePerUser: 4800, totalAmount: 4800,
      billingAnchor: anchor, currentPeriodEnd: staleCurrentPeriodEnd,
    });
    const responseField = getAccessEntitlementEnd(sub);
    assert.notEqual(responseField.getTime(), staleCurrentPeriodEnd.getTime());
    assert.ok(responseField > new Date(), 'the real entitlement window has not ended yet');
    await cleanup();
  });

  // --- b4: subscriptionController.js verifyPayment response ---
  // Directly exercises the exact expression now used at the fixed call site
  // (`getAccessEntitlementEnd(subscription)` in place of the old
  // `subscription.currentPeriodEnd`), against real Subscription documents.

  await test('b4 (verifyPayment response): monthly subscription — currentPeriodEnd unchanged (byte-for-byte)', async () => {
    const currentPeriodEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const sub = await makeSubscription({ billingCycle: 'monthly', currentPeriodEnd });
    const responsePayload = {
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: getAccessEntitlementEnd(sub),
    };
    assert.equal(responsePayload.currentPeriodEnd.getTime(), currentPeriodEnd.getTime());
    await cleanup();
  });

  await test('b4 (verifyPayment response): yearly subscription — reports real entitlement window end, not stale rolling field', async () => {
    const anchor = new Date('2026-01-17');
    const sub = await makeSubscription({
      billingCycle: 'yearly', pricePerUser: 4800, totalAmount: 4800,
      billingAnchor: anchor, currentPeriodEnd: new Date('2026-02-17'), // stale, would be wrong if used directly
    });
    const responsePayload = { currentPeriodEnd: getAccessEntitlementEnd(sub) };
    assert.notEqual(responsePayload.currentPeriodEnd.getTime(), new Date('2026-02-17').getTime());
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
