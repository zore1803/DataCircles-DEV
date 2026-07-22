// utils/renewalEngine.js
//
// Renewal Engine — Phase 4B Slice 1 ("Renewal Happy Path v1"), per
// IMPLEMENTATION_PLAN_V1.md's Phase 4B design subsection and
// BILLING_DOMAIN_SPECIFICATION.md Chapter 3.5 (R1-R13).
//
// SCOPE OF THIS SLICE, DELIBERATELY NARROW: one subscription, zero PENDING
// ScheduledChange records, valid mandate, successful charge. This is not the
// full Renewal Engine — it is the happy path only. NOT wired into any cron,
// scheduler, or webhook. Not called from anywhere yet — callable, not running.
//
// Explicitly NOT built in this slice (see PAST_DUE/RECONCILIATION_NEEDED/
// SKIPPED stubs below):
//   - ScheduledChange application (R3's actual "apply due changes" logic) —
//     this slice's R3 is trivial (Effective Subscription = current
//     Subscription) because the precondition is zero PENDING records.
//   - Payment failure / past_due handling (R12's failure branch, R7's
//     "Unknown -> Reconciliation Queue" branch).
//   - Retry Engine interaction (R2's `retrying` ownership boundary) — the
//     `retrying` appStatus value does not exist in the schema yet, deferred to
//     whichever session builds retry/failure handling, per this slice's brief.
//   - Coupon duration/cycles-remaining recalculation (R7) and Referral Engine
//     re-application (R8) in full: this slice reuses `subscription.appliedCoupon`
//     as a flat fixed-amount modifier if present, without validating whether
//     the coupon's duration/cycles-remaining still applies at this renewal —
//     that validation is real R7 engine work, deferred, not built here. No
//     referral modifier is constructed in this slice at all (referral rewards
//     in this codebase are one-time reservations consumed at purchase time,
//     not a recurring per-cycle modifier) — R8's full scope is deferred.
//
// CAW-only. Legacy (non-CAW, Razorpay-Subscription-driven) renewal is
// completely untouched — those subscriptions keep renewing via
// handleSubscriptionCharged/Razorpay's own webhooks, unrelated to this file.

const { calculateInvoice } = require('./invoiceEngine');
const BillingInvoice = require('../models/BillingInvoice');
const BillingCycle = require('../models/BillingCycle');
const CommercialTransaction = require('../models/CommercialTransaction');
const ScheduledChange = require('../models/ScheduledChange');

/**
 * @param {Object} subscription - a Subscription document, already confirmed:
 *   due (nextBillingDate <= now), appStatus renewable, mandateTokenId present,
 *   zero PENDING ScheduledChange records for it. This function does NOT
 *   itself perform R1/R2's due/renewable checks or the ScheduledChange query —
 *   those are the caller's job in this slice (no cron/dispatcher exists yet).
 * @param {Function} chargeMandateFn - injected CAW charge call, real signature
 *   TBD by whichever session wires actual Razorpay charging; must resolve to
 *   { success: true, paymentId, orderId } or throw. Injected so this slice's
 *   own tests can stub it without touching real Razorpay.
 * @returns {Promise<RenewalResult>}
 *
 * PHASE 4B SLICE 2 — R13.5 idempotent repair-forward. Every step below checks
 * "did this already happen?" against existing persisted state before acting,
 * same philosophy as reconcileMandate (subscriptionController.js:1880) — not
 * a Mongo transaction (the charge is an external, non-reversible side effect;
 * no local transaction can roll it back), and not a new orchestrator. Calling
 * this function twice for the same subscription+period, at any point after a
 * partial failure, resumes from the first incomplete step instead of
 * re-running completed ones — the mandate is charged at most once per period.
 * @param {String} [_injectFailureAfter] - TEST ONLY, undefined in all production
 *   call sites. Throws immediately after the named checkpoint's write
 *   succeeds, so Step 6's verification scenarios can prove repair-forward
 *   resumes correctly. One of 'CHARGE_COMMITTED' | 'INVOICE_PAID' |
 *   'SUBSCRIPTION_ADVANCED'. No effect on any real code path when omitted.
 */
async function renewSubscription(subscription, { chargeMandateFn, _injectFailureAfter } = {}) {
  if (!subscription.mandateTokenId) {
    return skippedNotImplemented();
  }

  // Step 0 — resume check. The existing partial unique index on
  // CommercialTransaction ({subscription:1, type:1}, non-terminal statuses)
  // guarantees at most one non-terminal RENEWAL transaction per subscription
  // at a time — so finding one here means this IS the in-progress attempt
  // for the current period, not a stale one, and reusing it (rather than
  // creating a second invoice/transaction) is exactly what avoids re-charging.
  let commercialTransaction = await CommercialTransaction.findOne({
    organization: subscription.organization,
    subscription: subscription._id,
    type: 'RENEWAL',
    status: { $in: ['PRICED', 'COMMITTED'] },
  });

  let billingInvoice;
  let newPeriodStart;
  let newPeriodEnd;

  if (commercialTransaction) {
    // Resuming a prior attempt — reuse its invoice and target period rather
    // than recomputing (recomputing pricing here would risk pricing drift if
    // catalog prices changed between attempts; the original invoice is the
    // one the customer was already charged against).
    billingInvoice = await BillingInvoice.findById(commercialTransaction.latestInvoice);
    newPeriodStart = new Date(commercialTransaction.target.newPeriodStart);
    newPeriodEnd = new Date(commercialTransaction.target.newPeriodEnd);
  } else {
    // Fresh renewal — steps 1-3 of the original commit sequence, unchanged
    // from Slice 1, except newPeriodStart/newPeriodEnd are now computed here
    // (before charging) and stored in CommercialTransaction.target so a
    // resumed run can know the target period without re-deriving it from a
    // Subscription document that may have already been advanced.

    // R3 — build Effective Subscription. Trivial in this slice: this
    // function's precondition (enforced by the caller, not re-checked here)
    // is zero PENDING ScheduledChange records, so the Effective Subscription
    // is simply the current Subscription's own commercial fields. Real
    // ScheduledChange application is a later slice's work, not this one's.
    const effective = {
      planName: subscription.planName,
      billingCycle: subscription.billingCycle,
      pricePerUser: subscription.pricePerUser,
      activeAddons: subscription.activeAddons || [],
    };

    // R7 (simplified, see file header) — reuse appliedCoupon as a flat
    // fixed-amount modifier if present. Full duration/cycles-remaining
    // validation is deferred, not built here.
    const resolvedModifiers = [];
    if (subscription.appliedCoupon?.discountAmount) {
      resolvedModifiers.push({
        type: 'coupon',
        value: { kind: 'fixed', amount: subscription.appliedCoupon.discountAmount },
        appliesTo: 'entire_invoice',
      });
    }
    // R8 — no referral modifier constructed in this slice (see file header).

    // R4-R9 — price via calculateInvoice(), no adjustmentContext (a renewal
    // is a fresh full-period charge, same shape as createSubscription's own
    // call).
    const invoice = calculateInvoice({ subscription: effective, resolvedModifiers });

    newPeriodStart = subscription.currentPeriodEnd;
    newPeriodEnd = computeNextPeriodEnd(subscription);

    // R10 — persist BillingInvoice as PENDING_PAYMENT before charging. A
    // failure here is fatal to the renewal (R13's commit needs a real
    // invoice document to reference) — unlike Phase 2's signup concession,
    // this is new construction, not a migration shadowing an
    // already-authoritative legacy write.
    billingInvoice = await BillingInvoice.create({
      organization: subscription.organization,
      subscription: subscription._id,
      reason: 'RENEWAL',
      lineItems: invoice.lines,
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      taxable: invoice.taxable,
      gst: invoice.gst,
      total: invoice.total,
      generatedAt: invoice.generatedAt,
      status: 'PENDING_PAYMENT',
    });

    // CommercialTransaction{type:'RENEWAL'} — CREATED/PRICED collapsed into
    // one write (mirrors the add-on-purchase/upgrade pattern: "never lingers
    // in CREATED"). target stores newPeriodStart/newPeriodEnd (existing
    // Mixed field, same pattern every other CommercialTransaction call site
    // already uses to store flow-specific data — no schema change) so a
    // resumed run can recover the target period without depending on
    // Subscription's own (mutable) currentPeriodEnd.
    commercialTransaction = await CommercialTransaction.create({
      organization: subscription.organization,
      subscription: subscription._id,
      type: 'RENEWAL',
      status: 'PRICED',
      target: { billingInvoice: billingInvoice._id, total: invoice.total, newPeriodStart, newPeriodEnd },
      latestInvoice: billingInvoice._id,
    });

    // Link BillingInvoice -> CommercialTransaction now that both exist (the
    // field was on the schema since Phase 1 but never populated for any
    // invoice yet — signup's BillingInvoice write predates
    // CommercialTransaction existing at all, so this is the first time this
    // link is ever set).
    billingInvoice.commercialTransaction = commercialTransaction._id;
    await billingInvoice.save();
  }

  // Step 4 — charge exactly once. Marker: commercialTransaction.status ===
  // 'COMMITTED' means the charge already succeeded on a prior attempt — do
  // NOT call chargeMandateFn again. This is the entire point of this slice.
  if (commercialTransaction.status !== 'COMMITTED') {
    // R11/R12 — charge the mandate. Injected so this slice's tests don't
    // touch real Razorpay; the real charge call is whichever session wires
    // actual Charge-at-Will invocation (already-proven pattern per R11's own
    // explicit non-goal — not redesigned here).
    let chargeResult;
    try {
      chargeResult = await chargeMandateFn({
        subscription,
        amount: billingInvoice.total,
      });
    } catch (chargeErr) {
      // R7's "Unknown -> Reconciliation Queue" branch — not implemented in
      // this slice (happy-path only). Thrown explicitly, not returned as a
      // structured result, so it's unambiguous in review that this is
      // stubbed, not a real modeled outcome.
      return reconciliationNeededNotImplemented(chargeErr);
    }

    if (!chargeResult?.success) {
      // R12's real failure/past_due branch — not implemented in this slice.
      return pastDueNotImplemented();
    }

    // Record charge success immediately, atomically, in its own write — this
    // is the durable marker every future retry checks before charging again.
    // Residual gap, stated precisely rather than overclaimed: if THIS exact
    // write fails (the charge succeeded but this save throws before
    // committing), there is still no durable record of the charge on a
    // retry — no application-level check can close that specific instant
    // without an independent confirmation channel (Razorpay's own webhook,
    // R7's reconciliation branch), which real charging + reconciliation would
    // provide and this slice's injected chargeMandateFn does not model. Every
    // failure window AFTER this write succeeds is fully covered below.
    commercialTransaction.status = 'COMMITTED';
    commercialTransaction.lastAttemptAt = new Date();
    commercialTransaction.target = {
      ...commercialTransaction.target,
      paymentId: chargeResult.paymentId,
      orderId: chargeResult.orderId,
    };
    await commercialTransaction.save();
    if (_injectFailureAfter === 'CHARGE_COMMITTED') {
      throw new Error('TEST-INJECTED FAILURE after CHARGE_COMMITTED');
    }
  }

  // Step 5 — invoice marked paid? Marker: billingInvoice.status === 'PAID'.
  if (billingInvoice.status !== 'PAID') {
    billingInvoice.status = 'PAID';
    billingInvoice.paidAt = new Date();
    billingInvoice.razorpay = {
      ...billingInvoice.razorpay,
      paymentId: commercialTransaction.target.paymentId,
      orderId: commercialTransaction.target.orderId,
    };
    await billingInvoice.save();
    if (_injectFailureAfter === 'INVOICE_PAID') {
      throw new Error('TEST-INJECTED FAILURE after INVOICE_PAID');
    }
  }

  // Step 6 — Subscription already advanced for this specific renewal?
  // Marker: currentPeriodStart already equals the target period's start
  // (captured in commercialTransaction.target before charging, not
  // recomputed from Subscription's own mutable fields).
  if (subscription.currentPeriodStart?.getTime() !== newPeriodStart.getTime()) {
    subscription.currentPeriodStart = newPeriodStart;
    subscription.currentPeriodEnd = newPeriodEnd;
    subscription.nextBillingDate = newPeriodEnd;
    await subscription.save();
    if (_injectFailureAfter === 'SUBSCRIPTION_ADVANCED') {
      throw new Error('TEST-INJECTED FAILURE after SUBSCRIPTION_ADVANCED');
    }
  }

  // Step 7 — BillingCycle already written? Marker: a BillingCycle exists for
  // this subscription+invoice pair. Schema needed no field additions,
  // confirmed by reading models/BillingCycle.js: subscription/periodStart/
  // periodEnd/invoice/status are exactly what's available and needed here.
  let billingCycle = await BillingCycle.findOne({
    subscription: subscription._id,
    invoice: billingInvoice._id,
  });
  if (!billingCycle) {
    billingCycle = await BillingCycle.create({
      subscription: subscription._id,
      periodStart: newPeriodStart,
      periodEnd: newPeriodEnd,
      invoice: billingInvoice._id,
      status: billingInvoice.status,
    });
  }

  // Step 8 — transaction completed? Marker: status === 'COMPLETED'.
  if (commercialTransaction.status !== 'COMPLETED') {
    commercialTransaction.status = 'COMPLETED';
    await commercialTransaction.save();
  }

  // No ScheduledChange to mark EXECUTED in this slice (precondition: zero
  // PENDING records) — ScheduledChange.updateMany is intentionally not called
  // here; a later slice's job once ScheduledChange application is real.
  void ScheduledChange; // referenced only to make the "not used yet" explicit, not a silent unused import

  return { outcome: 'RENEWED', invoice: billingInvoice._id, billingCycle: billingCycle._id };
}

function computeNextPeriodEnd(subscription) {
  const start = new Date(subscription.currentPeriodEnd);
  const next = new Date(start);
  if (subscription.billingCycle === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

// The three non-happy-path outcomes from the Phase 4B design sketch —
// deliberately stubbed as explicit throws, not partially-implemented return
// values, so it's unambiguous in code review what's real vs. deferred in this
// slice (per this slice's own Step 4).
function skippedNotImplemented() {
  throw new Error('SKIPPED branch (R1/R2 not-due/not-renewable) not implemented in this slice — Renewal Happy Path v1 is happy-path-only, per IMPLEMENTATION_PLAN_V1.md Phase 4B Slice 1. Caller must only invoke renewSubscription() for a subscription already confirmed due, renewable, and mandate-bearing.');
}

function reconciliationNeededNotImplemented(err) {
  throw new Error(`RECONCILIATION_NEEDED branch (R7 ambiguous-charge-result) not implemented in this slice — Renewal Happy Path v1 is happy-path-only. Underlying error: ${err?.message}`);
}

function pastDueNotImplemented() {
  throw new Error('PAST_DUE branch (R12 charge-failure) not implemented in this slice — Renewal Happy Path v1 is happy-path-only, per IMPLEMENTATION_PLAN_V1.md Phase 4B Slice 1.');
}

module.exports = { renewSubscription };
