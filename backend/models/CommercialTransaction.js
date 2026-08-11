// models/CommercialTransaction.js
//
// Phase 1 — schema only. Per IMPLEMENTATION_PLAN_V1.md §1.3 / BILLING_DOMAIN_SPECIFICATION.md
// Chapter 15/18/20: the immutable record of business intent (not payment).
// Replaces the inline pendingUpgrade/pendingPlanChange/pendingAddonAddition
// sub-documents on Subscription, which conflate business intent with
// payment-execution bookkeeping on the Subscription document itself.
//
// NOT READ OR WRITTEN BY ANY CONTROLLER YET. This collection is inert until
// Phase 3 (see IMPLEMENTATION_PLAN_V1.md Part 3's write-boundary invariant).
// The legacy pendingUpgrade/pendingPlanChange/pendingAddonAddition fields on
// Subscription remain the sole source of truth until then.
const mongoose = require('mongoose');

const commercialTransactionSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
  type: {
    type: String,
    enum: [
      'NEW_PURCHASE', 'UPGRADE', 'DOWNGRADE', 'ADDON_PURCHASE', 'ADDON_REMOVAL',
      'BILLING_CYCLE_CHANGE', 'CANCELLATION', 'START_TRIAL', 'CORRECTION', 'RENEWAL',
      // Task 1 (Aug 2026) — independent per-add-on monthly renewal, separate
      // from the base subscription's own RENEWAL, for a monthly-cadence
      // add-on riding on an annual base plan. See utils/addonRenewalEngine.js.
      'ADDON_RENEWAL',
    ],
    required: true,
  },
  status: {
    type: String,
    enum: ['CREATED', 'PRICED', 'AWAITING_PAYMENT', 'FAILED', 'COMMITTED', 'COMPLETED', 'VOID'],
    default: 'CREATED',
  },
  reason: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // immutable once set
  target: { type: mongoose.Schema.Types.Mixed }, // immutable — the actual requested change
  attemptCount: { type: Number, default: 0 },
  latestInvoice: { type: mongoose.Schema.Types.ObjectId, ref: 'BillingInvoice' },
  latestPaymentAttempt: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPayment' },
  failureReason: { type: String },
  lastAttemptAt: { type: Date },
}, { timestamps: true });

// Same class of gap as BUG-002 (no unique index on Subscription.organization,
// "no findOne guaranteed exactly one document") — found by a review pass, not
// invented speculatively: the VOID-on-recycle + create() sequence in
// initiateAddonPurchase enforces "at most one non-terminal transaction per
// subscription+type" only as application logic (sequential await, no
// atomicity). Under a genuine race (two concurrent requests), both could
// pass the VOID step and both create a new document. This partial unique
// index makes that a hard DB-level impossibility instead of an assumption —
// matching every other "many historical, one current" invariant already
// enforced this way in this codebase (Subscription, RewardUsage).
commercialTransactionSchema.index(
  { subscription: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['CREATED', 'PRICED', 'AWAITING_PAYMENT', 'FAILED'] },
    },
  }
);

module.exports = mongoose.model('CommercialTransaction', commercialTransactionSchema);
