// scripts/verifyRenewalReferralModifier.js
//
// Fixture-based verification for R8 (§3.6b, RF1/RF3/RF6) — referral reward
// wired into renewSubscription() as a renewal-time modifier. WRITES
// disposable Organization/Subscription/Reward/RewardUsage/CommercialTransaction/
// BillingInvoice/BillingCycle documents and deletes them after each fixture —
// do NOT point this at a production database. Same driving pattern as
// verifyScheduledChangeRenewal.js: calls the real renewSubscription() export,
// not a copy of its logic.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyRenewalReferralModifier.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const Reward = require('../models/Reward');
const RewardUsage = require('../models/RewardUsage');
const CommercialTransaction = require('../models/CommercialTransaction');
const BillingInvoice = require('../models/BillingInvoice');
const BillingCycle = require('../models/BillingCycle');
const { renewSubscription } = require('../utils/renewalEngine');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], Subscription: [], Reward: [], RewardUsage: [], CommercialTransaction: [], BillingInvoice: [], BillingCycle: [] };
  try {
    await fn(registry);
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  } finally {
    await cleanup(registry);
  }
}

async function cleanup(registry) {
  await BillingCycle.deleteMany({ _id: { $in: registry.BillingCycle } });
  await BillingInvoice.deleteMany({ _id: { $in: registry.BillingInvoice } });
  await CommercialTransaction.deleteMany({ _id: { $in: registry.CommercialTransaction } });
  await RewardUsage.deleteMany({ _id: { $in: registry.RewardUsage } });
  await Reward.deleteMany({ _id: { $in: registry.Reward } });
  await Subscription.deleteMany({ _id: { $in: registry.Subscription } });
  await Organization.deleteMany({ _id: { $in: registry.Organization } });
}

async function trackedCreate(Model, key, registry, doc) {
  const created = await Model.create(doc);
  registry[key].push(created._id);
  return created;
}

function baseSubscriptionFields(organization, plan, overrides = {}) {
  const now = new Date();
  const periodEnd = new Date(now); // due for renewal now
  return {
    organization,
    planName: 'growth',
    appStatus: 'active',
    billingCycle: 'monthly',
    pricePerUser: plan.monthlyPrice,
    userCount: 1,
    totalAmount: plan.monthlyPrice,
    mandateTokenId: 'token_test_r8_fixture',
    currentPeriodStart: new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: periodEnd,
    nextBillingDate: periodEnd,
    activeAddons: [],
    ...overrides,
  };
}

const okCharge = async () => ({ success: true, paymentId: 'pay_test_r8', orderId: 'order_test_r8' });
const failCharge = async () => ({ success: false });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('R8 — referral reward as a renewal-time modifier\n');

  await test('Fixture 1: an available reward is reserved, applied to the invoice, and consumed only after charge success', async (registry) => {
    const plan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
    assert.ok(plan, 'Expected an active "growth" PlanConfig to already exist in this DB');

    const org = await trackedCreate(Organization, 'Organization', registry, {
      name: 'R8 Renewal Fixture Org', code: `r8-renewal-${Date.now()}`,
    });

    const reward = await trackedCreate(Reward, 'Reward', registry, {
      organization: org._id, source: 'MANUAL', rewardType: 'fixed', rewardValue: 50,
    });

    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(org._id, plan));

    // Baseline — reward must start genuinely available (no RewardUsage row at all).
    const baselineUsageCount = await RewardUsage.countDocuments({ reward: reward._id });
    assert.equal(baselineUsageCount, 0, 'Baseline: reward must have no usage row yet');

    const result = await renewSubscription(subscription, { chargeMandateFn: okCharge });
    assert.equal(result.outcome, 'RENEWED', `Expected RENEWED, got ${JSON.stringify(result)}`);

    const usage = await RewardUsage.findOne({ reward: reward._id });
    assert.ok(usage, 'Expected a RewardUsage row to have been created for this renewal');
    registry.RewardUsage.push(usage._id);
    assert.equal(usage.status, 'consumed', 'Reward must be consumed after a successful renewal charge');
    assert.ok(usage.consumedAt, 'consumedAt must be set');
    assert.equal(String(usage.subscription), String(subscription._id), 'Usage must be tied to this subscription');

    const invoice = await BillingInvoice.findById(result.invoice);
    registry.BillingInvoice.push(invoice._id);
    assert.equal(invoice.discount, 50, 'Invoice discount must reflect the referral reward value');
    assert.equal(
      invoice.taxable,
      plan.monthlyPrice - 50,
      'Taxable amount must be base price minus the reward discount, same arithmetic calculateInvoice() already uses elsewhere'
    );

    const commercialTransaction = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'RENEWAL' });
    registry.CommercialTransaction.push(commercialTransaction._id);
    assert.equal(String(commercialTransaction.target.rewardUsageId), String(usage._id), 'CommercialTransaction.target must record the reserved RewardUsage id');

    const billingCycle = await BillingCycle.findOne({ subscription: subscription._id });
    if (billingCycle) registry.BillingCycle.push(billingCycle._id);
  });

  await test('Fixture 2: a failed charge attempt leaves the reservation reserved; a resumed retry reuses it (no double reservation) and then consumes it exactly once', async (registry) => {
    const plan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
    const org = await trackedCreate(Organization, 'Organization', registry, {
      name: 'R8 Renewal Retry Fixture Org', code: `r8-renewal-retry-${Date.now()}`,
    });
    const reward = await trackedCreate(Reward, 'Reward', registry, {
      organization: org._id, source: 'MANUAL', rewardType: 'fixed', rewardValue: 75,
    });
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(org._id, plan));

    // First attempt — charge fails cleanly. Per R8's PAST_DUE handling, the
    // reservation must be left 'reserved', not released.
    const firstResult = await renewSubscription(subscription, { chargeMandateFn: failCharge });
    assert.equal(firstResult.outcome, 'PAST_DUE', `Expected PAST_DUE, got ${JSON.stringify(firstResult)}`);

    const usageAfterFailure = await RewardUsage.findOne({ reward: reward._id });
    assert.ok(usageAfterFailure, 'A reservation must have been made on the first (failed) attempt');
    registry.RewardUsage.push(usageAfterFailure._id);
    assert.equal(usageAfterFailure.status, 'reserved', 'Reservation must remain reserved after a clean charge failure, not released');

    const usageCountAfterFailure = await RewardUsage.countDocuments({ reward: reward._id });
    assert.equal(usageCountAfterFailure, 1, 'Exactly one RewardUsage row must exist after the first failed attempt');

    // Reload subscription (appStatus flipped to past_due by the first call) and resume.
    const reloadedSubscription = await Subscription.findById(subscription._id);
    const secondResult = await renewSubscription(reloadedSubscription, { chargeMandateFn: okCharge });
    assert.equal(secondResult.outcome, 'RENEWED', `Expected RENEWED on resume, got ${JSON.stringify(secondResult)}`);

    // Still exactly one RewardUsage row — the resumed attempt must reuse the
    // existing reservation via CommercialTransaction.target.rewardUsageId,
    // never reserve a second one.
    const usageCountAfterResume = await RewardUsage.countDocuments({ reward: reward._id });
    assert.equal(usageCountAfterResume, 1, 'Resuming a failed renewal must not create a second reservation for the same reward');

    const finalUsage = await RewardUsage.findById(usageAfterFailure._id);
    assert.equal(finalUsage.status, 'consumed', 'The SAME reservation from the first attempt must now be consumed');
    assert.ok(finalUsage.consumedAt);

    const commercialTransaction = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'RENEWAL' });
    registry.CommercialTransaction.push(commercialTransaction._id);
    assert.equal(commercialTransaction.status, 'COMPLETED', 'Transaction must reach COMPLETED across the resumed attempt');

    const invoice = await BillingInvoice.findById(secondResult.invoice);
    registry.BillingInvoice.push(invoice._id);
    assert.equal(invoice.discount, 75, 'The resumed invoice must reflect the same reward discount priced on the first attempt');

    const billingCycle = await BillingCycle.findOne({ subscription: subscription._id });
    if (billingCycle) registry.BillingCycle.push(billingCycle._id);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
