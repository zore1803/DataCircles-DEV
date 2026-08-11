// scripts/traceUpgradePricing.js
//
// One-off live trace for the reported upgrade-pricing scenario:
//   Starter ₹250 + Extra Seat x3 @100 (current recurring ₹550),
//   2 seats scheduled for removal (renewal would be ₹350),
//   then upgrade to Growth.
//
// Calls exports.updateSubscription directly (mocked req/res) so we observe
// the REAL computed oldTotal/newTotal/addonsToClassify/carriedForward values,
// not a re-derivation. Relies on the temporary __UPGRADE_TRACE__ console.log
// added right before the Razorpay order call in subscriptionController.js —
// remove that log after this investigation is done.
//
// WRITES disposable documents and deletes them after. Requires valid
// Razorpay test keys in .env (the order-create call will run for real against
// Razorpay's test API — harmless, no money moves in test mode).
//
// Run with: CONFIRM_TEST_DB=yes node scripts/traceUpgradePricing.js

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
  let statusCode = 200;
  let jsonBody;
  return {
    req: { user: { organization: organizationId, _id: new mongoose.Types.ObjectId() }, body },
    res: {
      status(code) { statusCode = code; return this; },
      json(b) { jsonBody = b; return this; },
    },
    get: () => ({ statusCode, jsonBody }),
  };
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Tracing upgrade-pricing scenario...\n');

  const org = await Organization.create({ name: 'Upgrade Trace Fixture', code: 'upg-trace-' + Date.now() });
  const sub = await Subscription.create({
    organization: org._id, planName: 'starter', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 250, userCount: 1, totalAmount: 550,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    activeAddons: [{ addonKey: 'extra_seat', quantity: 3, pricePerUnit: 100 }],
  });
  const effectiveAt = sub.currentPeriodEnd;
  await ScheduledChange.create({
    organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING',
    effectiveAt, payload: { addonKey: 'extra_seat', quantity: 2 },
  });

  console.log('Fixture: Starter + Extra Seat x3 (current recurring 550), 2 seats scheduled for removal at', effectiveAt.toISOString());
  const carryForward = process.env.TRACE_CARRY_FORWARD ? JSON.parse(process.env.TRACE_CARRY_FORWARD) : [];
  console.log('Calling updateSubscription({ planId: "growth", billingCycle: "monthly", carryForward:', JSON.stringify(carryForward), '})...\n');

  const { req, res, get } = mockReqRes(org._id, { planId: 'growth', billingCycle: 'monthly', addons: [], carryForward });
  try {
    await updateSubscription(req, res);
  } catch (e) {
    console.error('updateSubscription threw (may be expected if Razorpay order creation fails):', e.message);
  }
  const { statusCode, jsonBody } = get();
  console.log('\nHTTP status:', statusCode);
  console.log('Response body:', JSON.stringify(jsonBody, null, 2));

  await ScheduledChange.deleteMany({ subscription: sub._id });
  await Subscription.deleteMany({ _id: sub._id });
  await Organization.deleteMany({ _id: org._id });

  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('FATAL', e);
  await mongoose.disconnect();
  process.exit(1);
});
