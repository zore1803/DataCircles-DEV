// scripts/traceDowngradeAutoFixable.js
//
// Regression fixture for the AUTO_FIXABLE resolution flow (review's
// pushback: AUTO_FIXABLE must be resolvable in ONE round trip, not a dead
// end that reports "buy 2 seats" and then rejects anyway).
//
// Scenario: Business, 7 users, downgrading to Growth (includes 5).
//   Step 1: request downgrade with NO addons -> should be REJECTED,
//           AUTO_FIXABLE, minimumQuantity=2.
//   Step 2: same request but WITH addons:[{key:'seat', quantity:2}] ->
//           should SUCCEED, scheduled=true, and the 2 seats should be
//           reflected in the scheduled recurring total.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/traceDowngradeAutoFixable.js

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

  const org = await Organization.create({ name: 'Downgrade AutoFixable Fixture', code: 'autofix-' + Date.now() });
  const sub = await Subscription.create({
    organization: org._id, planName: 'business', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 650, userCount: 1, totalAmount: 650,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    activeAddons: [],
  });

  const users = [];
  for (let i = 0; i < 7; i++) {
    users.push(await User.create({
      name: `AutoFix User ${i}`, organization: org._id,
      auth0Id: `autofix-${Date.now()}-${i}`, email: `autofix-${Date.now()}-${i}@example.com`,
    }));
  }

  console.log('--- Step 1: 7 users, downgrade to Growth (5 included), NO addons -> should be REJECTED with AUTO_FIXABLE ---');
  {
    const { req, res, get } = mockReqRes(org._id, { planId: 'growth', billingCycle: 'monthly' });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = get();
    console.log('status:', statusCode);
    console.log('validation:', JSON.stringify(jsonBody.downgradeValidation, null, 2));
    assert.equal(statusCode, 400);
    const seatCheck = jsonBody.downgradeValidation.results.find((r) => r.type === 'SEATS');
    assert.equal(seatCheck.status, 'AUTO_FIXABLE');
    assert.equal(seatCheck.minimumQuantity, 4, '7 users - 3 included (real Growth seed data) = 4 more seats needed');
    assert.equal(seatCheck.requiredAddon, 'seat');
    console.log('PASS\n');
  }

  console.log('--- Step 2: SAME request but WITH addons:[{key:"seat", quantity:4}] -> should SUCCEED ---');
  {
    const { req, res, get } = mockReqRes(org._id, {
      planId: 'growth', billingCycle: 'monthly',
      addons: [{ key: 'seat', quantity: 4 }],
    });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = get();
    console.log('status:', statusCode);
    console.log('scheduled:', jsonBody?.scheduled, 'newRecurringTotal:', jsonBody?.newRecurringTotal);
    console.log('newAddonsList:', JSON.stringify(jsonBody?.newAddonsList));
    assert.equal(statusCode, 200);
    assert.equal(jsonBody.scheduled, true);
    // Growth base 450 + 4 seats * 100 = 850
    assert.equal(jsonBody.newRecurringTotal, 850, 'recurring must include the 4 purchased seats');
    assert.equal(jsonBody.newAddonsList.length, 1);
    assert.equal(jsonBody.newAddonsList[0].quantity, 4);
    console.log('PASS\n');
  }

  const finalSub = await Subscription.findById(sub._id);
  console.log('pendingUpdate.carriedAddons:', JSON.stringify(finalSub.pendingUpdate.carriedAddons));
  assert.ok(finalSub.pendingUpdate.carriedAddons.some((a) => a.addonKey === 'seat' && a.quantity === 4), 'the 4 purchased seats must be persisted in pendingUpdate.carriedAddons');

  console.log('\nALL SCENARIOS PASSED');

  await User.deleteMany({ organization: org._id });
  await Subscription.deleteMany({ _id: sub._id });
  await Organization.deleteMany({ _id: org._id });
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('FATAL', e);
  await mongoose.disconnect();
  process.exit(1);
});
