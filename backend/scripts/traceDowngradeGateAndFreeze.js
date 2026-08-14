// scripts/traceDowngradeGateAndFreeze.js
//
// End-to-end fixture for the downgrade eligibility gate + freeze rule:
//   1. Over-limit downgrade is rejected with the validator report.
//   2. Within-limit downgrade is scheduled successfully.
//   3. Once scheduled, addon purchase / addon removal / another plan change
//      are all blocked with the freeze error.
//   4. cancelScheduledDowngrade lifts the freeze; subsequent actions succeed
//      again.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/traceDowngradeGateAndFreeze.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const ScheduledChange = require('../models/ScheduledChange');
const {
  updateSubscription, initiateAddonPurchase, scheduleAddonRemovalEndpoint, cancelScheduledDowngrade,
} = require('../controllers/subscriptionController');

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

  const org = await Organization.create({ name: 'Downgrade Gate Fixture', code: 'gate-' + Date.now() });
  let sub = await Subscription.create({
    organization: org._id, planName: 'business', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 650, userCount: 1, totalAmount: 650,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    activeAddons: [],
  });

  const users = [];
  for (let i = 0; i < 5; i++) {
    users.push(await User.create({
      name: `Gate Fixture User ${i}`, organization: org._id,
      auth0Id: `gate-fixture-${Date.now()}-${i}`, email: `gate-fixture-${Date.now()}-${i}@example.com`,
    }));
  }

  console.log('--- Step 1: 5 users, downgrade to Growth (includes 3) should be REJECTED ---');
  {
    const { req, res, get } = mockReqRes(org._id, { planId: 'growth', billingCycle: 'monthly' });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = get();
    console.log('status:', statusCode, 'body:', JSON.stringify(jsonBody));
    assert.equal(statusCode, 400);
    assert.equal(jsonBody.downgradeValidation.eligible, false);
    console.log('PASS\n');
  }

  console.log('--- Step 2: remove 3 users (2 left, within Growth\'s 3), downgrade should SUCCEED ---');
  await User.deleteMany({ _id: { $in: users.slice(0, 3).map((u) => u._id) } });
  {
    const { req, res, get } = mockReqRes(org._id, { planId: 'growth', billingCycle: 'monthly' });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = get();
    console.log('status:', statusCode, 'scheduled:', jsonBody?.scheduled);
    assert.equal(statusCode, 200);
    assert.equal(jsonBody.scheduled, true);
    console.log('PASS\n');
  }

  sub = await Subscription.findById(sub._id);
  console.log('pendingUpdate set:', !!sub.pendingUpdate, '\n');

  console.log('--- Step 3: with downgrade scheduled, addon purchase should be BLOCKED ---');
  {
    const { req, res, get } = mockReqRes(org._id, { addonKey: 'seat', quantity: 1 });
    await initiateAddonPurchase(req, res);
    const { statusCode, jsonBody } = get();
    console.log('status:', statusCode, 'error:', jsonBody?.error);
    assert.equal(statusCode, 400);
    assert.equal(jsonBody.code, 'DOWNGRADE_SCHEDULED_FREEZE');
    console.log('PASS\n');
  }

  console.log('--- Step 4: addon removal should also be BLOCKED ---');
  {
    const { req, res, get } = mockReqRes(org._id, { addonKey: 'seat', quantity: 1 });
    await scheduleAddonRemovalEndpoint(req, res);
    const { statusCode, jsonBody } = get();
    console.log('status:', statusCode, 'error:', jsonBody?.error);
    assert.equal(statusCode, 400);
    assert.equal(jsonBody.code, 'DOWNGRADE_SCHEDULED_FREEZE');
    console.log('PASS\n');
  }

  console.log('--- Step 5: another plan change (upgrade back to Business) should also be BLOCKED ---');
  {
    const { req, res, get } = mockReqRes(org._id, { planId: 'business', billingCycle: 'monthly', addons: [] });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = get();
    console.log('status:', statusCode, 'error:', jsonBody?.error);
    assert.equal(statusCode, 400);
    assert.equal(jsonBody.code, 'DOWNGRADE_SCHEDULED_FREEZE');
    console.log('PASS\n');
  }

  console.log('--- Step 6: cancelScheduledDowngrade should lift the freeze ---');
  {
    const { req, res, get } = mockReqRes(org._id, {});
    await cancelScheduledDowngrade(req, res);
    const { statusCode, jsonBody } = get();
    console.log('status:', statusCode, 'message:', jsonBody?.message);
    assert.equal(statusCode, 200);
  }
  sub = await Subscription.findById(sub._id);
  assert.equal(sub.pendingUpdate?.planName, undefined, 'pendingUpdate.planName must be cleared (Mongoose reinstates the empty nested-object shape, not literal null)');
  const scs = await ScheduledChange.find({ subscription: sub._id, type: 'PLAN_CHANGE' });
  assert.ok(scs.every((s) => s.status === 'CANCELLED'), 'PLAN_CHANGE ScheduledChange must be cancelled');
  console.log('pendingUpdate cleared, ScheduledChange cancelled. PASS\n');

  console.log('--- Step 7: after cancelling, addon purchase should succeed again (no freeze) ---');
  {
    const { req, res, get } = mockReqRes(org._id, { addonKey: 'seat', quantity: 1 });
    await initiateAddonPurchase(req, res);
    const { statusCode, jsonBody } = get();
    console.log('status:', statusCode, JSON.stringify(jsonBody)?.slice(0, 200));
    assert.notEqual(jsonBody?.code, 'DOWNGRADE_SCHEDULED_FREEZE', 'freeze must be lifted');
    console.log('PASS (freeze lifted — any other error here is unrelated to the freeze rule)\n');
  }

  console.log('ALL SCENARIOS PASSED');

  await User.deleteMany({ organization: org._id });
  await ScheduledChange.deleteMany({ subscription: sub._id });
  await Subscription.deleteMany({ _id: sub._id });
  await Organization.deleteMany({ _id: org._id });
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('FATAL', e);
  await mongoose.disconnect();
  process.exit(1);
});
