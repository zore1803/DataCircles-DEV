// scripts/verifyAddonRenewalEngine.js
//
// Task 1 (Aug 2026), Option A: a monthly-cadence add-on must actually be
// charged every month, on its own independent cadence, even while sitting
// on an annual base plan — this verifies utils/addonRenewalEngine.js does
// exactly that, and does NOT touch an add-on whose cycle already matches
// the subscription's own (no double-charge risk).
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyAddonRenewalEngine.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const CommercialTransaction = require('../models/CommercialTransaction');
const BillingInvoice = require('../models/BillingInvoice');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const ScheduledChange = require('../models/ScheduledChange');
const { renewAddonInstance, runAddonRenewals, computeNextAddonRenewalDate } = require('../utils/addonRenewalEngine');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database.');
  process.exit(1);
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}:`, err); }
}

const cleanupIds = { subs: [], orgs: [], txns: [], invoices: [], payments: [], scs: [] };
async function cleanup() {
  if (cleanupIds.txns.length) await CommercialTransaction.deleteMany({ _id: { $in: cleanupIds.txns } });
  if (cleanupIds.invoices.length) await BillingInvoice.deleteMany({ _id: { $in: cleanupIds.invoices } });
  if (cleanupIds.payments.length) await SubscriptionPayment.deleteMany({ _id: { $in: cleanupIds.payments } });
  if (cleanupIds.scs.length) await ScheduledChange.deleteMany({ _id: { $in: cleanupIds.scs } });
  if (cleanupIds.subs.length) await Subscription.deleteMany({ _id: { $in: cleanupIds.subs } });
  if (cleanupIds.orgs.length) await Organization.deleteMany({ _id: { $in: cleanupIds.orgs } });
  cleanupIds.subs = []; cleanupIds.orgs = []; cleanupIds.txns = []; cleanupIds.invoices = []; cleanupIds.payments = []; cleanupIds.scs = [];
}

async function makeAnnualSubWithMonthlyAddon(nextRenewalAt) {
  const org = await Organization.create({ name: 'Addon Renewal Engine Fixture', code: 'addonrenew-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) });
  cleanupIds.orgs.push(org._id);
  const sub = await Subscription.create({
    organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
    billingCycle: 'yearly', pricePerUser: 4800, userCount: 1, totalAmount: 4800,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    mandateTokenId: 'token_test_fixture', razorpayCustomerId: 'cust_test_fixture',
    currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
    billingAnchor: new Date(),
    activeAddons: [
      { addonKey: 'seat', quantity: 2, pricePerUnit: 100, billingCycle: 'monthly', addedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), nextRenewalAt },
    ],
  });
  cleanupIds.subs.push(sub._id);
  return sub;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running independent add-on renewal fixtures...\n');

  await test('SUCCESS: due monthly add-on on an annual base is charged its own monthly price, clock advances exactly one month, billingCycle/pricePerUnit untouched', async () => {
    const dueAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // due yesterday
    const sub = await makeAnnualSubWithMonthlyAddon(dueAt);
    const addon = sub.activeAddons[0];

    let chargeCalls = 0;
    const result = await renewAddonInstance({
      subscription: sub, addon,
      chargeMandateFn: async ({ amount }) => { chargeCalls++; assert.equal(amount, 236, 'must charge quantity(2) * pricePerUnit(100) = 200 + 18% GST = 236'); return { success: true, paymentId: 'pay_test', orderId: 'order_test' }; },
    });

    assert.equal(chargeCalls, 1);
    assert.equal(result.outcome, 'RENEWED');
    assert.equal(addon.billingCycle, 'monthly', 'billingCycle must be untouched — only the renewal clock moves');
    assert.equal(addon.pricePerUnit, 100, 'pricePerUnit must be untouched');
    assert.equal(addon.lastRenewalAt.getTime(), dueAt.getTime());
    assert.equal(addon.nextRenewalAt.getTime(), computeNextAddonRenewalDate(dueAt).getTime(), 'next renewal must be exactly one month from the DUE date, not from "now"');

    cleanupIds.txns.push(result.transaction);
    cleanupIds.invoices.push(result.invoice);
    const payment = await SubscriptionPayment.findOne({ subscription: sub._id, paymentFor: 'addon_renewal' });
    assert.ok(payment, 'a real SubscriptionPayment record must exist for this charge');
    cleanupIds.payments.push(payment._id);
    await cleanup();
  });

  await test('FAILURE: a clean charge decline schedules the add-on for removal at its own next-due date, never immediately, and does NOT touch the base subscription appStatus', async () => {
    const dueAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sub = await makeAnnualSubWithMonthlyAddon(dueAt);
    const addon = sub.activeAddons[0];
    const appStatusBefore = sub.appStatus;

    const result = await renewAddonInstance({
      subscription: sub, addon,
      chargeMandateFn: async () => ({ success: false, reason: 'CARD_DECLINED' }),
    });

    assert.equal(result.outcome, 'FAILED_SCHEDULED_FOR_REMOVAL');
    assert.equal(sub.appStatus, appStatusBefore, 'the BASE subscription must be completely unaffected — this is an independently-billed item, not the combined-invoice case SU9 covers');

    const sc = await ScheduledChange.findOne({ subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING' });
    assert.ok(sc, 'a removal must be scheduled');
    assert.equal(sc.effectiveAt.getTime(), dueAt.getTime(), 'access continues exactly until the boundary that failed to renew — never revoked early, never extended');
    cleanupIds.scs.push(sc._id);
    cleanupIds.txns.push(result.transaction);
    cleanupIds.invoices.push(result.invoice);
    await cleanup();
  });

  await test('sweep (runAddonRenewals): only picks up add-ons that are actually DUE (nextRenewalAt <= now) — an add-on due next week is left alone', async () => {
    const notYetDue = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const sub = await makeAnnualSubWithMonthlyAddon(notYetDue);

    const results = await runAddonRenewals({ now: new Date(), SubscriptionModel: Subscription });
    const thisSubResult = results.find((r) => String(r.subscription) === String(sub._id));
    assert.equal(thisSubResult, undefined, 'must not renew an add-on that is not yet due');
    await cleanup();
  });

  await test('sweep (runAddonRenewals): a genuinely due add-on gets renewed by the sweep entry point', async () => {
    const dueAt = new Date(Date.now() - 60 * 60 * 1000); // due an hour ago
    const sub = await makeAnnualSubWithMonthlyAddon(dueAt);

    const results = await runAddonRenewals({
      now: new Date(), SubscriptionModel: Subscription,
      renewAddonInstanceFn: async ({ subscription, addon }) => renewAddonInstance({
        subscription, addon,
        chargeMandateFn: async () => ({ success: true, paymentId: 'pay_sweep_test', orderId: 'order_sweep_test' }),
      }),
    });

    const thisSubResult = results.find((r) => String(r.subscription) === String(sub._id));
    assert.ok(thisSubResult, 'the due add-on must be picked up by the sweep');
    assert.equal(thisSubResult.outcome, 'RENEWED');
    cleanupIds.txns.push(thisSubResult.transaction);
    cleanupIds.invoices.push(thisSubResult.invoice);
    const payment = await SubscriptionPayment.findOne({ subscription: sub._id, paymentFor: 'addon_renewal' });
    if (payment) cleanupIds.payments.push(payment._id);
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
