// scripts/verifyReactivateAndChangePlan.js
//
// Task B (Aug 2026): plan cards allow Downgrade/Upgrade while a cancellation
// is scheduled. Default chosen: picking a new plan while cancelAtPeriodEnd
// is true implicitly cancels the scheduled cancellation and proceeds — same
// precedent as the Monthly->Annual transition superseding a pending
// PLAN_CHANGE. updateSubscription() (subscriptionController.js) hard-blocks
// by default (CANCELLATION_PENDING) and only clears cancelAtPeriodEnd +
// cancels the pending CANCELLATION ScheduledChange when the caller opts in
// via reactivateAndProceed: true.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyReactivateAndChangePlan.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const ScheduledChange = require('../models/ScheduledChange');
const { updateSubscription } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database.');
  process.exit(1);
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}:`, err); }
  finally { await cleanup(); }
}

function mockReqRes(organizationId, body) {
  let jsonBody, statusCode = 200;
  return {
    req: { user: { organization: organizationId, _id: new mongoose.Types.ObjectId() }, body },
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

async function makeCancelledSub() {
  const org = await Organization.create({ name: 'Reactivate+ChangePlan Fixture', code: 'react-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) });
  cleanupIds.orgs.push(org._id);
  const sub = await Subscription.create({
    organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 450, userCount: 1, totalAmount: 450,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: true,
  });
  cleanupIds.subs.push(sub._id);
  const sc = await ScheduledChange.create({
    organization: org._id, subscription: sub._id, type: 'CANCELLATION', status: 'PENDING',
    effectiveAt: sub.currentPeriodEnd, payload: { cancelAtPeriodEnd: true },
  });
  cleanupIds.scs.push(sc._id);
  return { org, sub, sc };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running reactivate-and-change-plan fixtures...\n');

  await test('default (no flag): a scheduled cancellation still hard-blocks a plan change — CANCELLATION_PENDING, nothing altered', async () => {
    const { org, sub, sc } = await makeCancelledSub();
    const { req, res, get } = mockReqRes(org._id, { planId: 'starter', billingCycle: 'monthly' });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = get();

    assert.equal(statusCode, 400);
    assert.equal(jsonBody.code, 'CANCELLATION_PENDING');

    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.cancelAtPeriodEnd, true, 'must remain scheduled to cancel — nothing committed on the blocked attempt');
    assert.equal(reloaded.planName, 'growth', 'plan must be unchanged');
    const scReloaded = await ScheduledChange.findById(sc._id);
    assert.equal(scReloaded.status, 'PENDING', 'the CANCELLATION ScheduledChange must still be pending');
    await cleanup();
  });

  await test('reactivateAndProceed:true — cancellation clears, ScheduledChange is cancelled, and the new plan proceeds (not blocked)', async () => {
    const { org, sub, sc } = await makeCancelledSub();
    const { req, res, get } = mockReqRes(org._id, { planId: 'starter', billingCycle: 'monthly', reactivateAndProceed: true });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = get();

    assert.equal(statusCode, 200, JSON.stringify(jsonBody));

    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.cancelAtPeriodEnd, false, 'cancellation must be cleared — the subscription stays active');
    const scReloaded = await ScheduledChange.findById(sc._id);
    assert.equal(scReloaded.status, 'CANCELLED', 'the pending CANCELLATION ScheduledChange must itself be cancelled, not left dangling');

    // Starter < Growth is a downgrade — this path schedules a PLAN_CHANGE for
    // period end rather than switching immediately, so planName stays
    // 'growth' for now but a fresh scheduled change must now exist.
    const planChangeSC = await ScheduledChange.findOne({ subscription: sub._id, type: 'PLAN_CHANGE', status: 'PENDING' });
    assert.ok(planChangeSC, 'the new plan change must actually proceed (not silently no-op) once reactivation is granted');
    cleanupIds.scs.push(planChangeSC._id);
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
