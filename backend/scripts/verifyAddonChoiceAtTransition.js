// scripts/verifyAddonChoiceAtTransition.js
//
// Task 2 (Aug 2026): explicit per-add-on choice at the Monthly->Annual
// transition checkout. Default (no choice made) is 'monthly' — a pure
// no-op, per Task 1's own fix and the standing rule that a monthly add-on's
// cadence never changes automatically. An explicit 'yearly' choice prices a
// REAL, itemized, separately-tracked conversion, reusing the exact same
// addon_purchase proration already used for a fresh annual add-on purchase.
//
// Business-model note (settled this session, restated in cycleTransitionLifecycle.js):
// "keep Monthly" preserves the add-on's price/cadence LABEL and its own
// removal-timing — it does NOT trigger a separate monthly charge event,
// since this system has no independent per-item renewal pipeline (SU9
// policy, BILLING_DOMAIN_SPECIFICATION.md) — the actual recurring charge
// still rides on the single combined subscription-level renewal either way.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyAddonChoiceAtTransition.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');
const { previewMonthlyToAnnualTransition, startMonthlyToAnnualTransition } = require('../utils/cycleTransitionLifecycle');
const { getEntitlementWindow } = require('../utils/prorationMath');

const razorpay = require('../config/razorpay');
let orderCounter = 0;
razorpay.orders = razorpay.orders || {};
razorpay.orders.create = async (params) => ({ id: `order_test_addonchoice_${orderCounter++}`, amount: params.amount });

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database.');
  process.exit(1);
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}:`, err); }
}

const cleanupIds = { subs: [], orgs: [] };
async function cleanup() {
  if (cleanupIds.subs.length) await Subscription.deleteMany({ _id: { $in: cleanupIds.subs } });
  if (cleanupIds.orgs.length) await Organization.deleteMany({ _id: { $in: cleanupIds.orgs } });
  cleanupIds.subs = []; cleanupIds.orgs = [];
}

// Scope-safety fix (Aug 2026): this fixture used to reuse the SHARED 'seat'
// PlanAddon catalog key, upserting it with a FULL replacement object
// (including availableOnPlans: []) on every run — a real incident where
// that silently wiped a live-QA test setup that deliberately excluded one
// plan. A fixture must own a disposable, uniquely-named catalog entry for
// anything it needs to assert prices/compatibility against — never touch
// shared, non-test-owned config data, even to "restore" it afterward.
let FIXTURE_ADDON_KEY;

async function makeSubWithMonthlyAddon(overrides = {}) {
  const org = await Organization.create({ name: 'Addon Choice Fixture', code: 'addonchoice-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) });
  cleanupIds.orgs.push(org._id);
  const anchor = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const sub = await Subscription.create({
    organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 450, userCount: 1, totalAmount: 550,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    billingAnchor: anchor,
    activeAddons: [{ addonKey: FIXTURE_ADDON_KEY, quantity: 2, pricePerUnit: 100, billingCycle: 'monthly', addedAt: new Date() }],
    ...overrides,
  });
  cleanupIds.subs.push(sub._id);
  return sub;
}

// Mirrors the payment.captured webhook commit branch's addon-conversion
// logic directly (same reimplemented-commit pattern this codebase's own
// verifyMonthlyToAnnualTransition.js fixture already uses for the base
// transition), so this fixture can drive commit without the full webhook
// payload/signature machinery.
async function simulateCommit(subscription, addonConversions, nowAtCommit) {
  const reloaded = await Subscription.findById(subscription._id);
  const pending = reloaded.pendingCycleTransition;
  const { windowStart: recomputedStart, windowEnd: recomputedEnd } = getEntitlementWindow(reloaded.billingAnchor, nowAtCommit);

  reloaded.billingCycle = pending.targetBillingCycle;
  reloaded.pricePerUser = pending.targetPricePerUser;
  reloaded.totalAmount = pending.targetPricePerUser;
  reloaded.currentPeriodStart = recomputedStart;
  reloaded.currentPeriodEnd = recomputedEnd;
  reloaded.pendingCycleTransition = undefined;

  const convertedKeys = new Set();
  for (const conversion of addonConversions) {
    const idx = reloaded.activeAddons.findIndex((a) => a.addonKey === conversion.addonKey && (a.billingCycle || 'monthly') !== 'yearly');
    if (idx < 0) continue;
    convertedKeys.add(conversion.addonKey);
    reloaded.activeAddons[idx] = {
      ...(reloaded.activeAddons[idx].toObject ? reloaded.activeAddons[idx].toObject() : reloaded.activeAddons[idx]),
      billingCycle: 'yearly',
      pricePerUnit: conversion.toPricePerUnit,
      periodEnd: recomputedEnd,
    };
  }

  // Task 1: mirrors subscriptionController.js's own "kept Monthly" loop —
  // every remaining monthly add-on gets its independent renewal clock
  // started now that the base plan just became annual.
  for (const addon of reloaded.activeAddons) {
    if (convertedKeys.has(addon.addonKey)) continue;
    if ((addon.billingCycle || 'monthly') !== 'monthly') continue;
    if (addon.nextRenewalAt) continue;
    addon.nextRenewalAt = require('../utils/addonRenewalEngine').computeNextAddonRenewalDate(nowAtCommit);
  }

  await reloaded.save();
  return { recomputedStart, recomputedEnd };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running per-add-on transition choice fixtures...\n');

  if (!(await PlanConfig.findOne({ planId: 'growth' }))) {
    await PlanConfig.create({ planId: 'growth', monthlyPrice: 450, yearlyPrice: 4800, isActive: true, features: {} });
  }
  const plan = await PlanConfig.findOne({ planId: 'growth' });

  // Fresh, uniquely-named, disposable catalog entry — owned entirely by
  // this fixture run, deleted at the end. Never the shared 'seat' key.
  FIXTURE_ADDON_KEY = 'fixture_addon_choice_' + Date.now();
  await PlanAddon.create({
    key: FIXTURE_ADDON_KEY, displayName: 'Fixture Addon', availableOnPlans: [],
    isActive: true, pricingType: 'quantity', effectType: 'flag_only', price: { monthly: 100, yearly: 1000 },
  });

  await test('DEFAULT (no addonChoices at all): existing monthly add-on is a pure no-op — untouched, base transition amount unaffected', async () => {
    const sub = await makeSubWithMonthlyAddon();
    const preview = await previewMonthlyToAnnualTransition({ subscription: sub, plan }); // no addonChoices passed
    assert.equal(preview.addonConversions.length, 0, 'default must never auto-convert');
    assert.equal(preview.totalAddonConversionAmount, 0);

    const initResult = await startMonthlyToAnnualTransition({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan,
    });
    assert.equal(initResult.addonConversions.length, 0);
    assert.equal(initResult.paymentDetails.amount, initResult.amount * 100, 'Order amount must be the base transition amount alone — no addon conversion to add');

    const nowAtCommit = new Date();
    await simulateCommit(sub, [], nowAtCommit);
    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.activeAddons[0].billingCycle, 'monthly', '"keep Monthly" (default) must leave billingCycle untouched');
    assert.equal(reloaded.activeAddons[0].pricePerUnit, 100, 'pricePerUnit must be untouched');
    assert.equal(reloaded.billingCycle, 'yearly', 'the BASE plan transition itself must still proceed normally');
    // Task 1: "kept Monthly" must now start a REAL independent renewal
    // clock — this is the exact undercharging bug Task 1 exists to close.
    assert.ok(reloaded.activeAddons[0].nextRenewalAt, 'a kept-Monthly add-on surviving an annual transition must get an independent renewal clock — it must actually be charged monthly going forward');
    const { computeNextAddonRenewalDate } = require('../utils/addonRenewalEngine');
    assert.equal(reloaded.activeAddons[0].nextRenewalAt.getTime(), computeNextAddonRenewalDate(nowAtCommit).getTime());
    await cleanup();
  });

  await test('EXPLICIT "keep Monthly" choice: same as default — untouched', async () => {
    const sub = await makeSubWithMonthlyAddon();
    const preview = await previewMonthlyToAnnualTransition({ subscription: sub, plan, addonChoices: { [FIXTURE_ADDON_KEY]: 'monthly' } });
    assert.equal(preview.addonConversions.length, 0);
    await cleanup();
  });

  await test('EXPLICIT "convert to Annual": real itemized charge computed, base transition charge is separate and unaffected', async () => {
    const sub = await makeSubWithMonthlyAddon();
    const preview = await previewMonthlyToAnnualTransition({ subscription: sub, plan, addonChoices: { [FIXTURE_ADDON_KEY]: 'yearly' } });

    assert.equal(preview.addonConversions.length, 1);
    const conversion = preview.addonConversions[0];
    assert.equal(conversion.addonKey, FIXTURE_ADDON_KEY);
    assert.equal(conversion.quantity, 2);
    assert.equal(conversion.fromPricePerUnit, 100);
    assert.equal(conversion.toPricePerUnit, 1000);
    assert.ok(conversion.amount > 0);

    // Base transition amount must be IDENTICAL to the no-addon-choice case —
    // the addon conversion is priced and charged separately, never folded
    // into or affecting the base plan's own proration.
    const baselinePreview = await previewMonthlyToAnnualTransition({ subscription: sub, plan });
    assert.equal(preview.amount, baselinePreview.amount, 'base transition amount must be unaffected by an addon conversion choice');
    assert.equal(preview.totalAddonConversionAmount, conversion.amount);
    assert.equal(preview.grandTotal, preview.amount + conversion.amount);
    await cleanup();
  });

  await test('COMMIT with "convert to Annual": correct new periodEnd, correct annual price, base transition unaffected/separate, Order charges the COMBINED total', async () => {
    const sub = await makeSubWithMonthlyAddon();

    const initResult = await startMonthlyToAnnualTransition({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan, addonChoices: { [FIXTURE_ADDON_KEY]: 'yearly' },
    });

    assert.equal(initResult.addonConversions.length, 1);
    const conversion = initResult.addonConversions[0];
    const expectedOrderAmount = (initResult.amount + conversion.amount) * 100;
    assert.equal(initResult.paymentDetails.amount, expectedOrderAmount, 'the Order must charge the COMBINED total (base + addon conversion) as one payment');

    const nowAtCommit = new Date();
    const { recomputedEnd } = await simulateCommit(sub, initResult.addonConversions, nowAtCommit);

    const reloaded = await Subscription.findById(sub._id);
    assert.equal(reloaded.activeAddons[0].billingCycle, 'yearly', 'add-on must now be annual');
    assert.equal(reloaded.activeAddons[0].pricePerUnit, 1000, 'add-on must be charged the REAL annual per-unit price');
    assert.equal(reloaded.activeAddons[0].quantity, 2, 'quantity must be preserved through the conversion');
    assert.equal(reloaded.activeAddons[0].periodEnd.getTime(), recomputedEnd.getTime(), 'add-on periodEnd must align to the new annual window');
    assert.equal(reloaded.billingCycle, 'yearly', 'the base plan transition must have committed normally, independent of the addon conversion');
    await cleanup();
  });

  await test('target plan does not support the add-on at all: flagged informationally, access continues, scheduled for removal at its OWN natural end (not forced early)', async () => {
    // Scope-safety fix (Aug 2026): this used to mutate the SHARED 'seat'
    // PlanAddon catalog entry directly (availableOnPlans: ['starter'], then
    // "restored" to []) — a real incident where this fixture's own restore
    // step overwrote a live-QA test setup with a DIFFERENT value than the
    // original ([] = universally available, when the real setup deliberately
    // excluded one plan). Fixtures must never touch shared, non-disposable
    // catalog data — a fresh, uniquely-named, disposable PlanAddon document
    // achieves the exact same "incompatible with the target plan" condition
    // with zero risk of colliding with anything real.
    const disposableAddonKey = 'fixture_incompatible_addon_' + Date.now();
    await PlanAddon.create({
      key: disposableAddonKey, displayName: 'Fixture Incompatible Addon',
      availableOnPlans: ['starter'], // growth (this fixture's target) does not support it
      isActive: true, pricingType: 'quantity', effectType: 'flag_only', price: { monthly: 100, yearly: 1000 },
    });

    const sub = await makeSubWithMonthlyAddon({
      activeAddons: [{ addonKey: disposableAddonKey, quantity: 2, pricePerUnit: 100, billingCycle: 'monthly', addedAt: new Date() }],
    });

    const preview = await previewMonthlyToAnnualTransition({ subscription: sub, plan }); // target = growth (same tier)
    assert.equal(preview.addonConversions.length, 0, 'no choice offered for an incompatible add-on');
    assert.equal(preview.incompatibleAddons.length, 1);
    assert.equal(preview.incompatibleAddons[0].addonKey, disposableAddonKey);
    assert.ok(preview.incompatibleAddons[0].effectiveAt, 'must report when access actually ends');
    assert.ok(new Date(preview.incompatibleAddons[0].effectiveAt) > new Date(), 'must not be in the past — access continues until then');

    await PlanAddon.deleteOne({ key: disposableAddonKey });
    await cleanup();
  });

  await PlanAddon.deleteOne({ key: FIXTURE_ADDON_KEY });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
