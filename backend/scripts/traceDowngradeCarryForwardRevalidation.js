// scripts/traceDowngradeCarryForwardRevalidation.js
//
// Regression fixture for the exact live-reported bug: Growth + Seat x1,
// 2 users. Downgrade to Starter with carryForward reduced to 0 was
// INCORRECTLY allowed (validator assumed the seat still survived, ignoring
// the customer's own reduction). Must now be rejected.
//
// Also confirms the ORIGINAL (unedited) carry-forward — quantity 1 — still
// correctly PASSES, since 1 included + 1 carried = capacity 2 = users 2.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/traceDowngradeCarryForwardRevalidation.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const { updateSubscription } = require('../controllers/subscriptionController');

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

  const org = await Organization.create({ name: 'Downgrade Revalidation Fixture', code: 'reval-' + Date.now() });
  const sub = await Subscription.create({
    organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 450, userCount: 1, totalAmount: 550,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    activeAddons: [{ addonKey: 'seat', quantity: 1, pricePerUnit: 100 }],
  });

  const users = [];
  for (let i = 0; i < 2; i++) {
    users.push(await User.create({
      name: `Reval User ${i}`, organization: org._id,
      auth0Id: `reval-${Date.now()}-${i}`, email: `reval-${Date.now()}-${i}@example.com`,
    }));
  }

  console.log('--- Step 1: carryForward=1 (unedited, matches survival) -> should PASS/succeed ---');
  {
    const { req, res, get } = mockReqRes(org._id, {
      planId: 'starter', billingCycle: 'monthly',
      carryForward: [{ addonKey: 'extra_seat', quantity: 1 }],
    });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = get();
    console.log('status:', statusCode, jsonBody?.scheduled ? 'scheduled' : jsonBody?.error);
    assert.equal(statusCode, 200);
    assert.equal(jsonBody.scheduled, true);
    console.log('PASS\n');
  }

  // Reset pendingUpdate so we can test the second scenario cleanly.
  await Subscription.updateOne({ _id: sub._id }, { $set: { pendingUpdate: null } });

  console.log('--- Step 2: carryForward=0 (reduced away) with 2 users -> MUST BE REJECTED ---');
  {
    const { req, res, get } = mockReqRes(org._id, {
      planId: 'starter', billingCycle: 'monthly',
      carryForward: [{ addonKey: 'extra_seat', quantity: 0 }],
    });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = get();
    console.log('status:', statusCode);
    console.log('validation:', JSON.stringify(jsonBody?.downgradeValidation, null, 2));
    assert.equal(statusCode, 400, 'this MUST be rejected — 2 users cannot fit in Starter (1 included) with 0 carried seats');
    assert.equal(jsonBody.downgradeValidation.eligible, false);
    const seatCheck = jsonBody.downgradeValidation.results.find((r) => r.type === 'SEATS');
    assert.equal(seatCheck.status, 'AUTO_FIXABLE');
    assert.equal(seatCheck.minimumQuantity, 1, '2 users - 1 included - 0 carried = 1 more seat needed');
    console.log('PASS — correctly rejected\n');
  }

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
