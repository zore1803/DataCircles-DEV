// models/BillingInvoice.js
//
// Phase 1 — schema only. Per IMPLEMENTATION_PLAN_V1.md §1.4 / BILLING_DOMAIN_SPECIFICATION.md
// Chapter 20: the first persisted invoice document for subscription billing —
// today utils/pricingEngine.buildPricingSnapshot / utils/invoiceEngine.calculateInvoice
// compute a price on demand and nothing is written to a collection.
//
// Named `BillingInvoice`, not `Invoice`, specifically to avoid collision with
// the existing backend/models/Invoice.js, which is an unrelated CRM
// sales-invoicing feature (deal/invoiceNumber/gstRate/items — no subscription
// or Razorpay fields at all) and must not be reused or confused with this one.
//
// NOT READ OR WRITTEN BY ANY CONTROLLER YET. This collection is inert until
// Phase 2 (see IMPLEMENTATION_PLAN_V1.md Part 3's write-boundary invariant).
//
// Acceptance criterion this model exists to enforce structurally (BUG-022 /
// the GST duplication finding, §1.4): every invoice — signup, upgrade,
// add-on purchase, renewal, retry, manual reactivation — must be produced
// exclusively through calculateInvoice(), with the full modifier set
// (coupon + referral) resolved fresh every time. No caller may compute or
// recompute a total independently; GST must be read from this document's
// `gst` field everywhere, backend or frontend, never recomputed at any other
// call site.
const mongoose = require('mongoose');

const billingInvoiceSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
  commercialTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'CommercialTransaction' },
  reason: {
    type: String,
    enum: [
      'NEW_SUBSCRIPTION', 'RENEWAL', 'PLAN_UPGRADE', 'ADDON_PURCHASE',
      'BILLING_CYCLE_CHANGE', 'RETRY', 'ADMIN_ADJUSTMENT', 'CORRECTION',
      'ADDON_RENEWAL', // Task 1 (Aug 2026) — independent per-add-on monthly renewal
    ],
    required: true,
  },
  lineItems: [
    {
      type: { type: String },
      key: String,
      amount: Number,
      quantity: Number,
    },
  ],
  subtotal: { type: Number },
  discount: { type: Number },
  taxable: { type: Number },
  gst: { type: Number },
  total: { type: Number },
  status: { type: String, enum: ['PENDING_PAYMENT', 'PAID', 'FAILED', 'VOID'], default: 'PENDING_PAYMENT' },
  // Correlation identifiers, added cheaply now (Phase 2) rather than migrated
  // onto historical invoices later once Phase 3 needs them. Only whichever of
  // these exists at the invoice's own creation time is populated — e.g.
  // registrationLinkId at signup (mandate not yet confirmed), orderId/
  // paymentId once a later phase's caller has them.
  razorpay: {
    registrationLinkId: { type: String },
    orderId: { type: String },
    paymentId: { type: String },
  },
  generatedAt: { type: Date, default: Date.now },
  paidAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('BillingInvoice', billingInvoiceSchema);
