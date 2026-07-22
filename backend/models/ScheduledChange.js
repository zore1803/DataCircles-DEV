// models/ScheduledChange.js
//
// Phase 1 — schema only. Per IMPLEMENTATION_PLAN_V1.md §1.2 / BILLING_DOMAIN_SPECIFICATION.md
// Chapter 16: the single unified object replacing the five previously-separate
// "pending X" mechanisms on Subscription (pendingUpdate, pendingAddonAddition,
// pendingPlanChange's scheduling half, pendingAddonRemovals). Nothing in the
// system becomes pending — pending work is represented entirely by a
// ScheduledChange record.
//
// Phase 4 (write-alongside): additive writes only, at the sites documented in
// IMPLEMENTATION_PLAN_V1.md's Phase 4 implementation subsection. NOT READ BACK
// BY ANYTHING YET — no controller, job, or endpoint queries this collection.
// The legacy pendingUpdate/pendingAddonRemovals fields on Subscription remain
// the sole authoritative runtime source until the Renewal Engine (Phase 5)
// becomes the first reader.
const mongoose = require('mongoose');

const scheduledChangeSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
  type: {
    type: String,
    enum: ['PLAN_CHANGE', 'BILLING_CYCLE_CHANGE', 'REMOVE_ADDON', 'REDUCE_QUANTITY', 'CANCELLATION'],
    required: true,
  },
  status: { type: String, enum: ['PENDING', 'EXECUTED', 'CANCELLED'], default: 'PENDING' },
  reason: { type: String }, // e.g. "Customer Request", "Superseded", "Subscription Cancelled"
  effectiveAt: { type: Date, required: true },
  payload: { type: mongoose.Schema.Types.Mixed }, // type-specific: target plan, addon key, quantity delta, etc.
  commercialTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'CommercialTransaction' },
}, { timestamps: true });

module.exports = mongoose.model('ScheduledChange', scheduledChangeSchema);
