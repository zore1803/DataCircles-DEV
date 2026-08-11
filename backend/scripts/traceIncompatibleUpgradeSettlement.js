// scripts/traceIncompatibleUpgradeSettlement.js
//
// Regression fixture for the exact live-reported bug: Growth + Seat x2, with
// 1 ALREADY scheduled for removal, upgrading to Business (which doesn't
// support Seat at all — fully incompatible, no remap).
//
// Before the fix, addonsToClassify came from the future-effective snapshot
// (Seat already netted down to x1 by the pre-existing pending removal), so
// the incompatible classification only ever saw quantity=1 instead of the
// true current quantity=2 — silently discarding a whole seat's worth of
// entitlement the org already paid for, and leaving the pre-existing partial
// removal (qty 1) un-updated instead of bumped to the correct full amount (2).
//
// Expected AFTER settlement:
//   - activeAddons: Seat x2 (full current entitlement, until renewal)
//   - pendingAddonRemovals: Seat x2 (updated from the stale x1, not left at x1)
//   - totalAmount: 650 (Business base only — incompatible addons excluded
//     from billing, unchanged design)
//   - effectiveRecurringTotal (the "Becomes" figure): 650 (+GST), i.e. Seat
//     fully gone at renewal, matching what checkout told the user
//
// Run with: CONFIRM_TEST_DB=yes node scripts/traceIncompatibleUpgradeSettlement.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const ScheduledChange = require('../models/ScheduledChange');
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

  const org = await Organization.create({ name: 'Incompatible Upgrade Fixture', code: 'incompat-' + Date.now() });
  const sub = await Subscription.create({
    organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 450, userCount: 1, totalAmount: 650,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    activeAddons: [{ addonKey: 'seat', quantity: 2, pricePerUnit: 100 }],
    pendingAddonRemovals: [{
      addonKey: 'seat', displayName: 'Seat', quantity: 1, pricePerUnit: 100,
      scheduledAt: new Date(), effectiveAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    }],
  });
  await ScheduledChange.create({
    organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING',
    effectiveAt: sub.currentPeriodEnd, payload: { addonKey: 'seat', quantity: 1 },
  });

  console.log('Fixture: Growth + Seat x2, 1 ALREADY scheduled for removal.');
  console.log('Upgrading to Business (Seat incompatible)...\n');

  const { req, res, get } = mockReqRes(org._id, { planId: 'business', billingCycle: 'monthly', addons: [] });
  await updateSubscription(req, res);
  const initResp = get();
  console.log('Initiation response:', {
    newRecurringTotal: initResp.newRecurringTotal,
    incompatibleAddons: initResp.incompatibleAddons,
  });

  const orderId = initResp.paymentDetails.order_id;
  const chargedAmountPaise = initResp.paymentDetails.amount;

  // Requires __test_handlePaymentCaptured to already be exported (added via
  // Edit before running this script, removed via Edit after — not patched
  // by this script itself, to avoid any risk of leaving the file mutated on
  // a crash mid-run).
  const { __test_handlePaymentCaptured } = require('../controllers/subscriptionController');
  if (!__test_handlePaymentCaptured) {
    throw new Error('__test_handlePaymentCaptured is not exported — add the temporary export first.');
  }

  console.log('\nSimulating payment.captured webhook for that order...\n');
  await __test_handlePaymentCaptured({
    id: 'pay_fake_' + Date.now(), order_id: orderId, amount: chargedAmountPaise, status: 'captured', notes: {},
  });

  const finalSub = await Subscription.findById(sub._id);
  console.log('--- POST-SETTLEMENT STATE ---');
  console.log('planName:', finalSub.planName);
  console.log('totalAmount:', finalSub.totalAmount);
  console.log('activeAddons:', JSON.stringify(finalSub.activeAddons.map(a => ({ addonKey: a.addonKey, quantity: a.quantity }))));
  console.log('pendingAddonRemovals:', JSON.stringify(finalSub.pendingAddonRemovals.map(r => ({ addonKey: r.addonKey, quantity: r.quantity }))));
  const scs = await ScheduledChange.find({ subscription: sub._id }).sort({ createdAt: 1 });
  console.log('ScheduledChange records:', JSON.stringify(scs.map(s => ({ status: s.status, addonKey: s.payload?.addonKey, quantity: s.payload?.quantity }))));

  const { req: req2, res: res2, get: get2 } = mockReqRes(org._id, {});
  await getScheduledChanges(req2, res2);
  const scResp = get2();
  console.log('\n--- "Becomes" (effectiveRecurringTotal) ---');
  console.log('keptAddons:', JSON.stringify(scResp.keptAddons));
  console.log('effectiveRecurringTotal:', scResp.effectiveRecurringTotal);

  console.log('\n--- ASSERTIONS ---');
  try {
    assert.equal(finalSub.planName, 'business');
    assert.equal(finalSub.totalAmount, 650, 'totalAmount must be 650 (Business only — incompatible seat excluded from billing)');
    const seatEntries = finalSub.activeAddons.filter(a => a.addonKey === 'seat');
    assert.equal(seatEntries.length, 1);
    assert.equal(seatEntries[0].quantity, 2, 'FULL current entitlement (2 seats) must be preserved until renewal, not shrunk to 1');
    const removal = finalSub.pendingAddonRemovals.find(r => r.addonKey === 'seat');
    assert.ok(removal, 'a seat pendingAddonRemovals entry must exist');
    assert.equal(removal.quantity, 2, 'removal must be updated to the FULL quantity (2), not left at the stale partial (1)');
    const sc = scs.find(s => s.payload?.addonKey === 'seat');
    assert.equal(sc.status, 'PENDING');
    assert.equal(sc.payload.quantity, 2, 'ScheduledChange quantity must be updated to 2, not left at 1');
    assert.equal(scResp.keptAddons.length, 0, 'no seats should survive renewal on Business');
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
