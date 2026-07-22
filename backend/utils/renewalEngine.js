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
 */
async function renewSubscription(subscription, { chargeMandateFn } = {}) {
  if (!subscription.mandateTokenId) {
    return skippedNotImplemented();
  }

  // R3 — build Effective Subscription. Trivial in this slice: this function's
  // precondition (enforced by the caller, not re-checked here) is zero
  // PENDING ScheduledChange records, so the Effective Subscription is simply
  // the current Subscription's own commercial fields. Real ScheduledChange
  // application is the next slice's work, not this one's.
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

  // R4-R9 — price via calculateInvoice(), no adjustmentContext (a renewal is a
  // fresh full-period charge, same shape as createSubscription's own call).
  const invoice = calculateInvoice({ subscription: effective, resolvedModifiers });

  // R10 — persist BillingInvoice as PENDING_PAYMENT before charging, same
  // additive, non-fatal pattern as BillingInvoice's signup rollout
  // (subscriptionController.js:~307) — but here a failure IS fatal to the
  // renewal (R13's commit needs a real invoice document to reference), unlike
  // Phase 2's signup concession, since this is new construction, not a
  // migration shadowing an already-authoritative legacy write.
  // commercialTransaction linked below, after CommercialTransaction is created —
  // BillingInvoice is created first (CommercialTransaction.target references
  // its _id), so the link is set via a second write once both ids exist.
  const billingInvoice = await BillingInvoice.create({
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

  // CommercialTransaction{type:'RENEWAL'} — CREATED/PRICED collapsed into one
  // write (mirrors the add-on-purchase/upgrade pattern: "never lingers in
  // CREATED", a request that reaches this point has already priced cleanly).
  let commercialTransaction;
  try {
    commercialTransaction = await CommercialTransaction.create({
      organization: subscription.organization,
      subscription: subscription._id,
      type: 'RENEWAL',
      status: 'PRICED',
      target: { billingInvoice: billingInvoice._id, total: invoice.total },
      latestInvoice: billingInvoice._id,
    });
  } catch (ctErr) {
    console.error(
      `CommercialTransaction creation failed (non-fatal) — organization=${subscription.organization} subscription=${subscription._id}:`,
      ctErr.message
    );
  }

  // Link BillingInvoice -> CommercialTransaction now that both exist (the
  // field was on the schema since Phase 1 but never populated for any invoice
  // yet — signup's BillingInvoice write predates CommercialTransaction
  // existing at all, so this is the first time this link is ever set).
  if (commercialTransaction) {
    try {
      billingInvoice.commercialTransaction = commercialTransaction._id;
      await billingInvoice.save();
    } catch (biErr) {
      console.error(
        `BillingInvoice.commercialTransaction link failed (non-fatal) — organization=${subscription.organization} subscription=${subscription._id}:`,
        biErr.message
      );
    }
  }

  // R11/R12 — charge the mandate. Injected so this slice's tests don't touch
  // real Razorpay; the real charge call is whichever session wires actual
  // Charge-at-Will invocation (already-proven pattern per R11's own
  // explicit non-goal — not redesigned here).
  let chargeResult;
  try {
    chargeResult = await chargeMandateFn({
      subscription,
      amount: invoice.total,
    });
  } catch (chargeErr) {
    // R7's "Unknown -> Reconciliation Queue" branch — not implemented in this
    // slice (happy-path only). Thrown explicitly, not returned as a
    // structured result, so it's unambiguous in review that this is stubbed,
    // not a real modeled outcome.
    return reconciliationNeededNotImplemented(chargeErr);
  }

  if (!chargeResult?.success) {
    // R12's real failure/past_due branch — not implemented in this slice.
    return pastDueNotImplemented();
  }

  // R13 — commit, one sequence, each step this slice's minimal version of
  // "idempotent-checked" (real R13.5 idempotent-repair-forward is deferred).
  if (commercialTransaction) {
    try {
      commercialTransaction.status = 'COMMITTED';
      commercialTransaction.lastAttemptAt = new Date();
      await commercialTransaction.save();
    } catch (ctErr) {
      console.error(
        `CommercialTransaction COMMITTED update failed (non-fatal) — organization=${subscription.organization} subscription=${subscription._id} transaction=${commercialTransaction._id}:`,
        ctErr.message
      );
    }
  }

  billingInvoice.status = 'PAID';
  billingInvoice.paidAt = new Date();
  billingInvoice.razorpay = { ...billingInvoice.razorpay, paymentId: chargeResult.paymentId, orderId: chargeResult.orderId };
  await billingInvoice.save();

  // R13's own first bullet — "Effective Subscription becomes the real
  // Subscription... advance Billing Cycle" — advancing the Subscription's own
  // period is a distinct step from writing BillingCycle, and was missing from
  // the first pass of this slice (caught on review, not shipped silently).
  // Trivial in this slice specifically because Effective Subscription equals
  // current Subscription (zero pending changes) — nothing beyond the period
  // dates actually needs to change here; a slice that applies ScheduledChange
  // would also write planName/activeAddons/etc. at this same point.
  const newPeriodStart = subscription.currentPeriodEnd;
  const newPeriodEnd = computeNextPeriodEnd(subscription);
  subscription.currentPeriodStart = newPeriodStart;
  subscription.currentPeriodEnd = newPeriodEnd;
  subscription.nextBillingDate = newPeriodEnd;
  await subscription.save();

  // First-ever BillingCycle write (Step 2 of this slice's brief) — schema
  // needed no field additions, confirmed by reading models/BillingCycle.js
  // before this write: subscription/periodStart/periodEnd/invoice/status are
  // exactly what's available and needed here. Uses the same newPeriodStart/
  // newPeriodEnd just written to the Subscription, not a second computation —
  // one date pair, two places it's recorded, not two independently-derived
  // values that could drift apart. status set once at creation, mirroring
  // billingInvoice.status per the model's own header comment ("mirrors
  // BillingInvoice.status... never written independently" — this slice does
  // not yet implement live mirroring on later invoice changes, since nothing
  // changes billingInvoice.status after this point in the happy path).
  const billingCycle = await BillingCycle.create({
    subscription: subscription._id,
    periodStart: newPeriodStart,
    periodEnd: newPeriodEnd,
    invoice: billingInvoice._id,
    status: billingInvoice.status,
  });

  if (commercialTransaction) {
    try {
      commercialTransaction.status = 'COMPLETED';
      await commercialTransaction.save();
    } catch (ctErr) {
      console.error(
        `CommercialTransaction COMPLETED update failed (non-fatal) — organization=${subscription.organization} subscription=${subscription._id} transaction=${commercialTransaction._id}:`,
        ctErr.message
      );
    }
  }

  // No ScheduledChange to mark EXECUTED in this slice (precondition: zero
  // PENDING records) — ScheduledChange.updateMany is intentionally not called
  // here; the next slice's job once ScheduledChange application is real.
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
