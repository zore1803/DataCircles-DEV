// scripts/verifyUndoCancellation.js
//
// Task 2 (Aug 2026): a user who scheduled cancellation by mistake previously
// had no way to simply stay on their current plan — reactivateAndProceed
// (Task B) requires picking a DIFFERENT plan. exports.undoCancellation
// (subscriptionController.js) fills that gap: same plan, same cycle, just
// the CANCELLATION ScheduledChange reversed.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyUndoCancellation.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const ScheduledChange = require('../models/ScheduledChange');
const { undoCancellation } = require('../controllers/subscriptionController');
const BillingEvent = require('../models/BillingEvent');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database.');
  process.exit(1);
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}:`, err); }
}

function mockReqRes(organizationId) {
  let jsonBody, statusCode = 200;
  return {
    req: { user: { organization: organizationId, _id: new mongoose.Types.ObjectId() }, body: {} },
    res: { status(c) { statusCode = c; return this; }, json(b) { jsonBody = b; return this; } },
    get: () => ({ statusCode, jsonBody }),
  };
}

const cleanupIds = { subs: [], orgs: [], scs: [] };
async function cleanup() {
  if (cleanupIds.scs.length) await ScheduledChange.deleteMany({ _id: { $in: cleanupIds.scs } });
  if (cleanupIds.subs.length) await Subscription.deleteMany({ _id: { $in: cleanupIds.subs } });
  if (cleanupIds.orgs.length) await Organization.deleteMany({ _id: { $in: cleanupIds.orgs } });
  cleanupIds.subs = []; cleanupIds.orgs = []; cleanupIds.scs = [];
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running undo-cancellation fixtures...\n');

  await test('schedule cancellation -> undo -> subscription fully active again, current plan/cycle untouched, no scheduled change pending', async () => {
    const org = await Organization.create({ name: 'Undo Cancellation Fixture', code: 'undo-' + Date.now() });
    cleanupIds.orgs.push(org._id);
    const periodEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const sub = await Subscription.create({
      organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
      billingCycle: 'yearly', pricePerUser: 4800, userCount: 2, totalAmount: 9600,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      currentPeriodStart: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: true,
    });
    cleanupIds.subs.push(sub._id);
    const sc = await ScheduledChange.create({
      organization: org._id, subscription: sub._id, type: 'CANCELLATION', status: 'PENDING',
      effectiveAt: periodEnd, payload: { cancelAtPeriodEnd: true },
    });
    cleanupIds.scs.push(sc._id);

    const { req, res, get } = mockReqRes(org._id);
    await undoCancellation(req, res);
    const { statusCode, jsonBody } = get();

    assert.equal(statusCode, 200, JSON.stringify(jsonBody));

    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.cancelAtPeriodEnd, false, 'subscription must be fully active again');
    assert.equal(reloaded.planName, 'growth', 'current plan must be untouched');
    assert.equal(reloaded.billingCycle, 'yearly', 'current cycle must be untouched');
    assert.equal(reloaded.pricePerUser, 4800, 'pricing must be untouched');

    const scReloaded = await ScheduledChange.findById(sc._id);
    assert.equal(scReloaded.status, 'CANCELLED', 'the CANCELLATION ScheduledChange must itself be cancelled');

    const stillPending = await ScheduledChange.findOne({ subscription: sub._id, status: 'PENDING' });
    assert.equal(stillPending, null, 'no scheduled change must remain pending');

    // Task 3 (Aug 2026): the "Staying on undefined" Timeline bug —
    // buildEventSummary() runs ONCE at emitBillingEvent() write time (off the
    // raw before/after passed in) and its result is stored in `summary` —
    // the reloaded BillingEvent document has no `.after` field of its own
    // (only `.afterSnapshot`), so the check must read the already-computed
    // stored `summary`, not re-derive one from the reloaded document.
    const timelineEvent = await BillingEvent.findOne({ subscription: sub._id, eventType: 'SCHEDULE_CANCELLED' }).sort({ createdAt: -1 });
    assert.ok(timelineEvent, 'a SCHEDULE_CANCELLED Timeline event must be recorded');
    assert.equal(timelineEvent.summary?.subtitle, 'Staying on Growth', `subtitle must name the real plan, got "${timelineEvent.summary?.subtitle}"`);
    assert.doesNotMatch(`${timelineEvent.summary?.title} ${timelineEvent.summary?.subtitle}`, /undefined/, 'must never render the literal word "undefined"');
    await cleanup();
  });

  await test('no scheduled cancellation to undo — clean 400, nothing altered', async () => {
    const org = await Organization.create({ name: 'Undo Cancellation Fixture 2', code: 'undo2-' + Date.now() });
    cleanupIds.orgs.push(org._id);
    const sub = await Subscription.create({
      organization: org._id, planName: 'starter', appStatus: 'active', status: 'active',
      billingCycle: 'monthly', pricePerUser: 250, userCount: 1, totalAmount: 250,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    });
    cleanupIds.subs.push(sub._id);

    const { req, res, get } = mockReqRes(org._id);
    await undoCancellation(req, res);
    const { statusCode } = get();

    assert.equal(statusCode, 400);
    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.cancelAtPeriodEnd, false);
    await cleanup();
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
