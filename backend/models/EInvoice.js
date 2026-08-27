// models/EInvoice.js
//
// Tracks the GST e-invoicing (IRN/QR generation) lifecycle for an existing
// Invoice — this is a portal-registration record, not a billing document
// itself, so it always references an Invoice rather than carrying its own
// items/totals (those live on Invoice; this just mirrors invoiceNumber,
// customer and amount for list-page display without a populate on every read).
const mongoose = require("mongoose");

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

    // Portal registration lifecycle: Pending (queued) -> Success (IRN issued)
    // -> Cancelled (IRN cancelled within the 24hr window). Failed is a
    // rejected submission that can be retried (re-submission creates a new
    // attempt rather than mutating this one, mirroring how the actual IRP
    // treats failed submissions as non-existent).
    status: {
      type: String,
      enum: ["Pending", "Success", "Failed", "Cancelled"],
      default: "Pending",
    },

    irn: { type: String, default: "" },
    ackNo: { type: String, default: "" },
    ackDate: { type: Date, default: null },
    qrCode: { type: String, default: "" },
    failureReason: { type: String, default: "" },

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  },
  { timestamps: true }
);

eInvoiceSchema.index({ organization: 1, createdAt: -1 });
eInvoiceSchema.index({ organization: 1, status: 1 });
eInvoiceSchema.index({ invoice: 1, organization: 1 });

module.exports = mongoose.model("EInvoice", eInvoiceSchema);
