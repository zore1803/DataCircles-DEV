// scripts/traceDowngradeAddonProjection.js
//
// Regression fixture for the bug found via live testing: checkout showed
// "Extra Seat: 0" (carry-forward reduced to zero) but Manage Subscription /
// Timeline / Billing all showed "Seat x1" persisting anyway — because
// applyScheduledChange's PLAN_CHANGE case never touched activeAddons at all,
// so every "what happens at renewal" read silently reused the CURRENT
// (unmodified) addons instead of the actual carry-forward decision.
//
// Scenario: Growth + Seat x1, downgrade to Starter with carryForward
// explicitly reduced to 0 (decline to carry the seat forward at all).
// Expected: keptAddons (from getScheduledChanges) must be EMPTY, not
// showing the seat at any quantity, under either key.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/traceDowngradeAddonProjection.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const { updateSubscription, getScheduledChanges } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

function mockReqRes(organizationId, body) {
  let jsonBody;
  return {
    req: { user: { organization: organizationId, _id: new mongoose.Types.ObjectId() }, body },
    res: { status() { return this; }, json(b) { jsonBody = b; return this; } },
    get: () => jsonBody,
  };
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.\n');

  const org = await Organization.create({ name: 'Downgrade Addon Projection Fixture', code: 'proj-' + Date.now() });
  const sub = await Subscription.create({
    organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 450, userCount: 1, totalAmount: 550,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    activeAddons: [{ addonKey: 'seat', quantity: 1, pricePerUnit: 100 }],
  });

  console.log('Fixture: Growth + Seat x1. Downgrading to Starter with carryForward extra_seat quantity = 0...\n');
  const { req, res, get } = mockReqRes(org._id, {
    planId: 'starter', billingCycle: 'monthly',
    carryForward: [{ addonKey: 'extra_seat', quantity: 0 }],
  });
  await updateSubscription(req, res);
  const resp = get();
  console.log('updateSubscription response:', JSON.stringify({
    scheduled: resp.scheduled, newRecurringTotal: resp.newRecurringTotal, carriedForwardAddons: resp.carriedForwardAddons,
  }, null, 2));

  const { req: req2, res: res2, get: get2 } = mockReqRes(org._id, {});
  await getScheduledChanges(req2, res2);
  const scResp = get2();
  console.log('\ngetScheduledChanges response:', JSON.stringify(scResp, null, 2));

  console.log('\n--- ASSERTIONS ---');
  try {
    assert.equal((resp.carriedForwardAddons || []).length, 0, 'checkout-time response must show nothing carrying forward');
    assert.equal(scResp.keptAddons.length, 0, 'getScheduledChanges projection must ALSO show nothing surviving — this is the actual bug: it previously showed Seat x1 regardless of the carryForward=0 choice');
    assert.equal(scResp.effectiveRecurringTotal, 250, 'effective recurring must be Starter base only (250), not 250+100 for a phantom seat');
    console.log('ALL ASSERTIONS PASSED');
  } catch (e) {
    console.error('ASSERTION FAILED:', e.message);
    process.exitCode = 1;
  }

  const { ScheduledChange } = { ScheduledChange: require('../models/ScheduledChange') };
  const scs = await ScheduledChange.find({ subscription: sub._id, type: 'PLAN_CHANGE' });
  console.log('\nScheduledChange.payload.carriedAddons:', JSON.stringify(scs[0]?.payload?.carriedAddons));

  await ScheduledChange.deleteMany({ subscription: sub._id });
  await Subscription.deleteMany({ _id: sub._id });
  await Organization.deleteMany({ _id: org._id });
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('FATAL', e);
  await mongoose.disconnect();
  process.exit(1);
});
