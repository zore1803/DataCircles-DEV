// scripts/verifyMonthlyToAnnualPreviewApiSurface.js
//
// Drives the real exported controller function (previewMonthlyToAnnualTransition)
// via req/res mocks, not a reimplementation — same pattern as
// verifyAddonCycleApiSurface.js.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyMonthlyToAnnualPreviewApiSurface.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const subscriptionController = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database.');
  process.exit(1);
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}:`, err); }
}

const cleanupIds = [];
async function cleanup() {
  if (cleanupIds.length) await Subscription.deleteMany({ _id: { $in: cleanupIds } });
  cleanupIds.length = 0;
}

async function makeSubscription(overrides = {}) {
  const now = new Date();
  const sub = await Subscription.create({
    organization: new mongoose.Types.ObjectId(),
    planName: 'starter', billingCycle: 'monthly', pricePerUser: 250, userCount: 1, totalAmount: 250,
    isPaymentConfirmed: true, billingAnchor: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
    currentPeriodStart: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000),
    ...overrides,
  });
  cleanupIds.push(sub._id);
  return sub;
}

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running Monthly->Annual preview API-surface fixtures...\n');

  if (!(await PlanConfig.findOne({ planId: 'growth' }))) {
    await PlanConfig.create({ planId: 'growth', monthlyPrice: 450, yearlyPrice: 4800, isActive: true, features: {} });
  }

  await test('preview endpoint: same-tier (targetPlanId omitted) succeeds, returns pricing breakdown, creates nothing', async () => {
    const sub = await makeSubscription();
    const req = { user: { organization: sub.organization }, query: {} };
    const res = mockRes();
    await subscriptionController.previewMonthlyToAnnualTransition(req, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.fromPlanId, 'starter');
    assert.equal(res.body.toPlanId, 'starter');
    assert.ok(res.body.amount > 0);
    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.pendingCycleTransition?.orderId, undefined, 'preview endpoint must not create a pending transition');
    await cleanup();
  });

  await test('preview endpoint: cross-tier target succeeds', async () => {
    const sub = await makeSubscription();
    const req = { user: { organization: sub.organization }, query: { targetPlanId: 'growth' } };
    const res = mockRes();
    await subscriptionController.previewMonthlyToAnnualTransition(req, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.toPlanId, 'growth');
    await cleanup();
  });

  await test('preview endpoint: yearly subscription rejected with clean 400', async () => {
    const sub = await makeSubscription({ billingCycle: 'yearly', pricePerUser: 2400, totalAmount: 2400 });
    const req = { user: { organization: sub.organization }, query: {} };
    const res = mockRes();
    await subscriptionController.previewMonthlyToAnnualTransition(req, res);
    assert.equal(res.statusCode, 400);
    await cleanup();
  });

  await test('preview endpoint: unknown target plan rejected with clean 404', async () => {
    const sub = await makeSubscription();
    const req = { user: { organization: sub.organization }, query: { targetPlanId: 'nonexistent' } };
    const res = mockRes();
    await subscriptionController.previewMonthlyToAnnualTransition(req, res);
    assert.equal(res.statusCode, 404);
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
