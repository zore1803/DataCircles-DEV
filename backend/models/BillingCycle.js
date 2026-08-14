// models/BillingCycle.js
//
// Phase 1 — schema only. Per IMPLEMENTATION_PLAN_V1.md §1.6 / BILLING_DOMAIN_SPECIFICATION.md
// Chapter 18/20: a thin object whose own existence is authoritative but whose
// `status` field is explicitly not — it mirrors BillingInvoice.status and must
// never be written independently.
//
// NOT READ OR WRITTEN BY ANY CONTROLLER YET. This collection is inert until
// later phases (see IMPLEMENTATION_PLAN_V1.md Part 3's write-boundary invariant).
const mongoose = require('mongoose');

const billingCycleSchema = new mongoose.Schema({
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'BillingInvoice' },
  // Derived/mirrored from invoice.status at read time — never written independently.
  status: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('BillingCycle', billingCycleSchema);
