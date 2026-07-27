// scripts/verifyRetryEngine.js
//
// Fixture-based verification for retryRenewal() (utils/retryEngine.js).
// WRITES disposable Subscription/CommercialTransaction/BillingInvoice/
// BillingCycle documents and deletes them after each fixture — do NOT point
// this at a production database. Same shape as verifyScheduledChangeRenewal.js.
//
// Specifically targets the open question flagged in retryEngine.js's own
// header comment: RETRY_INTERVALS_MS = [24h, 72h, 120h] is taken as offsets
// from the ORIGINAL failure (pastDueSince), not from the previous retry —
// this fixture proves that reading by actually driving three consecutive
// retry attempts against real timestamps and checking the resulting
// nextRetryAt values, rather than trusting that the gate-check arithmetic
// and the PAST_DUE-branch arithmetic stay in sync by inspection.
//
// Run with: CONFIRM_TEST_DB=yes MONGO_URI=<disposable db> node scripts/verifyRetryEngine.js
// Exits non-zero on any failed assertion.

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Subscription = require('../models/Subscription');
const CommercialTransaction = require('../models/CommercialTransaction');
const BillingInvoice = require('../models/BillingInvoice');
const BillingCycle = require('../models/BillingCycle');
const { renewSubscription } = require('../utils/renewalEngine');
const { retryRenewal } = require('../utils/retryEngine');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error(
    '❌ Refusing to run: this script CREATES and DELETES documents. ' +
    'Set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database first.'
  );
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Subscription: [], CommercialTransaction: [], BillingInvoice: [], BillingCycle: [] };
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
  await Subscription.deleteMany({ _id: { $in: registry.Subscription } });
}

async function trackedCreate(Model, registryKey, registry, doc) {
  const created = await Model.create(doc);
  registry[registryKey].push(created._id);
  return created;
}

function baseSubscriptionFields(organization, overrides = {}) {
  const now = new Date();
  const periodEnd = new Date(now);
  return {
    organization,
    planName: 'growth',
    appStatus: 'active',
    billingCycle: 'monthly',
    pricePerUser: 450,
    userCount: 5,
    totalAmount: 2250,
    mandateTokenId: 'token_test_fixture_retry',
    currentPeriodStart: new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: periodEnd,
    nextBillingDate: periodEnd,
    activeAddons: [],
    ...overrides,
  };
}

const okCharge = async () => ({ success: true, paymentId: 'pay_test', orderId: 'order_test' });
const failCharge = async () => ({ success: false });

const HOUR = 60 * 60 * 1000;

// Drives a subscription into a real PAST_DUE state via renewSubscription()
// itself (not hand-built), then backdates the resulting appStatusHistory
// entry to `hoursAgo` so retry-window gating can be tested without waiting
// real hours. Registers every doc it creates for cleanup.
async function makePastDueSubscription(registry, organization, hoursAgo) {
  const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization));
  const result = await renewSubscription(subscription, { chargeMandateFn: failCharge });
  assert.equal(result.outcome, 'PAST_DUE', 'fixture setup: expected renewSubscription() to produce PAST_DUE');
  registry.BillingInvoice.push(result.invoice);
  registry.CommercialTransaction.push(result.transaction);

  const reloaded = await Subscription.findById(subscription._id);
  assert.equal(reloaded.appStatus, 'past_due');
  const historyIdx = reloaded.appStatusHistory.findIndex((h) => h.to === 'past_due');
  assert.ok(historyIdx >= 0, 'fixture setup: expected an appStatusHistory entry recording the past_due transition');
  reloaded.appStatusHistory[historyIdx].at = new Date(Date.now() - hoursAgo * HOUR);
  reloaded.markModified('appStatusHistory');
  await reloaded.save();

  return reloaded;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('retryRenewal() fixture verification\n');

  await test('Fixture A: appStatus !== past_due — NOT_ELIGIBLE / NOT_PAST_DUE', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization, { appStatus: 'active' }));
    const result = await retryRenewal({ subscription, chargeMandateFn: okCharge });
    assert.equal(result.outcome, 'NOT_ELIGIBLE');
    assert.equal(result.reason, 'NOT_PAST_DUE');
  });

  await test('Fixture B: past_due but no pending RENEWAL transaction — NOT_ELIGIBLE / NO_PENDING_RENEWAL_TRANSACTION', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization, { appStatus: 'past_due' }));
    const result = await retryRenewal({ subscription, chargeMandateFn: okCharge });
    assert.equal(result.outcome, 'NOT_ELIGIBLE');
    assert.equal(result.reason, 'NO_PENDING_RENEWAL_TRANSACTION');
  });

  await test('Fixture C: past_due, pending transaction, no past_due history entry — MISSING_PAST_DUE_TIMESTAMP', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization, { appStatus: 'past_due', appStatusHistory: [] }));
    await trackedCreate(CommercialTransaction, 'CommercialTransaction', registry, {
      organization,
      subscription: subscription._id,
      type: 'RENEWAL',
      status: 'PRICED',
      target: { newPeriodStart: new Date(), newPeriodEnd: new Date(), total: 100, appliedScheduledChangeIds: [] },
    });
    const result = await retryRenewal({ subscription, chargeMandateFn: okCharge });
    assert.equal(result.outcome, 'NOT_ELIGIBLE');
    assert.equal(result.reason, 'MISSING_PAST_DUE_TIMESTAMP');
  });

  await test('Fixture D: past_due only 1h ago — NOT_YET_DUE, gated at pastDueSince+24h', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await makePastDueSubscription(registry, organization, 1);
    const historyAt = subscription.appStatusHistory.find((h) => h.to === 'past_due').at;

    const result = await retryRenewal({ subscription, chargeMandateFn: okCharge });
    assert.equal(result.outcome, 'NOT_YET_DUE');
    assert.equal(result.attemptsMade, 0);
    assert.equal(result.nextRetryAt.getTime(), historyAt.getTime() + 24 * HOUR);
  });

  // Fixture E — the core question: three consecutive failing retries against
  // a pastDueSince set 200h in the past (past all three thresholds), driven
  // exactly the way a real scheduler would call this repeatedly. Asserts
  // every nextRetryAt is an offset from the ORIGINAL pastDueSince, not from
  // the immediately preceding retry.
  await test('Fixture E: three consecutive failing retries — nextRetryAt is always pastDueSince + [24h,72h,120h], not cumulative from the prior retry', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await makePastDueSubscription(registry, organization, 200);
    const pastDueSince = subscription.appStatusHistory.find((h) => h.to === 'past_due').at.getTime();

    const r1 = await retryRenewal({ subscription, chargeMandateFn: failCharge });
    assert.equal(r1.outcome, 'PAST_DUE');
    assert.equal(r1.attemptsMade, 1);
    assert.equal(r1.retriesRemaining, 2);
    assert.equal(r1.nextRetryAt.getTime(), pastDueSince + 72 * HOUR, 'after attempt 1 fails, next retry must be pastDueSince+72h');

    const afterR1 = await Subscription.findById(subscription._id);
    const gate2 = await retryRenewal({ subscription: afterR1, chargeMandateFn: failCharge });
    assert.equal(gate2.outcome, 'PAST_DUE', 'attempt 2 must actually run (pastDueSince+72h has already passed)');
    assert.equal(gate2.attemptsMade, 2);
    assert.equal(gate2.retriesRemaining, 1);
    assert.equal(gate2.nextRetryAt.getTime(), pastDueSince + 120 * HOUR, 'after attempt 2 fails, next retry must be pastDueSince+120h, not +72h+72h');

    const afterR2 = await Subscription.findById(subscription._id);
    const gate3 = await retryRenewal({ subscription: afterR2, chargeMandateFn: failCharge });
    assert.equal(gate3.outcome, 'PAST_DUE');
    assert.equal(gate3.attemptsMade, 3);
    assert.equal(gate3.retriesRemaining, 0);
    assert.equal(gate3.nextRetryAt, null, 'retries exhausted after the 3rd failed attempt — no further nextRetryAt');

    const afterR3 = await Subscription.findById(subscription._id);
    const gate4 = await retryRenewal({ subscription: afterR3, chargeMandateFn: failCharge });
    assert.equal(gate4.outcome, 'RETRIES_EXHAUSTED');
    assert.equal(gate4.attemptsMade, 3);
  });

  await test('Fixture F: retry succeeds — appStatus -> active, RETRY_SUCCEEDED', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await makePastDueSubscription(registry, organization, 200);

    const result = await retryRenewal({ subscription, chargeMandateFn: okCharge });
    assert.equal(result.outcome, 'RETRY_SUCCEEDED');
    assert.equal(result.attemptsMade, 1);

    const reloaded = await Subscription.findById(subscription._id);
    assert.equal(reloaded.appStatus, 'active');

    const ct = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'RENEWAL' });
    registry.BillingCycle.push((await BillingCycle.findOne({ subscription: subscription._id }))._id);
    assert.equal(ct.status, 'COMPLETED');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
