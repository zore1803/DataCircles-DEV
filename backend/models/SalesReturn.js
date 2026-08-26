// models/SalesReturn.js
//
// Goods returned by a customer, always against a specific Invoice (see
// salesReturnController.createSalesReturn, which requires `invoice` and
// derives `customer`/`deal` from it). Mirrors PurchaseReturn's shape but
// inverted: Purchase Return sends goods OUT to a vendor, Sales Return
// brings goods IN from a customer — so its Confirmed stock effect uses
// baseDirection: "in" via inventorySync.syncDocumentStock.
const mongoose = require("mongoose");

const salesReturnItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
    // The specific variant subdocument id on the parent Item, when the
    // original invoice line was against a variant. Required for correct
    // per-variant stock IN on Confirm.
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    parentItemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", default: null },
    isVariant: { type: Boolean, default: false },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    hsn: { type: String, default: "" },
    // Historical values snapshotted from the original invoice line — the
    // Sales Return must preserve the transaction values from the Invoice,
    // not look them up live from the Product master.
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, default: 0, min: 0, max: 100 },
    taxInclusive: { type: Boolean, default: false },
    total: { type: Number, min: 0 },
    // Per-line reason so different lines in the same return can carry
    // different reasons (2 damaged + 1 wrong item, etc.).
    reason: {
      type: String,
      enum: ["", "Damaged", "Defective", "Wrong Item", "Wrong Size/Variant", "Customer Changed Mind", "Other"],
      default: "",
    },
  },
  { _id: false }
);

const salesReturnSchema = new mongoose.Schema(
  {
    // Auto-derived server-side from `invoice.deal` — never trusted from the
    // client so a return can't be attributed to the wrong customer.
    deal: { type: mongoose.Schema.Types.ObjectId, ref: "Deal", required: true },
    // The invoice being returned against. Required at the controller level;
    // schema-level default kept null-tolerant for safe reads on any legacy row.
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },

    returnNumber: { type: String, required: true },
    returnDate: { type: Date, default: Date.now },

    items: [salesReturnItemSchema],
    subtotal: { type: Number, default: 0, min: 0 },
    transactionType: { type: String, enum: ["intra", "inter"], default: "intra" },
    gstRate: { type: Number, default: 0, min: 0 },
    totalTax: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, default: 0, min: 0 },

    // Draft -> Pending -> Confirmed -> Refunded is the physical-goods
    // workflow. Confirmed is the single stock-moving event (goods actually
    // came back in). Refunded is a financial-settlement marker only — no
    // stock effect. Cancelled is only valid pre-Confirmed.
    status: {
      type: String,
      enum: ["Draft", "Pending", "Confirmed", "Refunded", "Cancelled"],
      default: "Draft",
    },
    // How the refund was/will be settled. Single field (not a payments array)
    // since a return is one settlement, not an installment plan.
    refundMode: {
      type: String,
      enum: ["", "Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Credit Note", "Other"],
      default: "",
    },
    refundReference: { type: String, default: "" },
    refundedAt: { type: Date, default: null },
    // Free-text document-level reason (independent of the per-line reason on
    // each items[i]).
    reason: { type: String, default: "" },
    notes: { type: String, default: "" },

    // Guards the inventory stock-in from double-applying — mirrors
    // PurchaseReturn.stockMovementStatus. "Confirmed" is terminal for the
    // stock event; reversal is via delete or an explicit cancel-with-reverse
    // pathway (see salesReturnController).
    stockMovementStatus: {
      type: String,
      enum: ["pending", "applied", "reversed"],
      default: "pending",
    },

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  },
  { timestamps: true }
);

salesReturnSchema.index({ organization: 1, createdAt: -1 });
salesReturnSchema.index({ organization: 1, status: 1 });
salesReturnSchema.index({ invoice: 1, organization: 1 });
salesReturnSchema.index({ deal: 1, organization: 1 });

module.exports = mongoose.model("SalesReturn", salesReturnSchema);
