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

// Same class of race as CommercialTransaction's own index
// (models/CommercialTransaction.js): the cancel-prior-then-create sequence
// in updateSubscription/cancelSubscription enforces "at most one PENDING
// record of this type per subscription" only as application logic today —
// safe only because pendingUpdate is a single overwritten object
// underneath. Once the read side (renewalEngine.js) makes ScheduledChange
// authoritative, that legacy backstop disappears, so this index is added
// now, not deferred.
//
// Three separate equality-filtered partial indexes, not one $in-based
// index — MongoDB's partialFilterExpression only supports
// equality/$exists/$gt(e)/$lt(e)/$type/$and, not $in. REMOVE_ADDON is
// deliberately excluded: it legitimately supports multiple coexisting
// PENDING records (one per addonKey), confirmed by scheduleAddonRemoval's
// own merge-not-replace behavior — constraining it here would break that.
// Explicit distinct `name` on each is required, not cosmetic: all three share
// the key shape {subscription:1}, so MongoDB's auto-generated name
// ("subscription_1") collides across them and only the first one actually
// gets created — the other two silently fail to build (IndexKeySpecsConflict)
// without ever throwing into normal server startup. Confirmed by reproducing
// against a real database: only the PLAN_CHANGE index existed until these
// names were added.
['PLAN_CHANGE', 'BILLING_CYCLE_CHANGE', 'CANCELLATION'].forEach((t) => {
  scheduledChangeSchema.index(
    { subscription: 1 },
    {
      unique: true,
      partialFilterExpression: { status: 'PENDING', type: t },
      name: `scheduledchange_pending_unique_${t.toLowerCase()}`,
    }
  );
});

module.exports = mongoose.model('ScheduledChange', scheduledChangeSchema);
