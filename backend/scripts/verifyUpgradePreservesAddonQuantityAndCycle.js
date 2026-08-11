// scripts/verifyUpgradePreservesAddonQuantityAndCycle.js
//
// Live-QA correctness fix (Aug 2026) — reproduces a real reported incident
// exactly: Starter with Seat ×2, 1 already scheduled for removal (effective
// next renewal), then upgrading to Growth. Two confirmed bugs:
//
//   Bug A: the upgrade's carry-forward computation used the EFFECTIVE
//   (post-scheduled-removal) quantity as if it were the CURRENT quantity —
//   silently executing the scheduled removal early (Seat×2 became Seat×1
//   the instant the upgrade committed, not on the removal's actual date).
//
//   Bug B: classifyAddonsForPlanChange's `compatible` entries (and the
//   upgrade commit's activeAddons rebuild) never carried billingCycle
//   through at all — every upgrade silently stripped it, which is the real
//   mechanism behind a separately-reported "phantom annual add-on" (the
//   addon fell back to whatever the subscription's CURRENT cycle happened
//   to be the next time anything read it, including much later after a
//   Monthly->Annual transition — no actual annual purchase involved).
//
// Drives the REAL exports.updateSubscription (initiation) and
// exports.handleWebhook (commit, signature-verified), not reimplementations.
//
// Run with: CONFIRM_TEST_DB=yes MONGO_URI=<disposable db> node scripts/verifyUpgradePreservesAddonQuantityAndCycle.js

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
require('dotenv').config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');
const ScheduledChange = require('../models/ScheduledChange');
const { updateSubscription, handleWebhook } = require('../controllers/subscriptionController');

const razorpay = require('../config/razorpay');
let orderCounter = 0;
razorpay.orders = razorpay.orders || {};
razorpay.orders.create = async (params) => ({ id: `order_test_upgradeaddon_${orderCounter++}`, amount: params.amount });

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database.');
  process.exit(1);
}

function mockReqRes(organizationId, body) {
  let jsonBody, statusCode = 200;
  return {
    req: { user: { organization: organizationId, _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' }, body },
    res: { status(c) { statusCode = c; return this; }, json(b) { jsonBody = b; return this; } },
    get: () => ({ statusCode, jsonBody }),
  };
}

function buildWebhookCall(eventName, paymentEntityOverrides, eventId) {
  const body = {
    event: eventName,
    payload: { payment: { entity: { id: `pay_fixture_${Date.now()}`, amount: 0, status: 'captured', method: 'card', ...paymentEntityOverrides } } },
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
  console.log('Connected. Running upgrade quantity/cycle preservation fixture...\n');

  if (!(await PlanConfig.findOne({ planId: 'starter' }))) {
    await PlanConfig.create({ planId: 'starter', monthlyPrice: 250, yearlyPrice: 2400, isActive: true, features: {} });
  }
  if (!(await PlanConfig.findOne({ planId: 'growth' }))) {
    await PlanConfig.create({ planId: 'growth', monthlyPrice: 450, yearlyPrice: 4800, isActive: true, features: {} });
  }
  const fixtureAddonKey = 'fixture_upgrade_seat_' + Date.now();
  await PlanAddon.create({
    key: fixtureAddonKey, displayName: 'Fixture Seat', availableOnPlans: [],
    isActive: true, pricingType: 'quantity', effectType: 'flag_only', price: { monthly: 100, yearly: 1000 },
  });

  await test('Starter Seat×2 (1 scheduled for removal) upgrading to Growth: keeps the FULL ×2 immediately, billingCycle preserved, and the original scheduled removal survives untouched', async () => {
    const org = await Organization.create({ name: 'Upgrade Addon Preservation Fixture', code: 'upgaddon-' + Date.now() });
    const sub = await Subscription.create({
      organization: org._id, planName: 'starter', appStatus: 'active', status: 'active',
      billingCycle: 'monthly', pricePerUser: 250, userCount: 1, totalAmount: 450,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      activeAddons: [{ addonKey: fixtureAddonKey, quantity: 2, pricePerUnit: 100, billingCycle: 'monthly', addedAt: new Date() }],
      pendingAddonRemovals: [{ addonKey: fixtureAddonKey, displayName: 'Fixture Seat', quantity: 1, pricePerUnit: 100, effectiveAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000) }],
    });
    const sc = await ScheduledChange.create({
      organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING',
      effectiveAt: sub.currentPeriodEnd, payload: { addonKey: fixtureAddonKey, quantity: 1 },
    });

    // Initiate the upgrade.
    const { req, res, get } = mockReqRes(org._id, { planId: 'growth', billingCycle: 'monthly' });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = get();
    assert.equal(statusCode, 200, JSON.stringify(jsonBody));

    const afterInit = await Subscription.findById(sub._id);
    const orderId = afterInit.pendingPlanChange.orderId;
    const chargeAmount = afterInit.pendingPlanChange.proratedDiffCharged;
    assert.ok(orderId);

    // Sanity: at INITIATION time (before commit), the current subscription's
    // own activeAddons must still be completely untouched (still Starter,
    // still Seat×2) — nothing commits until the webhook fires.
    assert.equal(afterInit.planName, 'starter');
    assert.equal(afterInit.activeAddons[0].quantity, 2);

    // Commit via the real webhook.
    const { req: whReq, res: whRes } = buildWebhookCall('payment.captured', { order_id: orderId, amount: Math.round(chargeAmount * 100) }, 'evt_upgaddon_' + Date.now());
    await handleWebhook(whReq, whRes);
    assert.equal(whRes.statusCode, 200, JSON.stringify(whRes.body));

    const afterCommit = await Subscription.findById(sub._id);
    assert.equal(afterCommit.planName, 'growth', 'the base plan upgrade itself must have committed');

    const seatEntry = afterCommit.activeAddons.find((a) => a.addonKey === fixtureAddonKey);
    assert.ok(seatEntry, 'the add-on must still be present after the upgrade');
    assert.equal(seatEntry.quantity, 2, 'Bug A: must keep the FULL current quantity (2), not silently apply the scheduled removal early (would show 1)');
    assert.equal(seatEntry.billingCycle, 'monthly', 'Bug B: billingCycle must survive the upgrade — a missing field here is what later mislabels this as annual once the base plan eventually switches cycle');

    // The ORIGINAL scheduled removal must still be there, untouched, still
    // targeting exactly 1 unit — not consumed, not duplicated.
    const scReloaded = await ScheduledChange.findById(sc._id);
    assert.equal(scReloaded.status, 'PENDING', 'the pre-existing scheduled removal must survive the upgrade');
    assert.equal(scReloaded.payload.quantity, 1);

    const pendingRemoval = afterCommit.pendingAddonRemovals.find((r) => r.addonKey === fixtureAddonKey);
    assert.ok(pendingRemoval, 'pendingAddonRemovals must still list this removal after the upgrade');
    assert.equal(pendingRemoval.quantity, 1);

    await ScheduledChange.deleteMany({ subscription: sub._id });
    await Subscription.deleteOne({ _id: sub._id });
    await Organization.deleteOne({ _id: org._id });
  });

  await PlanAddon.deleteOne({ key: fixtureAddonKey });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
