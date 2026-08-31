// scripts/verifyAddonPurchasePreview.js
//
// Task 4 (Aug 2026): the add-on purchase confirmation UI showed a client-side
// estimate, not a backend-authoritative amount — unlike add-on REMOVAL,
// which already has previewAddonRemoval. This verifies the new read-only
// previewAddonPurchase() (utils/addonPurchaseLifecycle.js) computes the SAME
// number the real startAddonPurchase() would, without reserving a referral
// reward, creating an Order, or creating a CommercialTransaction.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyAddonPurchasePreview.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');
const CommercialTransaction = require('../models/CommercialTransaction');
const RewardUsage = require('../models/RewardUsage');
const { previewAddonPurchase, startAddonPurchase } = require('../utils/addonPurchaseLifecycle');

const razorpay = require('../config/razorpay');
let orderCounter = 0;
razorpay.orders = razorpay.orders || {};
razorpay.orders.create = async () => ({ id: `order_test_addonpreview_${orderCounter++}` });

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

const cleanupIds = { subs: [], orgs: [], addons: [] };
async function cleanup() {
  if (cleanupIds.subs.length) await Subscription.deleteMany({ _id: { $in: cleanupIds.subs } });
  if (cleanupIds.orgs.length) await Organization.deleteMany({ _id: { $in: cleanupIds.orgs } });
  cleanupIds.subs = []; cleanupIds.orgs = [];
}

async function makeSubAndAddon(overrides = {}) {
  const org = await Organization.create({ name: 'Addon Preview Fixture', code: 'addonprev-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) });
  cleanupIds.orgs.push(org._id);
  const sub = await Subscription.create({
    organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 450, userCount: 1, totalAmount: 450,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    ...overrides,
  });
  cleanupIds.subs.push(sub._id);

  let plan = await PlanConfig.findOne({ planId: 'growth' });
  if (!plan) plan = await PlanConfig.create({ planId: 'growth', monthlyPrice: 450, yearlyPrice: 4800, isActive: true, features: {} });

  let catalogEntry = await PlanAddon.findOne({ key: 'seat' });
  if (!catalogEntry) {
    catalogEntry = await PlanAddon.create({
      key: 'seat', displayName: 'Seat', availableOnPlans: [], isActive: true,
      pricingType: 'quantity', price: { monthly: 100, yearly: 1000 },
    });
  }

  return { org, sub, plan, catalogEntry };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running add-on purchase PREVIEW fixtures...\n');

  await test('preview creates NOTHING — no CommercialTransaction, no reward reservation, no pendingAddonAddition', async () => {
    const ctCountBefore = await CommercialTransaction.countDocuments({});
    const rewardUsageCountBefore = await RewardUsage.countDocuments({});
    const { sub, plan, catalogEntry } = await makeSubAndAddon();

    const preview = await previewAddonPurchase({ subscription: sub, plan, catalogEntry, addonKey: 'seat', quantity: 2 });
    assert.ok(preview.prorationAmountWithGST > 0);

    const ctCountAfter = await CommercialTransaction.countDocuments({});
    const rewardUsageCountAfter = await RewardUsage.countDocuments({});
    assert.equal(ctCountAfter, ctCountBefore, 'preview must create no CommercialTransaction');
    assert.equal(rewardUsageCountAfter, rewardUsageCountBefore, 'preview must reserve no reward');

    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.pendingAddonAddition?.orderId, undefined, 'preview must leave the subscription completely untouched');
    await cleanup();
  });

  await test('preview amount EXACTLY matches what the real startAddonPurchase would charge for the same inputs (single source of truth)', async () => {
    const { sub, plan, catalogEntry } = await makeSubAndAddon();

    const preview = await previewAddonPurchase({ subscription: sub, plan, catalogEntry, addonKey: 'seat', quantity: 3 });

    const real = await startAddonPurchase({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan, catalogEntry,
      addonKey: 'seat', quantity: 3,
    });

    assert.equal(preview.prorationAmountWithGST, real.prorationAmountWithGST, 'preview and real purchase must agree exactly');
    assert.equal(preview.discountedProrationAmount, real.discountedProrationAmount);
    await cleanup();
  });

  await test('preview respects the annual-add-on-needs-annual-base rule (same guard as the real endpoint)', async () => {
    const { sub, plan, catalogEntry } = await makeSubAndAddon({ billingCycle: 'monthly' });
    await assert.rejects(
      () => previewAddonPurchase({ subscription: sub, plan, catalogEntry, addonKey: 'seat', quantity: 1, billingCycle: 'yearly' }),
      /annual base plan/
    );
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
