// scripts/traceCheckCompatibilityLiveRevalidation.js
//
// Confirms checkAddonCompatibility (the PREVIEW endpoint) re-validates
// against the customer's LIVE carryForward stepper state, not just the
// initial full-survival recommendation. Growth + Seat x1, 2 users,
// downgrading to Starter:
//   no carryForward param -> PASS (default: seat survives, 1+1=2=users)
//   carryForward=[{seat:0}] -> AUTO_FIXABLE (0 survives, 1+0=1 < 2 users)
//
// Run with: CONFIRM_TEST_DB=yes node scripts/traceCheckCompatibilityLiveRevalidation.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const { checkAddonCompatibility } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.\n');

  const org = await Organization.create({ name: 'Live Revalidation Fixture', code: 'liverev-' + Date.now() });
  const sub = await Subscription.create({
    organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 450, userCount: 1, totalAmount: 550,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    activeAddons: [{ addonKey: 'seat', quantity: 1, pricePerUnit: 100 }],
  });
  for (let i = 0; i < 2; i++) {
    await User.create({
      name: `LiveRev User ${i}`, organization: org._id,
      auth0Id: `liverev-${Date.now()}-${i}`, email: `liverev-${Date.now()}-${i}@example.com`,
    });
  }

  async function preview(carryForward) {
    let jsonBody;
    const query = { targetPlanId: 'starter', billingCycle: 'monthly' };
    if (carryForward) query.carryForward = JSON.stringify(carryForward);
    const req = { user: { organization: org._id }, query };
    const res = { status() { return this; }, json(b) { jsonBody = b; return this; } };
    await checkAddonCompatibility(req, res);
    return jsonBody;
  }

  console.log('--- No carryForward param (initial load) -> expect PASS ---');
  const resp1 = await preview(null);
  console.log(JSON.stringify(resp1.downgradeValidation.results, null, 2));
  assert.equal(resp1.downgradeValidation.results.find((r) => r.type === 'SEATS').status, 'PASS');
  console.log('PASS\n');

  console.log('--- carryForward=[{extra_seat: 0}] (user reduced stepper to 0) -> expect AUTO_FIXABLE ---');
  const resp2 = await preview([{ addonKey: 'extra_seat', quantity: 0 }]);
  console.log(JSON.stringify(resp2.downgradeValidation.results, null, 2));
  const seatCheck2 = resp2.downgradeValidation.results.find((r) => r.type === 'SEATS');
  assert.equal(seatCheck2.status, 'AUTO_FIXABLE', 'live preview must catch the invalid state the moment the stepper changes, not just at final submit');
  assert.equal(seatCheck2.minimumQuantity, 1);
  console.log('PASS\n');

  console.log('ALL SCENARIOS PASSED');

  await User.deleteMany({ organization: org._id });
  await Subscription.deleteMany({ _id: sub._id });
  await Organization.deleteMany({ _id: org._id });
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('FATAL', e);
  await mongoose.disconnect();
  process.exit(1);
});
