// scripts/verifyAddonCycleApiSurface.js
//
// Phase 2d.1 (docs/audit/PHASE2_ADDON_CYCLE_TRACE.md): fixture verification
// for the addon purchase/removal HTTP endpoints now accepting/returning an
// optional billingCycle, and the new read-only removal-preview endpoint.
// Drives the real exported controller functions directly (req/res mocks),
// not a reimplementation.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyAddonCycleApiSurface.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');
const subscriptionController = require('../controllers/subscriptionController');

const razorpay = require('../config/razorpay');
razorpay.orders = razorpay.orders || {};
razorpay.orders.create = async () => ({ id: 'order_test_apisurface' });

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

const cleanupIds = [];
async function cleanup() {
  if (cleanupIds.length) await Subscription.deleteMany({ _id: { $in: cleanupIds } });
  cleanupIds.length = 0;
}

async function makeSubscription(billingCycle, overrides = {}) {
  const sub = await Subscription.create({
    organization: new mongoose.Types.ObjectId(),
    planName: 'growth',
    billingCycle,
    pricePerUser: billingCycle === 'monthly' ? 500 : 5000,
    userCount: 1,
    totalAmount: billingCycle === 'monthly' ? 500 : 5000,
    isPaymentConfirmed: true,
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: billingCycle === 'monthly' ? new Date('2026-02-01') : new Date('2027-01-01'),
    razorpaySubscriptionId: 'sub_test_apisurface',
    ...overrides,
  });
  cleanupIds.push(sub._id);
  return sub;
}

async function findOrMakeSeatAddon() {
  let addon = await PlanAddon.findOne({ key: 'seat' });
  if (!addon) {
    addon = await PlanAddon.create({
      key: 'seat', displayName: 'Seat', price: { monthly: 100, yearly: 1000 },
      availableOnPlans: [], targetKey: 'seats', effectType: 'limit_boost', isActive: true,
    });
  }
  return addon;
}

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running Phase 2d.1 API-surface fixtures...\n');

  const plan = await PlanConfig.findOne({ planId: 'growth', isActive: true }) || { planId: 'growth', monthlyPrice: 500, yearlyPrice: 5000 };
  if (!(await PlanConfig.findOne({ planId: 'growth' }))) {
    await PlanConfig.create({ planId: 'growth', monthlyPrice: 500, yearlyPrice: 5000, isActive: true, features: {} });
  }
  await findOrMakeSeatAddon();

  await test('purchase endpoint: monthly base + monthly request succeeds, echoes billingCycle', async () => {
    const sub = await makeSubscription('monthly');
    const req = { user: { organization: sub.organization, _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' }, body: { addonKey: 'seat', quantity: 1, billingCycle: 'monthly' } };
    const res = mockRes();
    await subscriptionController.initiateAddonPurchase(req, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.billingCycle, 'monthly');
    await cleanup();
  });

  await test('purchase endpoint: monthly base + annual request rejected with clean 400', async () => {
    const sub = await makeSubscription('monthly');
    const req = { user: { organization: sub.organization, _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' }, body: { addonKey: 'seat', quantity: 1, billingCycle: 'yearly' } };
    const res = mockRes();
    await subscriptionController.initiateAddonPurchase(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /annual add-on can only be purchased on an annual base plan/);
    await cleanup();
  });

  await test('purchase endpoint: invalid billingCycle value rejected with clean 400', async () => {
    const sub = await makeSubscription('yearly');
    const req = { user: { organization: sub.organization, _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' }, body: { addonKey: 'seat', quantity: 1, billingCycle: 'weekly' } };
    const res = mockRes();
    await subscriptionController.initiateAddonPurchase(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /billingCycle must be/);
    await cleanup();
  });

  await test('purchase endpoint: omitted billingCycle defaults to subscription cycle (backward compatible)', async () => {
    const sub = await makeSubscription('yearly');
    const req = { user: { organization: sub.organization, _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' }, body: { addonKey: 'seat', quantity: 1 } };
    const res = mockRes();
    await subscriptionController.initiateAddonPurchase(req, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.billingCycle, 'yearly');
    await cleanup();
  });

  await test('removal preview endpoint: reports effectiveAt without mutating activeAddons', async () => {
    const sub = await makeSubscription('yearly', {
      activeAddons: [{ addonKey: 'seat', quantity: 2, pricePerUnit: 100, billingCycle: 'monthly', addedAt: new Date() }],
    });
    const req = { user: { organization: sub.organization }, query: { addonKey: 'seat', quantity: '1', billingCycle: 'monthly' } };
    const res = mockRes();
    await subscriptionController.previewAddonRemoval(req, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.remainingQuantity, 1);
    assert.equal(res.body.billingCycle, 'monthly');
    assert.ok(res.body.effectiveAt);
    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.activeAddons[0].quantity, 2, 'preview must not mutate activeAddons');
    await cleanup();
  });

  await test('removal preview endpoint: wrong cycle for an existing addonKey returns 404, not a false match', async () => {
    const sub = await makeSubscription('yearly', {
      activeAddons: [{ addonKey: 'seat', quantity: 2, pricePerUnit: 100, billingCycle: 'monthly', addedAt: new Date() }],
    });
    const req = { user: { organization: sub.organization }, query: { addonKey: 'seat', quantity: '1', billingCycle: 'yearly' } };
    const res = mockRes();
    await subscriptionController.previewAddonRemoval(req, res);
    assert.equal(res.statusCode, 404, JSON.stringify(res.body));
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
