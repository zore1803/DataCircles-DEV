// scripts/verifyAddonPurchaseCommitCAWNoLegacyCall.js
//
// Task 0 (Aug 2026) — CONFIRMED LIVE CRASH, reproduced against a disposable
// clone of the real stuck record (order_TNzKWCQ2iaVPY1) before this fix:
// the add-on purchase payment.captured commit branch (subscriptionController.js)
// called findOrCreateRazorpayPlan()/razorpay.subscriptions.update()
// UNCONDITIONALLY — legacy Razorpay-Subscriptions-API calls with no
// razorpaySubscriptionId guard, no try/catch around the plan-creation call.
// For a CAW subscription (no razorpaySubscriptionId), findOrCreateRazorpayPlan's
// razorpay.plans.create() threw a real 401 Unauthorized (this account isn't
// provisioned for the legacy Plans/Subscriptions product), crashing the
// webhook handler. Razorpay's own at-least-once redelivery then retried the
// same crash repeatedly (six 500s observed live in ~1 minute), and the
// add-on purchase never committed — pendingAddonAddition stuck forever.
//
// Drives the REAL exports.handleWebhook entry point (signature verification
// included), not a reimplementation.
//
// Run with: CONFIRM_TEST_DB=yes MONGO_URI=<disposable db> node scripts/verifyAddonPurchaseCommitCAWNoLegacyCall.js

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
require('dotenv').config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const { handleWebhook } = require('../controllers/subscriptionController');

const razorpay = require('../config/razorpay');
razorpay.subscriptions = razorpay.subscriptions || {};
razorpay.subscriptions.update = async () => { throw new Error('must never be called for a CAW subscription — no razorpaySubscriptionId'); };
razorpay.plans = razorpay.plans || {};
razorpay.plans.create = async () => { throw { statusCode: 401, error: 'Unauthorized' }; }; // reproduces the real account's actual behavior

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database.');
  process.exit(1);
}

function buildWebhookCall(eventName, paymentEntityOverrides, eventId) {
  const body = {
    event: eventName,
    payload: { payment: { entity: { id: `pay_fixture_${Date.now()}`, amount: 118000, status: 'captured', method: 'card', ...paymentEntityOverrides } } },
  };
  const rawBody = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return {
    req: { headers: { 'x-razorpay-signature': signature, 'x-razorpay-event-id': eventId }, rawBody, body },
    res: { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } },
  };
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}:`, err); }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running CAW add-on-purchase commit fixture...\n');

  if (!(await PlanConfig.findOne({ planId: 'growth' }))) {
    await PlanConfig.create({ planId: 'growth', monthlyPrice: 450, yearlyPrice: 4800, isActive: true, features: {} });
  }

  await test('CAW add-on purchase commits successfully (200) — must NEVER call the legacy Razorpay Plans/Subscriptions API at all', async () => {
    const org = await Organization.create({ name: 'Webhook 500 Fix Fixture', code: 'wh500-' + Date.now() });
    const orderId = `order_fixture_wh500_${Date.now()}`;
    const sub = await Subscription.create({
      organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
      billingCycle: 'yearly', pricePerUser: 4800, userCount: 1, totalAmount: 4800,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
      // No razorpaySubscriptionId — a real CAW subscription.
      activeAddons: [{ addonKey: 'seat', quantity: 2, pricePerUnit: 100, billingCycle: 'monthly', addedAt: new Date() }],
      pendingAddonAddition: { addonKey: 'seat', quantity: 1, pricePerUnit: 1000, prorationAmount: 1180, orderId, billingCycle: 'yearly', createdAt: new Date() },
    });

    const { req, res } = buildWebhookCall('payment.captured', { order_id: orderId }, `evt_wh500_${Date.now()}`);
    await handleWebhook(req, res);

    assert.equal(res.statusCode, 200, `must succeed, not crash — got ${res.statusCode}: ${JSON.stringify(res.body)}`);

    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.pendingAddonAddition?.orderId, undefined, 'the purchase must actually commit — no longer stuck pending');
    const addedSeat = reloaded.activeAddons.find((a) => a.addonKey === 'seat' && a.billingCycle === 'yearly');
    assert.ok(addedSeat, 'the new yearly seat instance must be added');
    assert.equal(addedSeat.quantity, 1);

    await Subscription.deleteOne({ _id: sub._id });
    await Organization.deleteOne({ _id: org._id });
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
