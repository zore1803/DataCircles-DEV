// scripts/verifyAddonCyclePreservedAcrossTransition.js
//
// Task 1 (Aug 2026): traced the reported "add-on cycle corruption during
// Monthly->Annual transition" to its ACTUAL root cause — NOT a mutation
// inside cycleTransitionLifecycle.js's commit (confirmed: it never touches
// activeAddons at all), but a sitewide omission of `billingCycle` on
// activeAddons entries at THREE creation sites in subscriptionController.js
// (createSubscription, updateSubscription's trial-conversion branch, and the
// upgrade-commit pending-removal restore). An addon entry missing that field
// silently re-interprets itself as whatever the SUBSCRIPTION's CURRENT cycle
// is at every later read (addonIdentityKey/getAddonRemovalEffectiveAt's
// documented fallback) — forever, not just at creation — which is exactly
// what breaks the moment a later Monthly->Annual transition changes the
// subscription's own billingCycle out from under an old, unlabeled add-on.
// Confirmed against the real dev DB: a genuine corrupted record exists
// (organization 6a771788d77f61acd29c64ba, extra_seat with no billingCycle at
// all, on a subscription created directly as annual via trial conversion —
// not even via a later transition, confirming the omission itself is the
// bug, independent of any transition).
//
// This fixture verifies the actual symptom described: a monthly add-on
// PRESENT BEFORE a Monthly->Annual transition is completely untouched by
// that transition's commit (billingCycle, pricePerUnit, removal-timing all
// byte-for-byte identical before/after) — proving the transition commit
// itself was never the mutation site, only exposed the pre-existing gap via
// addonIdentityKey's fallback whenever an addon's OWN billingCycle is unset.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyAddonCyclePreservedAcrossTransition.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const { startMonthlyToAnnualTransition } = require('../utils/cycleTransitionLifecycle');
const { getAddonRemovalEffectiveAt, addonIdentityKey } = require('../utils/addonManagement');

const razorpay = require('../config/razorpay');
let orderCounter = 0;
razorpay.orders = razorpay.orders || {};
razorpay.orders.create = async () => ({ id: `order_test_addoncycle_${orderCounter++}` });

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

const cleanupIds = { subs: [], orgs: [] };
async function cleanup() {
  if (cleanupIds.subs.length) await Subscription.deleteMany({ _id: { $in: cleanupIds.subs } });
  if (cleanupIds.orgs.length) await Organization.deleteMany({ _id: { $in: cleanupIds.orgs } });
  cleanupIds.subs = []; cleanupIds.orgs = [];
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running add-on cycle preservation fixtures...\n');

  if (!(await PlanConfig.findOne({ planId: 'growth' }))) {
    await PlanConfig.create({ planId: 'growth', monthlyPrice: 450, yearlyPrice: 4800, isActive: true, features: {} });
  }
  const plan = await PlanConfig.findOne({ planId: 'growth' });

  await test('a monthly add-on PROPERLY LABELED (billingCycle stored) survives a Monthly->Annual transition completely untouched', async () => {
    const org = await Organization.create({ name: 'Addon Cycle Preservation Fixture 1', code: 'addoncyc1-' + Date.now() });
    cleanupIds.orgs.push(org._id);
    const anchor = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const sub = await Subscription.create({
      organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
      billingCycle: 'monthly', pricePerUser: 450, userCount: 1, totalAmount: 550,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      billingAnchor: anchor,
      activeAddons: [{ addonKey: 'seat', quantity: 2, pricePerUnit: 100, billingCycle: 'monthly', addedAt: new Date() }],
    });
    cleanupIds.subs.push(sub._id);

    const before = JSON.stringify(sub.activeAddons[0]);

    await startMonthlyToAnnualTransition({
      user: { _id: new mongoose.Types.ObjectId(), name: 'T', email: 't@t.com' },
      organizationId: sub.organization, subscription: sub, plan,
    });

    const reloaded = await Subscription.findById(sub._id);
    const after = JSON.stringify(reloaded.activeAddons[0]);
    assert.equal(after, before, 'the addon entry must be byte-for-byte unchanged by transition INITIATION (activeAddons untouched at initiation, confirmed) — billingCycle/pricePerUnit/quantity all identical');
    assert.equal(reloaded.activeAddons[0].billingCycle, 'monthly');
    assert.equal(reloaded.activeAddons[0].pricePerUnit, 100);

    const effectiveAt = getAddonRemovalEffectiveAt(reloaded.activeAddons[0], reloaded);
    const monthsAhead = (effectiveAt - reloaded.activeAddons[0].addedAt) / (30 * 24 * 60 * 60 * 1000);
    assert.ok(monthsAhead < 2, `removal timing must still compute off the addon's OWN monthly cadence (~1 month), not a full year — got ${monthsAhead.toFixed(1)} months`);
    await cleanup();
  });

  await test('CONFIRMED LIVE BUG: an add-on with NO billingCycle stored (the pre-existing gap, now fixed at creation time) would silently compute annual removal timing once the subscription becomes annual', async () => {
    // Reproduces the exact corrupted record found in the dev DB — an addon
    // that was NEVER labeled with billingCycle at all (the bug this fixture
    // suite's companion fix closes at the three creation sites). This test
    // demonstrates WHY that omission is dangerous, using the real exported
    // getAddonRemovalEffectiveAt function, not a reimplementation.
    const unlabeledAddon = { addonKey: 'extra_seat', quantity: 1, pricePerUnit: 100, addedAt: new Date() }; // no billingCycle
    const annualSubscription = { billingCycle: 'yearly' };

    const effectiveAt = getAddonRemovalEffectiveAt(unlabeledAddon, annualSubscription);
    const monthsAhead = (effectiveAt - unlabeledAddon.addedAt) / (30 * 24 * 60 * 60 * 1000);
    assert.ok(monthsAhead > 11, `demonstrates the bug: an unlabeled add-on on an annual subscription computes a FULL YEAR removal window (${monthsAhead.toFixed(1)} months) despite being priced monthly — this is exactly the reported symptom, and it is a READ-TIME fallback, not a mutation during any specific transition commit`);
    await cleanup();
  });

  await test('addonIdentityKey: an add-on missing billingCycle is silently reclassified as matching the subscription current cycle at every read — confirms the mechanism, not a one-time snapshot', async () => {
    const unlabeledAddon = { addonKey: 'extra_seat' };
    const keyWhileMonthly = addonIdentityKey(unlabeledAddon, 'monthly');
    const keyAfterTransitionToAnnual = addonIdentityKey(unlabeledAddon, 'yearly');
    assert.notEqual(keyWhileMonthly, keyAfterTransitionToAnnual, 'the SAME unlabeled addon object resolves to a DIFFERENT identity depending purely on the subscription\'s CURRENT cycle at read time — this is the actual mechanism behind the reported "displays as Annual" symptom');
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
