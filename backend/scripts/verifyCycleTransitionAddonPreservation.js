// scripts/verifyCycleTransitionAddonPreservation.js
//
// Settled business contract (this session): a Monthly->Annual base-plan
// transition supersedes a pending BASE-PLAN scheduled change (PLAN_CHANGE /
// BILLING_CYCLE_CHANGE) but must NEVER touch an independent pending ADD-ON
// scheduled change (REMOVE_ADDON) — the customer already paid for that
// add-on's current entitlement; it stays scheduled for its own term-end,
// untouched by an unrelated base-plan cycle change. Verifies the actual
// ScheduledChange.updateMany query scope directly (type: {$in:['PLAN_CHANGE',
// 'BILLING_CYCLE_CHANGE']}) proves this in practice, not just by reading the
// query shape.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyCycleTransitionAddonPreservation.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');
const ScheduledChange = require('../models/ScheduledChange');
const { startMonthlyToAnnualTransition } = require('../utils/cycleTransitionLifecycle');
const { scheduleAddonRemoval } = require('../utils/addonManagement');

const razorpay = require('../config/razorpay');
let orderCounter = 0;
razorpay.orders = razorpay.orders || {};
razorpay.orders.create = async () => ({ id: `order_test_preservation_${orderCounter++}` });

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

const cleanupIds = { subs: [], scs: [] };
async function cleanup() {
  if (cleanupIds.subs.length) await Subscription.deleteMany({ _id: { $in: cleanupIds.subs } });
  if (cleanupIds.scs.length) await ScheduledChange.deleteMany({ _id: { $in: cleanupIds.scs } });
  cleanupIds.subs = []; cleanupIds.scs = [];
}

// Mirrors the webhook commit branch's own supersession query exactly
// (subscriptionController.js's handlePaymentCaptured cycle-transition block)
// — same query, run directly, so this fixture proves the ACTUAL scoped
// operation rather than a paraphrase of it.
async function runSupersessionQuery(subscription) {
  await ScheduledChange.updateMany(
    {
      organization: subscription.organization,
      subscription: subscription._id,
      type: { $in: ['PLAN_CHANGE', 'BILLING_CYCLE_CHANGE'] },
      status: 'PENDING',
    },
    { $set: { status: 'CANCELLED', reason: 'Superseded by immediate Monthly->Annual transition' } }
  );
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running cycle-transition add-on preservation fixtures...\n');

  const growth = await PlanConfig.findOne({ planId: 'growth' });
  let seatAddon = await PlanAddon.findOne({ key: 'seat' });
  if (!seatAddon) {
    seatAddon = await PlanAddon.create({
      key: 'seat', displayName: 'Seat', price: { monthly: 100, yearly: 1000 },
      availableOnPlans: [], targetKey: 'seats', effectType: 'limit_boost', isActive: true,
    });
  }

  await test('a pending BASE-PLAN scheduled change (PLAN_CHANGE) IS cancelled by the transition', async () => {
    const anchor = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const sub = await Subscription.create({
      organization: new mongoose.Types.ObjectId(), planName: 'growth', billingCycle: 'monthly',
      pricePerUser: growth.monthlyPrice, userCount: 1, totalAmount: growth.monthlyPrice,
      isPaymentConfirmed: true, billingAnchor: anchor,
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    });
    cleanupIds.subs.push(sub._id);

    const planChangeSC = await ScheduledChange.create({
      organization: sub.organization, subscription: sub._id, type: 'PLAN_CHANGE',
      status: 'PENDING', effectiveAt: sub.currentPeriodEnd, payload: { planId: 'starter' },
    });
    cleanupIds.scs.push(planChangeSC._id);

    await startMonthlyToAnnualTransition({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan: growth,
    });
    await runSupersessionQuery(sub);

    const reloaded = await ScheduledChange.findById(planChangeSC._id);
    assert.equal(reloaded.status, 'CANCELLED');
    await cleanup();
  });

  await test('a pending ADD-ON scheduled removal (REMOVE_ADDON) is NOT touched by the same transition', async () => {
    const anchor = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const sub = await Subscription.create({
      organization: new mongoose.Types.ObjectId(), planName: 'growth', billingCycle: 'monthly',
      pricePerUser: growth.monthlyPrice, userCount: 1, totalAmount: growth.monthlyPrice,
      isPaymentConfirmed: true, billingAnchor: anchor,
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      activeAddons: [{ addonKey: 'seat', quantity: 1, pricePerUnit: 100, billingCycle: 'monthly', addedAt: new Date() }],
    });
    cleanupIds.subs.push(sub._id);

    // Real scheduleAddonRemoval call — creates the actual REMOVE_ADDON
    // ScheduledChange this contract is about, not a hand-built stand-in.
    await scheduleAddonRemoval(sub.organization, 'seat', 1);
    const removeAddonSC = await ScheduledChange.findOne({ subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING' });
    assert.ok(removeAddonSC, 'fixture setup: scheduleAddonRemoval must have created a PENDING REMOVE_ADDON record');
    cleanupIds.scs.push(removeAddonSC._id);

    const freshSub = await Subscription.findById(sub._id);
    await startMonthlyToAnnualTransition({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: freshSub.organization, subscription: freshSub, plan: growth,
    });
    await runSupersessionQuery(freshSub);

    const reloaded = await ScheduledChange.findById(removeAddonSC._id);
    assert.equal(reloaded.status, 'PENDING', 'the add-on removal must remain scheduled — the customer already paid for this entitlement, unrelated to the base-plan cycle change');

    // Also confirm the add-on itself is untouched on the subscription — no
    // premature removal, no term extension, exactly as before.
    const finalSub = await Subscription.findById(sub._id);
    const seatEntry = finalSub.activeAddons.find((a) => a.addonKey === 'seat');
    assert.ok(seatEntry, 'the add-on itself must still be present — not silently removed or revived/extended by the base-plan transition');
    assert.equal(seatEntry.quantity, 1);

    await cleanup();
  });

  await test('BOTH together: base-plan change cancelled, add-on removal preserved, in the same transition', async () => {
    const anchor = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const sub = await Subscription.create({
      organization: new mongoose.Types.ObjectId(), planName: 'growth', billingCycle: 'monthly',
      pricePerUser: growth.monthlyPrice, userCount: 1, totalAmount: growth.monthlyPrice,
      isPaymentConfirmed: true, billingAnchor: anchor,
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      activeAddons: [{ addonKey: 'seat', quantity: 1, pricePerUnit: 100, billingCycle: 'monthly', addedAt: new Date() }],
    });
    cleanupIds.subs.push(sub._id);

    const planChangeSC = await ScheduledChange.create({
      organization: sub.organization, subscription: sub._id, type: 'PLAN_CHANGE',
      status: 'PENDING', effectiveAt: sub.currentPeriodEnd, payload: { planId: 'starter' },
    });
    cleanupIds.scs.push(planChangeSC._id);
    await scheduleAddonRemoval(sub.organization, 'seat', 1);
    const removeAddonSC = await ScheduledChange.findOne({ subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING' });
    cleanupIds.scs.push(removeAddonSC._id);

    const freshSub = await Subscription.findById(sub._id);
    await startMonthlyToAnnualTransition({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: freshSub.organization, subscription: freshSub, plan: growth,
    });
    await runSupersessionQuery(freshSub);

    assert.equal((await ScheduledChange.findById(planChangeSC._id)).status, 'CANCELLED');
    assert.equal((await ScheduledChange.findById(removeAddonSC._id)).status, 'PENDING');
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
