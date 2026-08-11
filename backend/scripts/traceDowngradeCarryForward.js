// scripts/traceDowngradeCarryForward.js
//
// Regression fixture for the exact live-reported bug: Business + Seat x2,
// BOTH already scheduled for removal (fully consumed at renewal), then
// previewing a downgrade to Growth (which supports Seat) showed "Carrying
// forward Seat x2" — as if nothing had ever been scheduled.
//
// This preview is served by checkAddonCompatibility (NOT updateSubscription's
// downgrade branch — the frontend calls this endpoint directly for the
// downgrade confirmation modal). It never had the effective-state fix at
// all: it classified against raw activeAddons with no adjustment for
// already-scheduled removals.
//
// Expected: nothing should carry forward — both seats are already fully
// scheduled for removal by renewal, regardless of the plan change.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/traceDowngradeCarryForward.js

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

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.\n');

  const org = await Organization.create({ name: 'Downgrade Carry Forward Fixture', code: 'downgrade-cf-' + Date.now() });
  const sub = await Subscription.create({
    organization: org._id, planName: 'business', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 650, userCount: 1, totalAmount: 650,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    activeAddons: [{ addonKey: 'seat', quantity: 2, pricePerUnit: 100 }],
    pendingAddonRemovals: [{
      addonKey: 'seat', displayName: 'Seat', quantity: 2, pricePerUnit: 100,
      scheduledAt: new Date(), effectiveAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    }],
  });
  await ScheduledChange.create({
    organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING',
    effectiveAt: sub.currentPeriodEnd, payload: { addonKey: 'seat', quantity: 2 },
  });

  console.log('Fixture: Business + Seat x2, BOTH already scheduled for removal (fully consumed at renewal).');
  console.log('Calling checkAddonCompatibility(targetPlanId=growth)...\n');

  let jsonBody;
  const req = { user: { organization: org._id }, query: { targetPlanId: 'growth', billingCycle: 'monthly' } };
  const res = { status() { return this; }, json(b) { jsonBody = b; return this; } };
  await checkAddonCompatibility(req, res);
  console.log('Response:', JSON.stringify(jsonBody, null, 2));

  console.log('\n--- ASSERTIONS ---');
  try {
    assert.equal((jsonBody.compatibleCarryForward || []).length, 0, 'nothing should carry forward — both seats are already fully scheduled for removal');
    console.log('ALL ASSERTIONS PASSED');
  } catch (e) {
    console.error('ASSERTION FAILED:', e.message);
    process.exitCode = 1;
  }

  await ScheduledChange.deleteMany({ subscription: sub._id });
  await Subscription.deleteMany({ _id: sub._id });
  await Organization.deleteMany({ _id: org._id });
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('FATAL', e);
  await mongoose.disconnect();
  process.exit(1);
});
