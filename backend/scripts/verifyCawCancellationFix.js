// scripts/verifyCawCancellationFix.js
//
// Bug found via live QA (Aug 2026): cancelSubscription unconditionally called
// razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId, ...) —
// a CAW subscription has no such Razorpay resource at all (mandateTokenId
// present, razorpaySubscriptionId absent), so every CAW cancellation attempt
// threw, surfacing as "Failed to cancel subscription". Drives the real
// exported controller function, not a reimplementation.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyCawCancellationFix.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Subscription = require('../models/Subscription');
const ScheduledChange = require('../models/ScheduledChange');
const subscriptionController = require('../controllers/subscriptionController');

const razorpay = require('../config/razorpay');
let cancelCallCount = 0;
razorpay.subscriptions = razorpay.subscriptions || {};
razorpay.subscriptions.cancel = async () => { cancelCallCount++; return {}; };

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database.');
  process.exit(1);
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}:`, err); }
}

const cleanupIds = { subs: [], scs: [] };
async function cleanup() {
  if (cleanupIds.subs.length) await Subscription.deleteMany({ _id: { $in: cleanupIds.subs } });
  if (cleanupIds.scs.length) await ScheduledChange.deleteMany({ _id: { $in: cleanupIds.scs } });
  cleanupIds.subs = []; cleanupIds.scs = [];
}

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running CAW cancellation fix fixtures...\n');

  await test('CAW subscription (mandateTokenId, no razorpaySubscriptionId) cancels successfully, does NOT call razorpay.subscriptions.cancel', async () => {
    cancelCallCount = 0;
    const sub = await Subscription.create({
      organization: new mongoose.Types.ObjectId(), planName: 'growth', billingCycle: 'yearly',
      pricePerUser: 4800, userCount: 1, totalAmount: 4800, isPaymentConfirmed: true,
      mandateTokenId: 'token_test_fixture', razorpayCustomerId: 'cust_test_fixture',
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
      billingAnchor: new Date(),
    });
    cleanupIds.subs.push(sub._id);

    const req = { user: { organization: sub.organization, _id: new mongoose.Types.ObjectId() }, body: {} };
    const res = mockRes();
    await subscriptionController.cancelSubscription(req, res);

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(cancelCallCount, 0, 'must NOT call razorpay.subscriptions.cancel for a CAW subscription — nothing to cancel there');

    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.cancelAtPeriodEnd, true);

    const sc = await ScheduledChange.findOne({ subscription: sub._id, type: 'CANCELLATION', status: 'PENDING' });
    assert.ok(sc, 'a PENDING CANCELLATION ScheduledChange must be created — this is what renewSubscription() actually reads to stop future billing');
    cleanupIds.scs.push(sc._id);
    await cleanup();
  });

  await test('legacy subscription (real razorpaySubscriptionId) still calls razorpay.subscriptions.cancel — regression check', async () => {
    cancelCallCount = 0;
    const sub = await Subscription.create({
      organization: new mongoose.Types.ObjectId(), planName: 'growth', billingCycle: 'monthly',
      pricePerUser: 450, userCount: 1, totalAmount: 450, isPaymentConfirmed: true,
      razorpaySubscriptionId: 'sub_test_legacy_fixture',
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    });
    cleanupIds.subs.push(sub._id);

    const req = { user: { organization: sub.organization, _id: new mongoose.Types.ObjectId() }, body: {} };
    const res = mockRes();
    await subscriptionController.cancelSubscription(req, res);

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(cancelCallCount, 1, 'must still call razorpay.subscriptions.cancel for a legacy subscription — unchanged behavior');

    const sc = await ScheduledChange.findOne({ subscription: sub._id, type: 'CANCELLATION', status: 'PENDING' });
    if (sc) cleanupIds.scs.push(sc._id);
    await cleanup();
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
