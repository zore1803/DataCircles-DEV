// scripts/verifyTransitionPreservesScheduledRemoval.js
//
// Live-QA correctness fix (Aug 2026): a user with an add-on removal already
// scheduled (e.g. Seat ×2, 1 scheduled for removal) who then initiates a
// Monthly->Annual transition must see the CHOICE (and, if they convert, the
// CHARGE) computed against the SURVIVING quantity only — the pending
// removal must never be silently ignored or overwritten. Confirmed this was
// a real bug: computeAddonConversionPricing used to read the raw
// (pre-removal) quantity directly.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyTransitionPreservesScheduledRemoval.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');
const ScheduledChange = require('../models/ScheduledChange');
const { previewMonthlyToAnnualTransition, startMonthlyToAnnualTransition } = require('../utils/cycleTransitionLifecycle');
const { getEntitlementWindow } = require('../utils/prorationMath');

const razorpay = require('../config/razorpay');
let orderCounter = 0;
razorpay.orders = razorpay.orders || {};
razorpay.orders.create = async (params) => ({ id: `order_test_scheduledremoval_${orderCounter++}`, amount: params.amount });

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database.');
  process.exit(1);
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}:`, err); }
}

const cleanupIds = { subs: [], orgs: [], scs: [], addonKey: null };
async function cleanup() {
  if (cleanupIds.scs.length) await ScheduledChange.deleteMany({ _id: { $in: cleanupIds.scs } });
  if (cleanupIds.subs.length) await Subscription.deleteMany({ _id: { $in: cleanupIds.subs } });
  if (cleanupIds.orgs.length) await Organization.deleteMany({ _id: { $in: cleanupIds.orgs } });
  cleanupIds.subs = []; cleanupIds.orgs = []; cleanupIds.scs = [];
}

async function simulateCommit(sub, addonConversions, nowAtCommit) {
  const reloaded = await Subscription.findById(sub._id);
  const pending = reloaded.pendingCycleTransition;
  const { windowStart: recomputedStart, windowEnd: recomputedEnd } = getEntitlementWindow(reloaded.billingAnchor, nowAtCommit);

  reloaded.billingCycle = pending.targetBillingCycle;
  reloaded.pricePerUser = pending.targetPricePerUser;
  reloaded.totalAmount = pending.targetPricePerUser;
  reloaded.currentPeriodStart = recomputedStart;
  reloaded.currentPeriodEnd = recomputedEnd;
  reloaded.pendingCycleTransition = undefined;

  for (const conversion of addonConversions) {
    const idx = reloaded.activeAddons.findIndex((a) => a.addonKey === conversion.addonKey && (a.billingCycle || 'monthly') !== 'yearly');
    if (idx < 0) continue;
    const existingPlain = reloaded.activeAddons[idx].toObject ? reloaded.activeAddons[idx].toObject() : reloaded.activeAddons[idx];
    const remainingMonthlyQty = existingPlain.quantity - conversion.quantity;
    if (remainingMonthlyQty > 0) {
      reloaded.activeAddons[idx] = { ...existingPlain, quantity: remainingMonthlyQty };
      reloaded.activeAddons.push({ addonKey: conversion.addonKey, quantity: conversion.quantity, pricePerUnit: conversion.toPricePerUnit, billingCycle: 'yearly', addedAt: new Date(), periodEnd: recomputedEnd });
    } else {
      reloaded.activeAddons[idx] = { ...existingPlain, billingCycle: 'yearly', pricePerUnit: conversion.toPricePerUnit, periodEnd: recomputedEnd };
    }
  }

  await reloaded.save();
  return { recomputedEnd };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running transition + scheduled-removal preservation fixtures...\n');

  if (!(await PlanConfig.findOne({ planId: 'growth' }))) {
    await PlanConfig.create({ planId: 'growth', monthlyPrice: 450, yearlyPrice: 4800, isActive: true, features: {} });
  }
  const plan = await PlanConfig.findOne({ planId: 'growth' });

  const fixtureAddonKey = 'fixture_scheduledremoval_' + Date.now();
  await PlanAddon.create({
    key: fixtureAddonKey, displayName: 'Fixture Addon', availableOnPlans: [],
    isActive: true, pricingType: 'quantity', effectType: 'flag_only', price: { monthly: 100, yearly: 1000 },
  });

  async function makeSubWithPendingRemoval() {
    const org = await Organization.create({ name: 'Scheduled Removal Transition Fixture', code: 'schedremoval-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) });
    cleanupIds.orgs.push(org._id);
    const sub = await Subscription.create({
      organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
      billingCycle: 'monthly', pricePerUser: 450, userCount: 1, totalAmount: 650,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      billingAnchor: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      activeAddons: [{ addonKey: fixtureAddonKey, quantity: 2, pricePerUnit: 100, billingCycle: 'monthly', addedAt: new Date() }],
      pendingAddonRemovals: [{ addonKey: fixtureAddonKey, displayName: 'Fixture Addon', quantity: 1, pricePerUnit: 100, effectiveAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000) }],
    });
    cleanupIds.subs.push(sub._id);
    const sc = await ScheduledChange.create({
      organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING',
      effectiveAt: sub.currentPeriodEnd, payload: { addonKey: fixtureAddonKey, quantity: 1 },
    });
    cleanupIds.scs.push(sc._id);
    return { sub, sc };
  }

  await test('PREVIEW: choosable/convertible quantity reflects the SURVIVING quantity (2 - 1 scheduled = 1), not the raw 2', async () => {
    const { sub } = await makeSubWithPendingRemoval();
    const preview = await previewMonthlyToAnnualTransition({ subscription: sub, plan, addonChoices: { [fixtureAddonKey]: 'yearly' } });

    assert.equal(preview.addonConversions.length, 1);
    assert.equal(preview.addonConversions[0].quantity, 1, 'must offer/price only the surviving 1 unit, not the raw 2');
    await cleanup();
  });

  await test('COMMIT: converting the surviving unit leaves the scheduled removal COMPLETELY intact — split into two instances, not one collapsed annual instance', async () => {
    const { sub, sc } = await makeSubWithPendingRemoval();

    const initResult = await startMonthlyToAnnualTransition({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan, addonChoices: { [fixtureAddonKey]: 'yearly' },
    });
    assert.equal(initResult.addonConversions[0].quantity, 1);

    await simulateCommit(sub, initResult.addonConversions, new Date());

    const reloaded = await Subscription.findById(sub._id);
    const monthlyInstance = reloaded.activeAddons.find((a) => a.addonKey === fixtureAddonKey && a.billingCycle === 'monthly');
    const annualInstance = reloaded.activeAddons.find((a) => a.addonKey === fixtureAddonKey && a.billingCycle === 'yearly');

    assert.ok(monthlyInstance, 'the monthly instance must still exist — it still has 1 unit scheduled for removal');
    assert.equal(monthlyInstance.quantity, 1, 'monthly instance must shrink to exactly the un-converted remainder (2 - 1 converted = 1)');
    assert.ok(annualInstance, 'a new annual instance must exist for the converted unit');
    assert.equal(annualInstance.quantity, 1);

    // The ORIGINAL scheduled removal must be completely untouched — same
    // record, same status, same quantity.
    const scReloaded = await ScheduledChange.findById(sc._id);
    assert.equal(scReloaded.status, 'PENDING', 'the pre-existing scheduled removal must survive the transition untouched');
    assert.equal(scReloaded.payload.quantity, 1);

    const stillPendingRemoval = reloaded.pendingAddonRemovals.find((r) => r.addonKey === fixtureAddonKey);
    assert.ok(stillPendingRemoval, 'pendingAddonRemovals must still list this removal');
    assert.equal(stillPendingRemoval.quantity, 1);

    await cleanup();
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
