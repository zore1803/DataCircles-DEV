// scripts/traceDowngradeFourCases.js
//
// Verifies the 4 downgrade carry-forward scenarios from review:
//   1. No scheduled removals -> full carry-forward (Seat x2)
//   2. 1 already scheduled removal -> carry-forward Seat x1
//   3. Both already scheduled -> nothing carries forward, recurring = base only
// Tests against checkAddonCompatibility (the actual preview endpoint).
//
// Run with: CONFIRM_TEST_DB=yes node scripts/traceDowngradeFourCases.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const ScheduledChange = require('../models/ScheduledChange');
const { checkAddonCompatibility } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

async function makeSub(org, scheduledRemovalQty) {
  const sub = await Subscription.create({
    organization: org._id, planName: 'business', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 650, userCount: 1, totalAmount: 650,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    activeAddons: [{ addonKey: 'seat', quantity: 2, pricePerUnit: 100 }],
    pendingAddonRemovals: scheduledRemovalQty > 0 ? [{
      addonKey: 'seat', displayName: 'Seat', quantity: scheduledRemovalQty, pricePerUnit: 100,
      scheduledAt: new Date(), effectiveAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    }] : [],
  });
  if (scheduledRemovalQty > 0) {
    await ScheduledChange.create({
      organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING',
      effectiveAt: sub.currentPeriodEnd, payload: { addonKey: 'seat', quantity: scheduledRemovalQty },
    });
  }
  return sub;
}

async function preview(org) {
  let jsonBody;
  const req = { user: { organization: org._id }, query: { targetPlanId: 'growth', billingCycle: 'monthly' } };
  const res = { status() { return this; }, json(b) { jsonBody = b; return this; } };
  await checkAddonCompatibility(req, res);
  return jsonBody;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.\n');
  const org = await Organization.create({ name: 'Downgrade 4-Case Fixture', code: 'downgrade-4c-' + Date.now() });

  let passed = 0, failed = 0;
  async function test(name, scheduledQty, expectedQty) {
    const sub = await makeSub(org, scheduledQty);
    const resp = await preview(org);
    const carried = (resp.compatibleCarryForward || []).find((a) => a.addonKey === 'seat');
    const actualQty = carried?.quantity ?? 0;
    console.log(`${name}: scheduled=${scheduledQty} -> carryForward=${actualQty} (expected ${expectedQty})`);
    try {
      assert.equal(actualQty, expectedQty);
      passed++;
    } catch (e) {
      console.error(`  FAIL: ${e.message}`);
      failed++;
    }
    await ScheduledChange.deleteMany({ subscription: sub._id });
    await Subscription.deleteMany({ _id: sub._id });
  }

  await test('Case 1 (no scheduled removals)', 0, 2);
  await test('Case 2 (1 already scheduled)', 1, 1);
  await test('Case 3 (both already scheduled)', 2, 0);

  console.log(`\n${passed} passed, ${failed} failed`);
  await Organization.deleteMany({ _id: org._id });
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
})().catch(async (e) => {
  console.error('FATAL', e);
  await mongoose.disconnect();
  process.exit(1);
});
