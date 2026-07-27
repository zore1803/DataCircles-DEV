// scripts/verifyScheduledChangeRenewal.js
//
// Fixture-based verification for the ScheduledChange read-side migration
// (renewSubscription() R3). WRITES disposable Subscription/ScheduledChange/
// CommercialTransaction/BillingInvoice/BillingCycle documents and deletes
// them again after each fixture — do NOT point this at a production
// database. Deliberately kept separate from checkScheduledChangeDuplicates.js,
// which is read-only and safe against real data; this script is the opposite.
//
// Run with: CONFIRM_TEST_DB=yes MONGO_URI=<disposable db> node scripts/verifyScheduledChangeRenewal.js
// Exits non-zero on any failed assertion.

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Subscription = require('../models/Subscription');
const ScheduledChange = require('../models/ScheduledChange');
const CommercialTransaction = require('../models/CommercialTransaction');
const BillingInvoice = require('../models/BillingInvoice');
const BillingCycle = require('../models/BillingCycle');
const { calculateInvoice } = require('../utils/invoiceEngine');
const { renewSubscription } = require('../utils/renewalEngine');

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
  const registry = { Subscription: [], ScheduledChange: [], CommercialTransaction: [], BillingInvoice: [], BillingCycle: [] };
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
  await ScheduledChange.deleteMany({ _id: { $in: registry.ScheduledChange } });
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
  const periodEnd = new Date(now); // due for renewal now
  return {
    organization,
    planName: 'growth',
    appStatus: 'active',
    billingCycle: 'monthly',
    pricePerUser: 450,
    userCount: 5,
    totalAmount: 2250,
    mandateTokenId: 'token_test_fixture',
    currentPeriodStart: new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: periodEnd,
    nextBillingDate: periodEnd,
    activeAddons: [],
    ...overrides,
  };
}

async function countCommercialAndInvoice(subscriptionId) {
  const [ctCount, biCount] = await Promise.all([
    CommercialTransaction.countDocuments({ subscription: subscriptionId }),
    BillingInvoice.countDocuments({ subscription: subscriptionId }),
  ]);
  return { ctCount, biCount };
}

const okCharge = async () => ({ success: true, paymentId: 'pay_test', orderId: 'order_test' });
const failCharge = async () => ({ success: false });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('renewSubscription() / ScheduledChange read-side migration\n');

  // Fixture 0 — Edit 1 sanity check, run first per review: REDUCE_QUANTITY has
  // no verified handler and must throw loudly rather than silently mis-price,
  // and must throw *before* any BillingInvoice/CommercialTransaction is created
  // (buildEffectiveSubscription() runs before R10's invoice write).
  await test('Fixture 0: PENDING REDUCE_QUANTITY throws, no invoice/transaction created', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization));
    await trackedCreate(ScheduledChange, 'ScheduledChange', registry, {
      organization,
      subscription: subscription._id,
      type: 'REDUCE_QUANTITY',
      status: 'PENDING',
      effectiveAt: new Date(Date.now() - 60 * 1000),
      payload: { addonKey: 'extra_seat', quantity: 1 },
    });

    await assert.rejects(() => renewSubscription(subscription, { chargeMandateFn: okCharge }));

    const { ctCount, biCount } = await countCommercialAndInvoice(subscription._id);
    assert.equal(ctCount, 0, 'no CommercialTransaction should exist after a clean throw');
    assert.equal(biCount, 0, 'no BillingInvoice should exist after a clean throw');
  });

  // Fixture 1 — regression baseline: zero pending ScheduledChange records.
  await test('Fixture 1: zero PENDING ScheduledChange — renews at current plan/price, unaffected by migration', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization));

    const expected = calculateInvoice({
      subscription: {
        planName: subscription.planName,
        billingCycle: subscription.billingCycle,
        pricePerUser: subscription.pricePerUser,
        activeAddons: [],
      },
      resolvedModifiers: [],
    });

    const result = await renewSubscription(subscription, { chargeMandateFn: okCharge });
    assert.equal(result.outcome, 'RENEWED');

    const invoice = await BillingInvoice.findById(result.invoice);
    assert.equal(invoice.total, expected.total);
    registry.BillingInvoice.push(invoice._id);
    registry.BillingCycle.push(result.billingCycle);
    const ct = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'RENEWAL' });
    registry.CommercialTransaction.push(ct._id);
  });

  // Fixture 2a — PLAN_CHANGE applied on success.
  await test('Fixture 2a: PENDING PLAN_CHANGE — new plan/price used, record EXECUTED on success', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization));
    const change = await trackedCreate(ScheduledChange, 'ScheduledChange', registry, {
      organization,
      subscription: subscription._id,
      type: 'PLAN_CHANGE',
      status: 'PENDING',
      effectiveAt: new Date(Date.now() - 60 * 1000),
      payload: { planId: 'business', pricePerUser: 900 },
    });

    const expected = calculateInvoice({
      subscription: { planName: 'business', billingCycle: 'monthly', pricePerUser: 900, activeAddons: [] },
      resolvedModifiers: [],
    });

    const result = await renewSubscription(subscription, { chargeMandateFn: okCharge });
    assert.equal(result.outcome, 'RENEWED');
    const invoice = await BillingInvoice.findById(result.invoice);
    assert.equal(invoice.total, expected.total, 'invoice must be priced off the NEW plan, not the original');
    registry.BillingInvoice.push(invoice._id);
    registry.BillingCycle.push(result.billingCycle);
    const ct = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'RENEWAL' });
    registry.CommercialTransaction.push(ct._id);

    const reloaded = await ScheduledChange.findById(change._id);
    assert.equal(reloaded.status, 'EXECUTED');
  });

  // Fixture 2b — same PLAN_CHANGE, charge fails: PAST_DUE, record stays PENDING.
  await test('Fixture 2b: PENDING PLAN_CHANGE — charge failure leaves record PENDING, outcome PAST_DUE', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization));
    const change = await trackedCreate(ScheduledChange, 'ScheduledChange', registry, {
      organization,
      subscription: subscription._id,
      type: 'PLAN_CHANGE',
      status: 'PENDING',
      effectiveAt: new Date(Date.now() - 60 * 1000),
      payload: { planId: 'business', pricePerUser: 900 },
    });

    const result = await renewSubscription(subscription, { chargeMandateFn: failCharge });
    assert.equal(result.outcome, 'PAST_DUE');
    registry.BillingInvoice.push(result.invoice);
    const ct = await CommercialTransaction.findById(result.transaction);
    registry.CommercialTransaction.push(ct._id);
    assert.equal(ct.status, 'PRICED', 'a clean charge failure must not touch commercial state');

    const reloaded = await ScheduledChange.findById(change._id);
    assert.equal(reloaded.status, 'PENDING', 'must not be marked EXECUTED on charge failure');
  });

  // Fixture 3 — REMOVE_ADDON excluded from priced total, executed on success.
  await test('Fixture 3: PENDING REMOVE_ADDON — addon excluded from total, record EXECUTED', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization, {
      activeAddons: [{ addonKey: 'custom_domain', quantity: 1, pricePerUnit: 100 }],
    }));
    const change = await trackedCreate(ScheduledChange, 'ScheduledChange', registry, {
      organization,
      subscription: subscription._id,
      type: 'REMOVE_ADDON',
      status: 'PENDING',
      effectiveAt: new Date(Date.now() - 60 * 1000),
      payload: { addonKey: 'custom_domain', quantity: 1 },
    });

    const withAddon = calculateInvoice({
      subscription: { planName: 'growth', billingCycle: 'monthly', pricePerUser: 450, activeAddons: [{ addonKey: 'custom_domain', quantity: 1, pricePerUnit: 100 }] },
      resolvedModifiers: [],
    });
    const withoutAddon = calculateInvoice({
      subscription: { planName: 'growth', billingCycle: 'monthly', pricePerUser: 450, activeAddons: [] },
      resolvedModifiers: [],
    });
    assert.notEqual(withAddon.total, withoutAddon.total, 'fixture sanity: addon must actually change the total');

    const result = await renewSubscription(subscription, { chargeMandateFn: okCharge });
    assert.equal(result.outcome, 'RENEWED');
    const invoice = await BillingInvoice.findById(result.invoice);
    assert.equal(invoice.total, withoutAddon.total, 'invoice must be priced with the addon already removed');
    registry.BillingInvoice.push(invoice._id);
    registry.BillingCycle.push(result.billingCycle);
    const ct = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'RENEWAL' });
    registry.CommercialTransaction.push(ct._id);

    const reloaded = await ScheduledChange.findById(change._id);
    assert.equal(reloaded.status, 'EXECUTED');
  });

  // Fixture 4 — due CANCELLATION short-circuits renewal entirely.
  await test('Fixture 4: PENDING CANCELLATION — no invoice/transaction, appStatus cancelled, record EXECUTED', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization));
    const change = await trackedCreate(ScheduledChange, 'ScheduledChange', registry, {
      organization,
      subscription: subscription._id,
      type: 'CANCELLATION',
      status: 'PENDING',
      effectiveAt: new Date(Date.now() - 60 * 1000),
      payload: {},
    });

    let chargeCalls = 0;
    const countingCharge = async () => { chargeCalls++; return okCharge(); };

    const result = await renewSubscription(subscription, { chargeMandateFn: countingCharge });
    assert.equal(result.outcome, 'CANCELLED');
    assert.equal(chargeCalls, 0, 'chargeMandateFn must never be called when a cancellation is due');

    const { ctCount, biCount } = await countCommercialAndInvoice(subscription._id);
    assert.equal(ctCount, 0);
    assert.equal(biCount, 0);

    const reloadedSub = await Subscription.findById(subscription._id);
    assert.equal(reloadedSub.appStatus, 'cancelled');

    const reloadedChange = await ScheduledChange.findById(change._id);
    assert.equal(reloadedChange.status, 'EXECUTED');
  });

  // Fixture 5 — resume scenario: repair-forward must not re-apply changes or
  // re-charge on the second call.
  await test('Fixture 5: resume after CHARGE_COMMITTED — reads appliedScheduledChangeIds, does not re-apply or re-charge', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization));
    const change = await trackedCreate(ScheduledChange, 'ScheduledChange', registry, {
      organization,
      subscription: subscription._id,
      type: 'PLAN_CHANGE',
      status: 'PENDING',
      effectiveAt: new Date(Date.now() - 60 * 1000),
      payload: { planId: 'business', pricePerUser: 900 },
    });

    let chargeCalls = 0;
    const countingCharge = async () => { chargeCalls++; return okCharge(); };

    await assert.rejects(() =>
      renewSubscription(subscription, { chargeMandateFn: countingCharge, _injectFailureAfter: 'CHARGE_COMMITTED' })
    );
    assert.equal(chargeCalls, 1);

    const ctAfterFirstCall = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'RENEWAL' });
    assert.equal(ctAfterFirstCall.status, 'COMMITTED');
    assert.deepEqual(
      ctAfterFirstCall.target.appliedScheduledChangeIds.map(String),
      [change._id.toString()],
      'appliedScheduledChangeIds must already be persisted on the first (interrupted) attempt'
    );
    const changeAfterFirstCall = await ScheduledChange.findById(change._id);
    assert.equal(changeAfterFirstCall.status, 'PENDING', 'must not be marked EXECUTED until the resumed call reaches Step 9');

    const result = await renewSubscription(subscription, { chargeMandateFn: countingCharge });
    assert.equal(result.outcome, 'RENEWED');
    assert.equal(chargeCalls, 1, 'the resumed call must NOT charge a second time');

    registry.BillingInvoice.push(result.invoice);
    registry.BillingCycle.push(result.billingCycle);
    registry.CommercialTransaction.push(ctAfterFirstCall._id);

    const changeAfterResume = await ScheduledChange.findById(change._id);
    assert.equal(changeAfterResume.status, 'EXECUTED', 'resumed call must still mark the change EXECUTED exactly once');

    const invoice = await BillingInvoice.findById(result.invoice);
    const expected = calculateInvoice({
      subscription: { planName: 'business', billingCycle: 'monthly', pricePerUser: 900, activeAddons: [] },
      resolvedModifiers: [],
    });
    assert.equal(invoice.total, expected.total, 'resume must not re-price off a different effective subscription');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
