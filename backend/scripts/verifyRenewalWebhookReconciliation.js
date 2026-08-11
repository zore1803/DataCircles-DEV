// scripts/verifyRenewalWebhookReconciliation.js
//
// Fixture-based verification for the renewal-webhook correlation fix in
// controllers/subscriptionController.js (handleCAWPaymentCaptured/
// handleCAWPaymentFailed). WRITES disposable documents and deletes them
// after each fixture — do NOT point this at a production database.
//
// Drives the REAL exports.handleWebhook entry point (signature verification
// included), not the internal handlers directly — this is the actual
// production code path, not a shortcut around it.
//
// Run with: CONFIRM_TEST_DB=yes MONGO_URI=<disposable db> node scripts/verifyRenewalWebhookReconciliation.js

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Subscription = require('../models/Subscription');
const CommercialTransaction = require('../models/CommercialTransaction');
const BillingInvoice = require('../models/BillingInvoice');
const RazorpayWebhookEvent = require('../models/RazorpayWebhookEvent');
const { handleWebhook } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Subscription: [], CommercialTransaction: [], BillingInvoice: [], RazorpayWebhookEvent: [] };
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
  await RazorpayWebhookEvent.deleteMany({ _id: { $in: registry.RazorpayWebhookEvent } });
  await BillingInvoice.deleteMany({ _id: { $in: registry.BillingInvoice } });
  await CommercialTransaction.deleteMany({ _id: { $in: registry.CommercialTransaction } });
  await Subscription.deleteMany({ _id: { $in: registry.Subscription } });
}

async function trackedCreate(Model, key, registry, doc) {
  const created = await Model.create(doc);
  registry[key].push(created._id);
  return created;
}

function baseSubscriptionFields(organization, overrides = {}) {
  return {
    organization,
    planName: 'growth',
    appStatus: 'active',
    billingCycle: 'monthly',
    pricePerUser: 450,
    userCount: 5,
    totalAmount: 2250,
    mandateTokenId: 'token_test_webhook_fixture',
    razorpayCustomerId: 'cust_test_webhook_fixture',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(),
    nextBillingDate: new Date(),
    activeAddons: [],
    ...overrides,
  };
}

// Builds a real, correctly-signed webhook request/response pair, exactly as
// Razorpay would send it, so this exercises exports.handleWebhook's actual
// signature-verification path — not a bypass around it.
function buildWebhookCall(eventName, paymentEntityOverrides, eventId) {
  const body = {
    event: eventName,
    payload: {
      payment: {
        entity: {
          id: `pay_fixture_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          amount: 10000,
          status: eventName === 'payment.captured' ? 'captured' : 'failed',
          ...paymentEntityOverrides,
        },
      },
    },
  };
  const rawBody = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');

  const req = {
    headers: { 'x-razorpay-signature': signature, 'x-razorpay-event-id': eventId },
    rawBody,
    body,
  };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
  return { req, res };
}

function uniqueEventId(label) {
  return `evt_fixture_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('Renewal webhook reconciliation verification\n');

  await test('Fixture 1: late payment.failed for a COMPLETED renewal is FLAGGED ONLY — no financial state changes', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization));
    const orderId = `order_fixture_${Date.now()}`;
    const paymentId = `pay_fixture_committed_${Date.now()}`;

    const billingInvoice = await trackedCreate(BillingInvoice, 'BillingInvoice', registry, {
      organization, subscription: subscription._id, reason: 'RENEWAL',
      lineItems: [], subtotal: 100, discount: 0, taxable: 100, gst: 18, total: 118,
      status: 'PAID', paidAt: new Date(),
      razorpay: { orderId, paymentId },
    });
    const commercialTransaction = await trackedCreate(CommercialTransaction, 'CommercialTransaction', registry, {
      organization, subscription: subscription._id, type: 'RENEWAL', status: 'COMPLETED',
      target: { orderId, paymentId, total: 118, newPeriodStart: new Date(), newPeriodEnd: new Date(), appliedScheduledChangeIds: [] },
      latestInvoice: billingInvoice._id,
    });

    const { req, res } = buildWebhookCall('payment.failed', { order_id: orderId, invoice_id: null }, uniqueEventId('late-failed'));
    await handleWebhook(req, res);
    assert.equal(res.statusCode, 200);

    // Deliberately NOT reopening automatically (per review: unproven whether
    // an accepted charge can permanently fail without ever capturing, and a
    // premature retry risks a genuine double-debit) — must stay exactly as
    // it was, only flagged for manual review via failureReason.
    const reloadedCt = await CommercialTransaction.findById(commercialTransaction._id);
    assert.equal(reloadedCt.status, 'COMPLETED', 'must NOT be reopened automatically');
    assert.match(reloadedCt.failureReason || '', /RECONCILIATION_NEEDED/, 'must be flagged for manual review');

    const reloadedInvoice = await BillingInvoice.findById(billingInvoice._id);
    assert.equal(reloadedInvoice.status, 'PAID', 'must NOT be touched');

    const reloadedSub = await Subscription.findById(subscription._id);
    assert.equal(reloadedSub.appStatus, 'active', 'must NOT be touched');

    const webhookEvent = await RazorpayWebhookEvent.findOne({ subscription: subscription._id });
    assert.ok(webhookEvent, 'webhook event must still be recorded');
    registry.RazorpayWebhookEvent.push(webhookEvent._id);
  });

  await test('Fixture 2: late payment.captured for an already-COMPLETED renewal is a safe no-op', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization));
    const orderId = `order_fixture_captured_${Date.now()}`;
    const paymentId = `pay_fixture_captured_${Date.now()}`;

    const billingInvoice = await trackedCreate(BillingInvoice, 'BillingInvoice', registry, {
      organization, subscription: subscription._id, reason: 'RENEWAL',
      lineItems: [], subtotal: 100, discount: 0, taxable: 100, gst: 18, total: 118,
      status: 'PAID', paidAt: new Date(),
      razorpay: { orderId, paymentId },
    });
    const commercialTransaction = await trackedCreate(CommercialTransaction, 'CommercialTransaction', registry, {
      organization, subscription: subscription._id, type: 'RENEWAL', status: 'COMPLETED',
      target: { orderId, paymentId, total: 118, newPeriodStart: new Date(), newPeriodEnd: new Date(), appliedScheduledChangeIds: [] },
      latestInvoice: billingInvoice._id,
    });

    const { req, res } = buildWebhookCall('payment.captured', { order_id: orderId, invoice_id: null }, uniqueEventId('late-captured'));
    await handleWebhook(req, res);
    assert.equal(res.statusCode, 200);

    const reloadedCt = await CommercialTransaction.findById(commercialTransaction._id);
    assert.equal(reloadedCt.status, 'COMPLETED', 'must remain COMPLETED — confirmation, not a trigger for new work');
    const reloadedInvoice = await BillingInvoice.findById(billingInvoice._id);
    assert.equal(reloadedInvoice.status, 'PAID');
    const reloadedSub = await Subscription.findById(subscription._id);
    assert.equal(reloadedSub.appStatus, 'active', 'must not be touched');

    const webhookEvent = await RazorpayWebhookEvent.findOne({ subscription: subscription._id });
    if (webhookEvent) registry.RazorpayWebhookEvent.push(webhookEvent._id);
  });

  await test('Fixture 3: the pre-existing cross-subscription mismatch bug is fixed — an unrelated subscription with no registrationLinkId is left untouched', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    // This subscription has no registrationLinkId set, no order match, and
    // nothing to do with the incoming webhook at all — before the fix,
    // Subscription.findOne({registrationLinkId: undefined}) could have
    // matched this exact kind of document.
    const unrelatedSubscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization, {
      paymentStatus: undefined,
    }));

    const eventId = uniqueEventId('orphan');
    const { req, res } = buildWebhookCall('payment.failed', { order_id: `order_no_match_${Date.now()}`, invoice_id: null }, eventId);
    await handleWebhook(req, res);
    assert.equal(res.statusCode, 200);

    // recordWebhookEventOnce still writes a row even when nothing correlates
    // (subscription: null) — track it for cleanup like every other fixture.
    const orphanEvent = await RazorpayWebhookEvent.findOne({ razorpayEventId: eventId });
    if (orphanEvent) registry.RazorpayWebhookEvent.push(orphanEvent._id);

    const reloaded = await Subscription.findById(unrelatedSubscription._id);
    assert.equal(reloaded.appStatus, 'active', 'unrelated subscription must be untouched');
    assert.notEqual(reloaded.paymentStatus, 'payment_failed', 'unrelated subscription must not have been mutated by an unmatched webhook');
  });

  await test('Fixture 4: duplicate webhook delivery (same event id) is idempotent — no double reconciliation', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization));
    const orderId = `order_fixture_dup_${Date.now()}`;
    const paymentId = `pay_fixture_dup_${Date.now()}`;

    const billingInvoice = await trackedCreate(BillingInvoice, 'BillingInvoice', registry, {
      organization, subscription: subscription._id, reason: 'RENEWAL',
      lineItems: [], subtotal: 100, discount: 0, taxable: 100, gst: 18, total: 118,
      status: 'PAID', paidAt: new Date(),
      razorpay: { orderId, paymentId },
    });
    await trackedCreate(CommercialTransaction, 'CommercialTransaction', registry, {
      organization, subscription: subscription._id, type: 'RENEWAL', status: 'COMPLETED',
      target: { orderId, paymentId, total: 118, newPeriodStart: new Date(), newPeriodEnd: new Date(), appliedScheduledChangeIds: [] },
      latestInvoice: billingInvoice._id,
    });

    const eventId = uniqueEventId('dup');
    const call1 = buildWebhookCall('payment.failed', { order_id: orderId, invoice_id: null }, eventId);
    await handleWebhook(call1.req, call1.res);
    const webhookEvent = await RazorpayWebhookEvent.findOne({ subscription: subscription._id });
    registry.RazorpayWebhookEvent.push(webhookEvent._id);

    const afterFirst = await Subscription.findById(subscription._id);
    const historyLengthAfterFirst = afterFirst.appStatusHistory.length;

    // Same event id, same raw body shape — Razorpay's own at-least-once
    // redelivery. Must not push a second appStatusHistory entry (setAppStatus
    // is itself a no-op on same-value, but the point being verified here is
    // that recordWebhookEventOnce's unique index blocks the second call from
    // reaching the reconciliation branch at all).
    const call2 = buildWebhookCall('payment.failed', { order_id: orderId, invoice_id: null }, eventId);
    await handleWebhook(call2.req, call2.res);

    const afterSecond = await Subscription.findById(subscription._id);
    assert.equal(afterSecond.appStatusHistory.length, historyLengthAfterFirst, 'duplicate delivery must not reprocess');

    const eventCount = await RazorpayWebhookEvent.countDocuments({ razorpayEventId: eventId });
    assert.equal(eventCount, 1, 'only one RazorpayWebhookEvent row for this event id');
  });

  await test('Task 1: an async payment.failed for a still-PRICED (in-flight) renewal charge correlates by order_id and lands the subscription in PAST_DUE — the exact gap this fixes', async (registry) => {
    const organization = new mongoose.Types.ObjectId();
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(organization, { appStatus: 'active' }));
    const orderId = `order_fixture_pending_${Date.now()}`;

    const commercialTransaction = await trackedCreate(CommercialTransaction, 'CommercialTransaction', registry, {
      organization, subscription: subscription._id, type: 'RENEWAL', status: 'PRICED',
      target: { orderId, total: 118, newPeriodStart: new Date(), newPeriodEnd: new Date(), appliedScheduledChangeIds: [] },
    });

    const { req, res } = buildWebhookCall('payment.failed', { order_id: orderId, invoice_id: null }, uniqueEventId('renewal-fail'));
    await handleWebhook(req, res);
    assert.equal(res.statusCode, 200);

    const reloadedSub = await Subscription.findById(subscription._id);
    assert.equal(reloadedSub.appStatus, 'past_due', 'before this fix, this webhook matched NO handler at all and appStatus would have silently stayed active');
    assert.ok(
      reloadedSub.appStatusHistory.some((h) => h.to === 'past_due' && /Renewal charge failed/.test(h.reason || '')),
      'must reuse the SAME failure reason/transition renewSubscription() already uses for a synchronously-detected failure — no new failure-state path invented'
    );

    // Non-terminal transaction is left exactly as-is (still PRICED) — same
    // invariant as renewSubscription()'s own synchronous failure branch, so
    // a resumed retry finds this same transaction rather than a dead end.
    const reloadedCt = await CommercialTransaction.findById(commercialTransaction._id);
    assert.equal(reloadedCt.status, 'PRICED', 'must remain non-terminal for the retry engine to resume');

    const webhookEvent = await RazorpayWebhookEvent.findOne({ subscription: subscription._id });
    assert.ok(webhookEvent, 'webhook event must be recorded, correlated to the right subscription');
    registry.RazorpayWebhookEvent.push(webhookEvent._id);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
