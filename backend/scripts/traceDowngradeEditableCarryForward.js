// scripts/traceDowngradeEditableCarryForward.js
//
// Case 4 from review: Business + Seat x2, 1 ALREADY scheduled for removal
// (1 surviving), downgrading to Growth with the user explicitly choosing to
// carry forward 0 (reducing the survivor further).
//
// Expected: nothing carries forward, the ADDITIONAL reduction (1 more seat)
// gets merged into the EXISTING pendingAddonRemovals/ScheduledChange entry
// (total removal = 2), not left at the original scheduled amount (1) and not
// creating a stray duplicate second entry.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/traceDowngradeEditableCarryForward.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const ScheduledChange = require('../models/ScheduledChange');
const { updateSubscription } = require('../controllers/subscriptionController');

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

  const org = await Organization.create({ name: 'Downgrade Editable CF Fixture', code: 'downgrade-ecf-' + Date.now() });
  const sub = await Subscription.create({
    organization: org._id, planName: 'business', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 650, userCount: 1, totalAmount: 650,
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

  console.log('Fixture: Business + Seat x2, 1 ALREADY scheduled for removal (1 surviving).');
  console.log('Downgrading to Growth with carryForward seat quantity = 0...\n');

  const { req, res, get } = mockReqRes(org._id, {
    planId: 'growth', billingCycle: 'monthly',
    carryForward: [{ addonKey: 'seat', quantity: 0 }],
  });
  await updateSubscription(req, res);
  const resp = get();
  console.log('Response:', JSON.stringify(resp, null, 2));

  const finalSub = await Subscription.findById(sub._id);
  const scs = await ScheduledChange.find({ subscription: sub._id });
  console.log('\npendingAddonRemovals:', JSON.stringify(finalSub.pendingAddonRemovals.map(r => ({ addonKey: r.addonKey, quantity: r.quantity }))));
  console.log('ScheduledChange records:', JSON.stringify(scs.map(s => ({ type: s.type, status: s.status, addonKey: s.payload?.addonKey, quantity: s.payload?.quantity }))));

  console.log('\n--- ASSERTIONS ---');
  try {
    assert.equal((resp.carriedForwardAddons || []).length, 0, 'nothing should carry forward');
    assert.equal(resp.newRecurringTotal, 450, 'recurring must be Growth base only');
    const removal = finalSub.pendingAddonRemovals.find(r => r.addonKey === 'seat');
    assert.ok(removal, 'a seat removal entry must exist');
    assert.equal(removal.quantity, 2, 'total removal must be 2 (1 already scheduled + 1 additional from carryForward=0), not left at 1');
    const removeAddonSCs = scs.filter(s => s.type === 'REMOVE_ADDON');
    assert.equal(removeAddonSCs.length, 1, 'must be exactly ONE ScheduledChange record, not a stray duplicate');
    assert.equal(removeAddonSCs[0].payload.quantity, 2);
    assert.equal(removeAddonSCs[0].status, 'PENDING');
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
