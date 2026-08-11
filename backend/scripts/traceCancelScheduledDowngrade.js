// scripts/traceCancelScheduledDowngrade.js
//
// Acceptance criteria from review: "scheduling -> cancelling -> scheduling
// again leaves the subscription in exactly the same state as if nothing had
// happened."
//
// Scenario: Growth + Seat x3, 1 ALREADY scheduled for removal under the OLD
// key ('seat', pre-existing, unrelated to any downgrade). Downgrade to
// Starter remaps the surviving 2 seats to 'extra_seat' and the carry-forward
// stepper reduces THAT to 0. Because the remap creates a NEW key, this is
// tracked as a SEPARATE pendingAddonRemovals entry ('extra_seat': 2) — the
// pre-existing 'seat':1 entry is untouched (correct: it predates this
// downgrade and belongs to a different addon identity). Cancelling must
// remove ONLY the entry this downgrade created, leaving the pre-existing
// one completely intact.
//
// Expected after cancel:
//   - pendingUpdate cleared (planName undefined)
//   - PLAN_CHANGE ScheduledChange CANCELLED
//   - the pre-existing 'seat':1 removal is UNTOUCHED
//   - the 'extra_seat':2 removal (created by this downgrade) is GONE entirely
//     (its ScheduledChange CANCELLED), not left behind
//
// Run with: CONFIRM_TEST_DB=yes node scripts/traceCancelScheduledDowngrade.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const ScheduledChange = require('../models/ScheduledChange');
const { updateSubscription, cancelScheduledDowngrade } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

function mockReqRes(organizationId, body) {
  let jsonBody, statusCode = 200;
  return {
    req: { user: { organization: organizationId, _id: new mongoose.Types.ObjectId() }, body },
    res: { status(c) { statusCode = c; return this; }, json(b) { jsonBody = b; return this; } },
    get: () => ({ statusCode, jsonBody }),
  };
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.\n');

  const org = await Organization.create({ name: 'Cancel Downgrade Fixture', code: 'cancel-' + Date.now() });
  const sub = await Subscription.create({
    organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 450, userCount: 1, totalAmount: 750,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    activeAddons: [{ addonKey: 'seat', quantity: 3, pricePerUnit: 100 }],
    pendingAddonRemovals: [{
      addonKey: 'seat', displayName: 'Seat', quantity: 1, pricePerUnit: 100,
      scheduledAt: new Date(), effectiveAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    }],
  });
  await ScheduledChange.create({
    organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING',
    effectiveAt: sub.currentPeriodEnd, payload: { addonKey: 'seat', quantity: 1 },
  });

  console.log('Fixture: Growth + Seat x3, 1 ALREADY scheduled for removal (pre-existing, unrelated).');
  console.log('Downgrading to Starter, reducing carried seat further to 0 (surviving 2 -> 0)...\n');

  const { req, res } = mockReqRes(org._id, {
    planId: 'starter', billingCycle: 'monthly',
    carryForward: [{ addonKey: 'extra_seat', quantity: 0 }],
  });
  await updateSubscription(req, res);

  let midSub = await Subscription.findById(sub._id);
  console.log('After scheduling downgrade:');
  console.log('  pendingUpdate.planName:', midSub.pendingUpdate.planName);
  console.log('  pendingAddonRemovals:', JSON.stringify(midSub.pendingAddonRemovals.map(r => ({ addonKey: r.addonKey, quantity: r.quantity }))));
  console.log('  reducedAddonDeltas:', JSON.stringify(midSub.pendingUpdate.reducedAddonDeltas));
  assert.equal(midSub.pendingUpdate.planName, 'starter');
  const preExistingRemoval = midSub.pendingAddonRemovals.find(r => r.addonKey === 'seat');
  assert.equal(preExistingRemoval.quantity, 1, 'pre-existing seat removal (old key) must be untouched');
  const newRemoval = midSub.pendingAddonRemovals.find(r => r.addonKey === 'extra_seat');
  assert.equal(newRemoval.quantity, 2, 'this downgrade creates its own entry under the remapped key');

  console.log('\nCancelling the scheduled downgrade...\n');
  const { req: req2, res: res2, get: get2 } = mockReqRes(org._id, {});
  await cancelScheduledDowngrade(req2, res2);
  const { statusCode, jsonBody } = get2();
  console.log('status:', statusCode, 'message:', jsonBody?.message);
  assert.equal(statusCode, 200);

  const finalSub = await Subscription.findById(sub._id);
  const finalScs = await ScheduledChange.find({ subscription: sub._id });
  console.log('\n--- POST-CANCEL STATE ---');
  console.log('pendingUpdate.planName:', finalSub.pendingUpdate?.planName);
  console.log('pendingAddonRemovals:', JSON.stringify(finalSub.pendingAddonRemovals.map(r => ({ addonKey: r.addonKey, quantity: r.quantity }))));
  console.log('ScheduledChange:', JSON.stringify(finalScs.map(s => ({ type: s.type, status: s.status, quantity: s.payload?.quantity }))));

  console.log('\n--- ASSERTIONS ---');
  try {
    assert.equal(finalSub.pendingUpdate?.planName, undefined, 'pendingUpdate must be cleared');
    const finalPreExisting = finalSub.pendingAddonRemovals.find(r => r.addonKey === 'seat');
    assert.ok(finalPreExisting, 'the PRE-EXISTING removal (old key) must still exist, untouched');
    assert.equal(finalPreExisting.quantity, 1, 'pre-existing removal quantity must be unchanged');
    const finalNewRemoval = finalSub.pendingAddonRemovals.find(r => r.addonKey === 'extra_seat');
    assert.equal(finalNewRemoval, undefined, 'the entry THIS downgrade created must be gone entirely after cancel');
    const planChangeSC = finalScs.find(s => s.type === 'PLAN_CHANGE');
    assert.equal(planChangeSC.status, 'CANCELLED');
    const preExistingSC = finalScs.find(s => s.payload?.addonKey === 'seat');
    assert.equal(preExistingSC.status, 'PENDING', 'the pre-existing REMOVE_ADDON must remain PENDING (it was never this downgrade\'s to cancel)');
    assert.equal(preExistingSC.payload.quantity, 1);
    const newRemovalSC = finalScs.find(s => s.payload?.addonKey === 'extra_seat');
    assert.equal(newRemovalSC.status, 'CANCELLED', 'the ScheduledChange this downgrade created must be cancelled, not left PENDING');
    console.log('ALL ASSERTIONS PASSED');
  } catch (e) {
    console.error('ASSERTION FAILED:', e.message);
    process.exitCode = 1;
  }

  // Re-schedule to confirm the subscription is fully usable again (freeze lifted).
  console.log('\n--- Re-scheduling after cancel (freeze must be lifted) ---');
  const { req: req3, res: res3, get: get3 } = mockReqRes(org._id, {
    planId: 'starter', billingCycle: 'monthly',
    carryForward: [{ addonKey: 'extra_seat', quantity: 0 }],
  });
  await updateSubscription(req3, res3);
  const { statusCode: statusCode3, jsonBody: jsonBody3 } = get3();
  console.log('status:', statusCode3, 'scheduled:', jsonBody3?.scheduled);
  assert.equal(statusCode3, 200);
  assert.equal(jsonBody3.scheduled, true);
  console.log('PASS — re-scheduling works cleanly after cancel');

  await ScheduledChange.deleteMany({ subscription: sub._id });
  await Subscription.deleteMany({ _id: sub._id });
  await Organization.deleteMany({ _id: org._id });
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('FATAL', e);
  await mongoose.disconnect();
  process.exit(1);
});
