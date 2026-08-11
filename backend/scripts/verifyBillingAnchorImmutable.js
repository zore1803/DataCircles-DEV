// scripts/verifyBillingAnchorImmutable.js
//
// Disposable-fixture check for Phase 1 of annual-billing groundwork
// (docs/audit/ANNUAL_BILLING_SCOPE.md): confirms billingAnchor is set exactly
// once by runFirstPaymentSettlement, and that a later attempt to overwrite it
// is actually rejected by Mongoose's `immutable: true`, not just assumed.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyBillingAnchorImmutable.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Subscription = require('../models/Subscription');
const { runFirstPaymentSettlement } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database.');
  process.exit(1);
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}: ${err.message}`); }
}

async function makeSubscription(overrides = {}) {
  return Subscription.create({
    organization: new mongoose.Types.ObjectId(),
    planName: 'starter',
    billingCycle: 'monthly',
    pricePerUser: 100,
    userCount: 1,
    totalAmount: 100,
    ...overrides,
  });
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running billingAnchor fixtures...\n');

  await test('new subscription has billingAnchor: null before first payment', async () => {
    const sub = await makeSubscription();
    assert.equal(sub.billingAnchor, null);
    await Subscription.deleteOne({ _id: sub._id });
  });

  await test('runFirstPaymentSettlement sets billingAnchor exactly once', async () => {
    const sub = await makeSubscription();
    await runFirstPaymentSettlement(sub);
    assert.ok(sub.billingAnchor instanceof Date, 'billingAnchor should be a Date after settlement');
    const reloaded = await Subscription.findById(sub._id);
    assert.ok(reloaded.billingAnchor instanceof Date, 'billingAnchor should persist to the DB');
    await Subscription.deleteOne({ _id: sub._id });
  });

  await test('calling runFirstPaymentSettlement again does not change billingAnchor (racing-path safety)', async () => {
    const sub = await makeSubscription();
    await runFirstPaymentSettlement(sub);
    const firstAnchor = sub.billingAnchor.getTime();
    await new Promise((r) => setTimeout(r, 10));
    await runFirstPaymentSettlement(sub);
    assert.equal(sub.billingAnchor.getTime(), firstAnchor, 'billingAnchor must not move on a second settlement call');
    await Subscription.deleteOne({ _id: sub._id });
  });

  await test('Mongoose immutable:true rejects a direct overwrite of an already-set billingAnchor', async () => {
    const sub = await makeSubscription({ billingAnchor: new Date('2026-01-01T00:00:00Z') });
    const original = sub.billingAnchor.getTime();
    sub.billingAnchor = new Date('2030-01-01T00:00:00Z');
    await sub.save();
    const reloaded = await Subscription.findById(sub._id);
    assert.equal(
      reloaded.billingAnchor.getTime(),
      original,
      'immutable:true should have silently discarded the overwrite attempt, but the new value persisted'
    );
    await Subscription.deleteOne({ _id: sub._id });
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
