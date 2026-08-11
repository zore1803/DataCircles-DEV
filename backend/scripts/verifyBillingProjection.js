// scripts/verifyBillingProjection.js
//
// Phase 1A hard gate for the Billing Calendar (see
// C:\Users\cdosh\.claude\plans\eventual-questing-toucan.md) — buildBillingProjection()
// must pass every scenario below BEFORE any frontend Calendar code is
// written. WRITES disposable documents and deletes them after — do NOT
// point this at a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyBillingProjection.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const ScheduledChange = require('../models/ScheduledChange');
const { buildBillingProjection } = require('../utils/billingProjection');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], Subscription: [], ScheduledChange: [] };
  try {
    await fn(registry);
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  } finally {
    await ScheduledChange.deleteMany({ _id: { $in: registry.ScheduledChange } });
    await Subscription.deleteMany({ _id: { $in: registry.Subscription } });
    await Organization.deleteMany({ _id: { $in: registry.Organization } });
  }
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running buildBillingProjection() regression fixtures (Tests A-D)...\n');

  await test('Test A: monthly addon current(2) + scheduled(1) never collapse, annual lane stays empty', async (registry) => {
    const org = await Organization.create({ name: 'BP Fixture A', code: 'bp-a-' + Date.now() });
    registry.Organization.push(org._id);
    const sub = await Subscription.create({
      organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
      billingCycle: 'monthly', pricePerUser: 450, userCount: 1, totalAmount: 650,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      activeAddons: [{ addonKey: 'seat', billingCycle: 'monthly', quantity: 2, pricePerUnit: 100, addedAt: new Date() }],
    });
    registry.Subscription.push(sub._id);
    const effectiveAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const sc = await ScheduledChange.create({
      organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING', effectiveAt,
      payload: { addonKey: 'seat', billingCycle: 'monthly', quantity: 1 },
    });
    registry.ScheduledChange.push(sc._id);

    const p = await buildBillingProjection(sub);

    assert.equal(p.addons.monthly.length, 1);
    assert.equal(p.addons.monthly[0].current.quantity, 2, 'current quantity must stay 2 — never overwritten by the scheduled value');
    assert.ok(p.addons.monthly[0].scheduled, 'a scheduled block must be present');
    assert.equal(p.addons.monthly[0].scheduled.quantity, 1, 'scheduled.quantity must be the RESIDUAL (2-1=1), not the removal amount itself');
    assert.equal(p.addons.annual.length, 0, 'no annual seat exists — must not appear just because the base plan could change cadence');
  });

  await test('Test B: annual addon independence — lives only in the annual lane', async (registry) => {
    const org = await Organization.create({ name: 'BP Fixture B', code: 'bp-b-' + Date.now() });
    registry.Organization.push(org._id);
    const periodEnd = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000);
    const sub = await Subscription.create({
      organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
      billingCycle: 'yearly', pricePerUser: 4800, userCount: 1, totalAmount: 5800,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      billingAnchor: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
      activeAddons: [{ addonKey: 'seat', billingCycle: 'yearly', quantity: 1, pricePerUnit: 1000, periodEnd, addedAt: new Date() }],
    });
    registry.Subscription.push(sub._id);

    const p = await buildBillingProjection(sub);

    assert.equal(p.addons.annual.length, 1);
    assert.equal(p.addons.annual[0].addonKey, 'seat');
    assert.equal(p.addons.monthly.length, 0, 'monthly lane must be empty — the seat is an annual instance only');
    assert.ok(p.basePlan.entitlementWindow, 'yearly base with a billingAnchor must produce an entitlementWindow');
    assert.ok(p.basePlan.entitlementWindow.consumedFraction >= 0 && p.basePlan.entitlementWindow.consumedFraction <= 1);
  });

  await test('Test C: cancellation is scheduled, not already applied', async (registry) => {
    const org = await Organization.create({ name: 'BP Fixture C', code: 'bp-c-' + Date.now() });
    registry.Organization.push(org._id);
    const periodEnd = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);
    const sub = await Subscription.create({
      organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
      billingCycle: 'yearly', pricePerUser: 4800, userCount: 1, totalAmount: 4800,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed', cancelAtPeriodEnd: true,
      currentPeriodStart: new Date(), currentPeriodEnd: periodEnd,
      activeAddons: [],
    });
    registry.Subscription.push(sub._id);
    const sc = await ScheduledChange.create({
      organization: org._id, subscription: sub._id, type: 'CANCELLATION', status: 'PENDING',
      effectiveAt: periodEnd, payload: { cancelAtPeriodEnd: true },
    });
    registry.ScheduledChange.push(sc._id);

    const p = await buildBillingProjection(sub);

    assert.equal(p.cancellation.scheduled, true);
    assert.equal(new Date(p.cancellation.effectiveAt).getTime(), periodEnd.getTime());
    assert.equal(p.basePlan.current.planName, 'growth', 'current plan must still read as active/growth — never shown as already ended');
  });

  await test('Test D: scheduled removal never overwrites current.quantity (isolated BUG-024/BUG-041 regression check)', async (registry) => {
    const org = await Organization.create({ name: 'BP Fixture D', code: 'bp-d-' + Date.now() });
    registry.Organization.push(org._id);
    const sub = await Subscription.create({
      organization: org._id, planName: 'business', appStatus: 'active', status: 'active',
      billingCycle: 'monthly', pricePerUser: 650, userCount: 1, totalAmount: 900,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      activeAddons: [{ addonKey: 'extra_seat', billingCycle: 'monthly', quantity: 3, pricePerUnit: 50, addedAt: new Date() }],
    });
    registry.Subscription.push(sub._id);
    const sc = await ScheduledChange.create({
      organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING',
      effectiveAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      payload: { addonKey: 'extra_seat', billingCycle: 'monthly', quantity: 2 },
    });
    registry.ScheduledChange.push(sc._id);

    const p = await buildBillingProjection(sub);
    const entry = p.addons.monthly.find((a) => a.addonKey === 'extra_seat');

    assert.equal(entry.current.quantity, 3, 'BUG-024/041 regression: current must remain 3, the scheduled removal must never overwrite it');
    assert.equal(entry.scheduled.quantity, 1, 'residual after removal (3-2=1)');
  });

  await test('Test E: trialing org gets a critical trial_end event carrying the real conversion amount, not null', async (registry) => {
    const org = await Organization.create({ name: 'BP Fixture E', code: 'bp-e-' + Date.now() });
    registry.Organization.push(org._id);
    const trialEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const sub = await Subscription.create({
      organization: org._id, planName: 'starter', appStatus: 'trial', status: 'created',
      billingCycle: 'monthly', pricePerUser: 250, userCount: 1, totalAmount: 250,
      isPaymentConfirmed: false, isTrialActive: true,
      trialStart: new Date(), trialEnd,
      activeAddons: [],
    });
    registry.Subscription.push(sub._id);

    const p = await buildBillingProjection(sub);

    assert.equal(p.trial.active, true);
    assert.ok(p.trial.conversionAmount > 0, 'conversionAmount must be a real computed price, not null/0, while trialing');
    const trialEvent = p.upcomingEvents.find((e) => e.type === 'trial_end');
    assert.ok(trialEvent, 'trial_end must appear in upcomingEvents — this was previously missing entirely');
    assert.equal(trialEvent.priority, 'critical');
    assert.equal(trialEvent.amount, p.trial.conversionAmount, 'the event amount must be the SAME number as trial.conversionAmount, never a second independent estimate');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
})().catch(async (e) => {
  console.error('FAIL', e);
  await mongoose.disconnect();
  process.exit(1);
});
