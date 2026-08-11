// scripts/traceUpgradeSettlement.js
//
// End-to-end fixture for the exact risk flagged in review: does an existing
// pre-upgrade pendingAddonRemovals entry (under the OLD, pre-remap addonKey)
// get correctly merged/superseded rather than resurrected as a phantom addon
// when the user ALSO reduces the carry-forward quantity during upgrade?
//
// Scenario: Starter + Extra Seat x5, 2 ALREADY scheduled for removal
// (surviving = 3). Upgrade to Growth, user sets carryForward seat = 1
// (a further reduction of 2, on top of the 2 already scheduled).
// Expected final state after settlement:
//   - activeAddons: exactly ONE 'seat' entry, quantity 1 (no 'extra_seat' ghost)
//   - pendingAddonRemovals: no stale 'extra_seat' entry, one 'seat' entry qty 2
//   - totalAmount: 450 (Growth) + 100 (1 seat) = 550
//
// Uses the temporarily-exported __test_handlePaymentCaptured to exercise the
// real settlement code path directly (bypassing webhook signature/HTTP
// plumbing, which is a separately-tested concern).
//
// Run with: CONFIRM_TEST_DB=yes node scripts/traceUpgradeSettlement.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const ScheduledChange = require('../models/ScheduledChange');
const { updateSubscription, __test_handlePaymentCaptured } = require('../controllers/subscriptionController');

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

  const org = await Organization.create({ name: 'Settlement Trace Fixture', code: 'settle-trace-' + Date.now() });
  const sub = await Subscription.create({
    organization: org._id, planName: 'starter', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 250, userCount: 1, totalAmount: 750,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    activeAddons: [{ addonKey: 'extra_seat', quantity: 5, pricePerUnit: 100 }],
    pendingAddonRemovals: [{
      addonKey: 'extra_seat', displayName: 'Extra Seat', quantity: 2, pricePerUnit: 100,
      scheduledAt: new Date(), effectiveAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    }],
  });
  await ScheduledChange.create({
    organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING',
    effectiveAt: sub.currentPeriodEnd, payload: { addonKey: 'extra_seat', quantity: 2 },
  });

  console.log('Fixture: Starter + Extra Seat x5, 2 ALREADY scheduled for removal (surviving=3).');
  console.log('Upgrading to Growth with carryForward seat quantity = 1 (further reduction of 2)...\n');

  const { req, res, get } = mockReqRes(org._id, {
    planId: 'growth', billingCycle: 'monthly', addons: [],
    carryForward: [{ addonKey: 'seat', quantity: 1 }],
  });
  await updateSubscription(req, res);
  const initResp = get();
  console.log('Initiation response (pricing fields):', {
    oldRecurringTotal: initResp.oldRecurringTotal,
    newRecurringTotal: initResp.newRecurringTotal,
    carriedForwardAddons: initResp.carriedForwardAddons,
  });

  const orderId = initResp.paymentDetails.order_id;
  const chargedAmountPaise = initResp.paymentDetails.amount;

  console.log('\nSimulating payment.captured webhook for that order...\n');
  const fakePayment = {
    id: 'pay_fake_' + Date.now(),
    order_id: orderId,
    amount: chargedAmountPaise,
    status: 'captured',
    notes: {},
  };
  await __test_handlePaymentCaptured(fakePayment);

  const finalSub = await Subscription.findById(sub._id);
  console.log('--- POST-SETTLEMENT STATE ---');
  console.log('planName:', finalSub.planName);
  console.log('totalAmount:', finalSub.totalAmount);
  console.log('activeAddons:', JSON.stringify(finalSub.activeAddons.map(a => ({ addonKey: a.addonKey, quantity: a.quantity, pricePerUnit: a.pricePerUnit }))));
  console.log('pendingAddonRemovals:', JSON.stringify(finalSub.pendingAddonRemovals.map(r => ({ addonKey: r.addonKey, quantity: r.quantity }))));
  const scs = await ScheduledChange.find({ subscription: sub._id }).sort({ createdAt: 1 });
  console.log('ScheduledChange records:', JSON.stringify(scs.map(s => ({ type: s.type, status: s.status, addonKey: s.payload?.addonKey, quantity: s.payload?.quantity }))));

  console.log('\n--- ASSERTIONS ---');
  try {
    assert.equal(finalSub.planName, 'growth');
    assert.equal(finalSub.totalAmount, 550, 'totalAmount must be 450 (Growth) + 100 (1 surviving seat) = 550');
    const extraSeatEntries = finalSub.activeAddons.filter(a => a.addonKey === 'extra_seat');
    assert.equal(extraSeatEntries.length, 0, 'no phantom extra_seat entry should be resurrected');
    const seatEntries = finalSub.activeAddons.filter(a => a.addonKey === 'seat');
    assert.equal(seatEntries.length, 1, 'exactly one seat entry');
    assert.equal(seatEntries[0].quantity, 1, 'seat quantity must be 1 (the user-chosen carry-forward amount)');
    const stalePendingRemoval = finalSub.pendingAddonRemovals.find(r => r.addonKey === 'extra_seat');
    assert.equal(stalePendingRemoval, undefined, 'stale extra_seat pendingAddonRemovals entry must be gone, not merged blindly');
    const newPendingRemoval = finalSub.pendingAddonRemovals.find(r => r.addonKey === 'seat');
    assert.ok(newPendingRemoval, 'a new seat pendingAddonRemovals entry must exist');
    assert.equal(newPendingRemoval.quantity, 2, 'reduced quantity must be 2 (3 surviving - 1 kept)');
    const oldSC = scs.find(s => s.payload?.addonKey === 'extra_seat');
    assert.equal(oldSC.status, 'CANCELLED', 'the stale extra_seat ScheduledChange must be cancelled, not left dangling PENDING');
    const newSC = scs.find(s => s.payload?.addonKey === 'seat');
    assert.equal(newSC.status, 'PENDING');
    assert.equal(newSC.payload.quantity, 2);
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
