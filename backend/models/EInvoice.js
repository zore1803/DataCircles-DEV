// models/EInvoice.js
//
// Tracks the GST e-invoicing (IRN/QR generation) lifecycle for an existing
// Invoice — this is a portal-registration record, not a billing document
// itself, so it always references an Invoice rather than carrying its own
// items/totals (those live on Invoice; this mirrors invoiceNumber/customer/
// amount for list-page display without a populate on every read).
//
// Cardinality (chosen per Phase-plan option B):
//   Invoice 1───N EInvoice  (one row per generation ATTEMPT)
//   Invoice.latestEInvoice → EInvoice (pointer to the newest attempt)
// A retry after FAILED creates a NEW EInvoice row rather than mutating the
// old one, so every attempt is auditable. See services/eInvoiceService.js.
//
// TWO status fields intentionally:
//   * `lifecycleStatus`  — Phase-8 source of truth: NOT_GENERATED / PROCESSING
//                          / GENERATED / FAILED / CANCELLED. Written by the
//                          new service/provider flow only.
//   * `status`           — LEGACY vocabulary (Pending/Success/Failed/Cancelled).
//                          Read by the existing EInvoicing dashboard/manual
//                          tracking form. The new flow mirrors lifecycleStatus
//                          onto it so the dashboard keeps working unchanged.
// The mapping is one-way (lifecycle → legacy); nothing outside legacy code
// writes to `status` directly for auto-generated records.
const mongoose = require("mongoose");

// Phase-8 lifecycle → legacy status mirror. Kept next to the model so anyone
// touching either field sees both together.
const LIFECYCLE_TO_LEGACY = {
  NOT_GENERATED: "Pending",
  PROCESSING: "Pending",
  GENERATED: "Success",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const eInvoiceSchema = new mongoose.Schema(
  {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },
    deal: { type: mongoose.Schema.Types.ObjectId, ref: "Deal", default: null },

    invoiceNumber: { type: String, required: true },
    customer: {
      name: { type: String, default: "" },
      gstin: { type: String, default: "" },
    },
    amount: { type: Number, default: 0, min: 0 },
    date: { type: Date, default: Date.now },

    // ── Legacy status (kept for the manual-tracking EInvoicing dashboard) ─
    status: {
      type: String,
      enum: ["Pending", "Success", "Failed", "Cancelled"],
      default: "Pending",
    },

    // ── Phase-8 lifecycle (source of truth for auto-generated records) ───
    lifecycleStatus: {
      type: String,
      enum: ["NOT_GENERATED", "PROCESSING", "GENERATED", "FAILED", "CANCELLED"],
      default: "NOT_GENERATED",
    },

    // ── Provider bookkeeping ─────────────────────────────────────────────
    provider: { type: String, default: "" },              // e.g. "IRIS"
    environment: { type: String, default: "" },           // "SANDBOX" | "PRODUCTION"
    providerRequestId: { type: String, default: "" },     // for reconciliation/support

    // ── IRP response snapshot ────────────────────────────────────────────
    irn: { type: String, default: "" },
    ackNo: { type: String, default: "" },
    ackDate: { type: Date, default: null },
    // qrCode kept for legacy manual entries (a data-URL image, historically).
    qrCode: { type: String, default: "" },
    // signedInvoice / signedQRCode are the RAW strings the IRP returns —
    // preserved for PDF re-rendering, audits, and re-verification. Do NOT
    // overwrite these with a rasterised image; qrCode above is for that.
    signedInvoice: { type: String, default: "" },
    signedQRCode: { type: String, default: "" },

    // ── Frozen submission snapshot (Phase-6 immutability) ────────────────
    // The exact payload sent to IRP and the totals as computed at submit
    // time. Frozen here so a later invoice edit can't retroactively change
    // what was declared to the portal.
    payloadSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    totalsSnapshot: {
      taxableValue: { type: Number, default: 0 },
      cgst: { type: Number, default: 0 },
      sgst: { type: Number, default: 0 },
      igst: { type: Number, default: 0 },
      totalTax: { type: Number, default: 0 },
      grandTotal: { type: Number, default: 0 },
    },

    // ── Timestamps for the individual lifecycle events ───────────────────
    generatedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: "" },
    cancellationRemarks: { type: String, default: "" },

    // ── Failure detail (Phase-10) ────────────────────────────────────────
    failureCode: { type: String, default: "" },
    failureReason: { type: String, default: "" },

    // ── Attempt tracking (Phase-11 recovery + audit) ─────────────────────
    attemptNumber: { type: Number, default: 1 },
    previousAttempt: { type: mongoose.Schema.Types.ObjectId, ref: "EInvoice", default: null },

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  },
  { timestamps: true }
);

// Any change to lifecycleStatus mirrors onto the legacy status field so the
// existing EInvoicing dashboard reflects the new flow without code changes.
eInvoiceSchema.pre("save", function (next) {
  if (this.isModified("lifecycleStatus") && this.lifecycleStatus) {
    const legacy = LIFECYCLE_TO_LEGACY[this.lifecycleStatus];
    if (legacy) this.status = legacy;
  }
  next();
});

eInvoiceSchema.index({ organization: 1, createdAt: -1 });
eInvoiceSchema.index({ organization: 1, status: 1 });
eInvoiceSchema.index({ organization: 1, lifecycleStatus: 1 });
eInvoiceSchema.index({ invoice: 1, organization: 1 });
eInvoiceSchema.index({ invoice: 1, attemptNumber: -1 });

module.exports = mongoose.model("EInvoice", eInvoiceSchema);
module.exports.LIFECYCLE_TO_LEGACY = LIFECYCLE_TO_LEGACY;
