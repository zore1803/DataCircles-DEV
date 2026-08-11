// scripts/verifyDualCycleAddons.js
//
// Phase 2c (docs/audit/PHASE2_ADDON_CYCLE_TRACE.md): fixture verification for
// cycle-aware addon purchase/removal semantics. These call the internal
// functions directly (startAddonPurchase with an explicit billingCycle param,
// scheduleAddonRemoval with an explicit billingCycle param) since no route
// exposes a cycle parameter yet (Phase 2d) — this is deliberately testing the
// backend semantics before any API surface exists for them.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyDualCycleAddons.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');
const ScheduledChange = require('../models/ScheduledChange');
const { startAddonPurchase } = require('../utils/addonPurchaseLifecycle');
const { scheduleAddonRemoval, applyScheduledAddonRemovals } = require('../utils/addonManagement');
const { buildEffectiveSubscription, renewSubscription } = require('../utils/renewalEngine');

// applyScheduledAddonRemovals calls razorpay.subscriptions.update directly
// (not dependency-injected, unlike chargeMandateFn elsewhere) — stub it so
// this fixture can exercise the due/not-due filtering logic without a real
// Razorpay subscription behind the fixture's fake razorpaySubscriptionId.
const razorpay = require('../config/razorpay');
razorpay.subscriptions.update = async () => ({});
razorpay.plans.create = async () => ({ id: 'plan_test_dualcycle' });

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
  cleanupIds.subs = [];
  cleanupIds.scs = [];
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
    razorpaySubscriptionId: 'sub_test_dualcycle',
    ...overrides,
  });
  cleanupIds.subs.push(sub._id);
  return sub;
}

async function findOrMakeSeatAddon() {
  let addon = await PlanAddon.findOne({ key: 'seat' });
  if (!addon) {
    addon = await PlanAddon.create({
      key: 'seat',
      displayName: 'Seat',
      pricingType: 'quantity',
      price: { monthly: 100, yearly: 1000 },
      availableOnPlans: [],
      targetKey: 'seats',
      effectType: 'limit_boost',
      isActive: true,
    });
  }
  return addon;
}

const okOrder = { id: 'order_test_dualcycle' };
const noopInvoiceHooks = {
  createRazorpayOrderFn: async () => okOrder,
  updateCommercialTransactionsFn: async () => {},
  createCommercialTransactionFn: async () => null,
  updateRewardUsageFn: async () => {},
  saveSubscriptionFn: async (sub) => sub.save(),
};

// Simulates the webhook commit merge (subscriptionController.js's
// handlePaymentCaptured addon-purchase branch) directly on the in-memory
// subscription, bypassing Razorpay/CommercialTransaction/plan-sync
// side-effects not relevant to identity/period-anchor correctness.
function commitPendingAddon(subscription) {
  const pending = subscription.pendingAddonAddition;
  const activeAddons = (subscription.activeAddons || []).map((a) => ({
    addonKey: a.addonKey,
    quantity: a.quantity,
    pricePerUnit: a.pricePerUnit,
    addedAt: a.addedAt,
    billingCycle: a.billingCycle,
    periodEnd: a.periodEnd,
  }));
  const { addonIdentityKey } = require('../utils/addonManagement');
  const pendingCycle = pending.billingCycle || subscription.billingCycle;
  const existingIdx = activeAddons.findIndex(
    (a) => addonIdentityKey(a, subscription.billingCycle) === addonIdentityKey({ addonKey: pending.addonKey, billingCycle: pendingCycle }, subscription.billingCycle)
  );
  if (existingIdx >= 0) {
    activeAddons[existingIdx] = { ...activeAddons[existingIdx], quantity: activeAddons[existingIdx].quantity + pending.quantity };
  } else {
    const addedAt = new Date();
    const periodEnd = pendingCycle === 'yearly'
      ? new Date(addedAt.getFullYear() + 1, addedAt.getMonth(), addedAt.getDate())
      : null;
    activeAddons.push({ addonKey: pending.addonKey, quantity: pending.quantity, pricePerUnit: pending.pricePerUnit, addedAt, billingCycle: pendingCycle, periodEnd });
  }
  subscription.activeAddons = activeAddons;
  subscription.pendingAddonAddition = undefined;
}

async function purchase(subscription, plan, catalogEntry, billingCycle, quantity = 1) {
  const result = await startAddonPurchase({
    user: { _id: new mongoose.Types.ObjectId(), name: 'Test', email: 't@test.com' },
    organizationId: subscription.organization,
    subscription,
    plan,
    catalogEntry,
    addonKey: 'seat',
    quantity,
    billingCycle,
    ...noopInvoiceHooks,
  });
  commitPendingAddon(result.subscription);
  await result.subscription.save();
  return result.subscription;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running Phase 2c dual-cycle addon fixtures...\n');

  const plan = await PlanConfig.findOne({ planId: 'growth', isActive: true }) || { planId: 'growth', monthlyPrice: 500, yearlyPrice: 5000 };
  const seatAddon = await findOrMakeSeatAddon();

  await test('monthly base + monthly addon: purchase succeeds, identity is (seat, monthly)', async () => {
    const sub = await makeSubscription('monthly');
    const result = await purchase(sub, plan, seatAddon, 'monthly');
    assert.equal(result.activeAddons.length, 1);
    assert.equal(result.activeAddons[0].billingCycle, 'monthly');
    assert.equal(result.activeAddons[0].periodEnd, null);
    await cleanup();
  });

  await test('monthly base plan rejects annual addon purchase', async () => {
    const sub = await makeSubscription('monthly');
    await assert.rejects(
      () => startAddonPurchase({
        user: { _id: new mongoose.Types.ObjectId(), name: 'Test', email: 't@test.com' },
        organizationId: sub.organization,
        subscription: sub,
        plan,
        catalogEntry: seatAddon,
        addonKey: 'seat',
        quantity: 1,
        billingCycle: 'yearly',
        ...noopInvoiceHooks,
      }),
      /annual add-on can only be purchased on an annual base plan/
    );
    await cleanup();
  });

  await test('annual base + monthly addon: allowed', async () => {
    const sub = await makeSubscription('yearly');
    const result = await purchase(sub, plan, seatAddon, 'monthly');
    assert.equal(result.activeAddons.length, 1);
    assert.equal(result.activeAddons[0].billingCycle, 'monthly');
    await cleanup();
  });

  await test('annual base + annual addon: allowed, gets its own periodEnd (~1 year from purchase)', async () => {
    const sub = await makeSubscription('yearly');
    const before = new Date();
    const result = await purchase(sub, plan, seatAddon, 'yearly');
    assert.equal(result.activeAddons.length, 1);
    assert.equal(result.activeAddons[0].billingCycle, 'yearly');
    assert.ok(result.activeAddons[0].periodEnd instanceof Date);
    const daysUntilPeriodEnd = (result.activeAddons[0].periodEnd - before) / (1000 * 60 * 60 * 24);
    assert.ok(daysUntilPeriodEnd > 360 && daysUntilPeriodEnd < 370, `expected ~365 days, got ${daysUntilPeriodEnd}`);
    await cleanup();
  });

  await test('annual base + both monthly and annual seat: coexist as two independent entries', async () => {
    const sub = await makeSubscription('yearly');
    let subAfterMonthly = await purchase(sub, plan, seatAddon, 'monthly');
    let subAfterBoth = await purchase(subAfterMonthly, plan, seatAddon, 'yearly');
    assert.equal(subAfterBoth.activeAddons.length, 2);
    const monthlyEntry = subAfterBoth.activeAddons.find((a) => a.billingCycle === 'monthly');
    const yearlyEntry = subAfterBoth.activeAddons.find((a) => a.billingCycle === 'yearly');
    assert.ok(monthlyEntry && yearlyEntry, 'both cycle-variants should exist as separate entries');
    assert.equal(monthlyEntry.quantity, 1);
    assert.equal(yearlyEntry.quantity, 1);
    await cleanup();
  });

  await test('buying more of an existing annual instance increments quantity, does not reset periodEnd', async () => {
    const sub = await makeSubscription('yearly');
    const subAfterFirst = await purchase(sub, plan, seatAddon, 'yearly');
    const originalPeriodEnd = subAfterFirst.activeAddons[0].periodEnd.getTime();
    await new Promise((r) => setTimeout(r, 10));
    const subAfterSecond = await purchase(subAfterFirst, plan, seatAddon, 'yearly');
    assert.equal(subAfterSecond.activeAddons.length, 1);
    assert.equal(subAfterSecond.activeAddons[0].quantity, 2);
    assert.equal(subAfterSecond.activeAddons[0].periodEnd.getTime(), originalPeriodEnd, 'periodEnd must not reset on additional purchase');
    await cleanup();
  });

  await test('removing monthly seat while annual seat remains: only monthly entry is scheduled for removal', async () => {
    const sub = await makeSubscription('yearly');
    let subBoth = await purchase(sub, plan, seatAddon, 'monthly');
    subBoth = await purchase(subBoth, plan, seatAddon, 'yearly');
    const result = await scheduleAddonRemoval(subBoth.organization, 'seat', 1, 'monthly');
    assert.equal(result.subscription.pendingAddonRemovals.length, 1);
    assert.equal(result.subscription.pendingAddonRemovals[0].billingCycle, 'monthly');
    // activeAddons themselves are untouched until execution (no refund, no immediate removal).
    assert.equal(result.subscription.activeAddons.length, 2);
    assert.equal(result.subscription.activeAddons.find((a) => a.billingCycle === 'yearly').quantity, 1);
    await cleanup();
  });

  await test('removing annual seat while monthly seat remains: only annual entry is scheduled for removal', async () => {
    const sub = await makeSubscription('yearly');
    let subBoth = await purchase(sub, plan, seatAddon, 'monthly');
    subBoth = await purchase(subBoth, plan, seatAddon, 'yearly');
    const result = await scheduleAddonRemoval(subBoth.organization, 'seat', 1, 'yearly');
    assert.equal(result.subscription.pendingAddonRemovals.length, 1);
    assert.equal(result.subscription.pendingAddonRemovals[0].billingCycle, 'yearly');
    assert.equal(result.subscription.activeAddons.length, 2, 'no immediate removal — both entries still present');
    assert.equal(result.subscription.activeAddons.find((a) => a.billingCycle === 'monthly').quantity, 1);
    await cleanup();
  });

  await test('scheduled removal before execution leaves activeAddons completely unchanged', async () => {
    const sub = await makeSubscription('yearly');
    let subBoth = await purchase(sub, plan, seatAddon, 'monthly');
    subBoth = await purchase(subBoth, plan, seatAddon, 'yearly');
    const before = JSON.stringify(subBoth.activeAddons.map((a) => ({ k: a.addonKey, c: a.billingCycle, q: a.quantity })));
    await scheduleAddonRemoval(subBoth.organization, 'seat', 1, 'annual' === 'annual' ? 'yearly' : 'monthly');
    const reloaded = await Subscription.findById(subBoth._id);
    const after = JSON.stringify(reloaded.activeAddons.map((a) => ({ k: a.addonKey, c: a.billingCycle, q: a.quantity })));
    assert.equal(before, after, 'activeAddons must not change merely from scheduling a removal');
    await cleanup();
  });

  await test('renewal only applies a due removal, not a future-dated one — annual removal untouched by monthly rollover', async () => {
    // Annual base, monthly seat scheduled for removal at (near) monthly
    // period end, annual seat scheduled for removal at its own (future)
    // periodEnd. A renewal due "today" for the monthly component must only
    // execute the monthly removal.
    const sub = await makeSubscription('yearly', {
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(Date.now() - 1000), // already due, so renewSubscription proceeds
    });
    let subBoth = await purchase(sub, plan, seatAddon, 'monthly');
    subBoth = await purchase(subBoth, plan, seatAddon, 'yearly');
    // Force the annual entry's periodEnd far in the future regardless of
    // real elapsed time, so this fixture doesn't depend on wall-clock timing.
    const yearlyEntry = subBoth.activeAddons.find((a) => a.billingCycle === 'yearly');
    yearlyEntry.periodEnd = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000);
    await subBoth.save();

    await scheduleAddonRemoval(subBoth.organization, 'seat', 1, 'monthly');
    // Directly force the annual removal's effectiveAt far in the future too
    // (scheduleAddonRemoval derives it from the entry's own periodEnd, so
    // this should already be true — asserted, not just assumed).
    const withAnnualRemoval = await Subscription.findOne({ organization: subBoth.organization });
    await scheduleAddonRemoval(subBoth.organization, 'seat', 1, 'yearly');
    const reloaded = await Subscription.findOne({ organization: subBoth.organization });
    const monthlyRemoval = reloaded.pendingAddonRemovals.find((r) => r.billingCycle === 'monthly');
    const annualRemoval = reloaded.pendingAddonRemovals.find((r) => r.billingCycle === 'yearly');
    assert.ok(annualRemoval.effectiveAt > monthlyRemoval.effectiveAt, 'annual removal effectiveAt should be far later than monthly');

    const result = await applyScheduledAddonRemovals(reloaded);
    assert.equal(result, true, 'should have applied the due (monthly) removal');
    const afterRollover = await Subscription.findOne({ organization: subBoth.organization });
    const remainingMonthly = afterRollover.activeAddons.find((a) => a.billingCycle === 'monthly');
    const remainingYearly = afterRollover.activeAddons.find((a) => a.billingCycle === 'yearly');
    assert.equal(remainingMonthly, undefined, 'monthly seat (qty 1, removal qty 1) should be fully removed');
    assert.ok(remainingYearly, 'annual seat must NOT be removed by a monthly-cycle rollover');
    assert.equal(remainingYearly.quantity, 1);
    assert.equal(afterRollover.pendingAddonRemovals.length, 1, 'the not-yet-due annual removal must remain pending');
    assert.equal(afterRollover.pendingAddonRemovals[0].billingCycle, 'yearly');
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
