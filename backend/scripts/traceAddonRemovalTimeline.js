// scripts/traceAddonRemovalTimeline.js
//
// Regression fixture for the Timeline "Seat removal scheduled" bug: before
// this fix, the emitted BillingEvent's before/after snapshots were literally
// identical (scheduling a removal doesn't touch activeAddons immediately),
// so Timeline showed "Before: Seat x2, After: Seat x2" — no visible change,
// even though a real removal was scheduled.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/traceAddonRemovalTimeline.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const BillingEvent = require('../models/BillingEvent');
const { scheduleAddonRemovalEndpoint } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.\n');

  const org = await Organization.create({ name: 'Addon Removal Timeline Fixture', code: 'addon-tl-' + Date.now() });
  const sub = await Subscription.create({
    organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 450, userCount: 1, totalAmount: 650,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    activeAddons: [{ addonKey: 'seat', quantity: 2, pricePerUnit: 100 }],
  });

  let jsonBody;
  const req = { user: { organization: org._id }, body: { addonKey: 'seat', quantity: 1 } };
  const res = { status() { return this; }, json(b) { jsonBody = b; return this; } };
  await scheduleAddonRemovalEndpoint(req, res);
  console.log('Endpoint response:', jsonBody);

  const event = await BillingEvent.findOne({ subscription: sub._id, eventType: 'ADDON_REMOVAL_SCHEDULED' });
  console.log('\nbeforeSnapshot:', JSON.stringify(event.beforeSnapshot));
  console.log('afterSnapshot:', JSON.stringify(event.afterSnapshot));
  console.log('amounts:', JSON.stringify(event.amounts));
  console.log('summary:', JSON.stringify(event.summary));

  console.log('\n--- ASSERTIONS ---');
  try {
    const beforeSeat = event.beforeSnapshot.activeAddons.find(a => a.addonKey === 'seat');
    assert.equal(beforeSeat.quantity, 2, 'before snapshot must show the current quantity (2)');
    const afterSeat = event.afterSnapshot.activeAddons.find(a => a.addonKey === 'seat');
    assert.equal(afterSeat?.quantity ?? 0, 1, 'after snapshot must show the POST-removal quantity (1), not the unchanged current quantity');
    assert.equal(event.amounts.recurringBefore, 650, 'recurringBefore must be current total');
    assert.equal(event.amounts.recurringAfter, 550, 'recurringAfter must reflect the removal (450 base + 1 seat)');
    assert.ok(event.summary.amountChange?.includes('550'), 'summary "Becomes" text must show the new total, not be undefined');
    console.log('ALL ASSERTIONS PASSED');
  } catch (e) {
    console.error('ASSERTION FAILED:', e.message);
    process.exitCode = 1;
  }

  await BillingEvent.deleteMany({ subscription: sub._id });
  await Subscription.deleteMany({ _id: sub._id });
  await Organization.deleteMany({ _id: org._id });
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('FATAL', e);
  await mongoose.disconnect();
  process.exit(1);
});
