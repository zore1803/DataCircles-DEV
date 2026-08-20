// models/PurchaseReturn.js
//
// Goods sent back to a vendor, optionally against a specific Purchase bill.
// Deliberately mirrors models/Purchase.js's shape (same item sub-schema,
// same subtotal/tax/grandTotal math, same numbering scheme) so the two
// modules stay easy to reason about side by side — see purchaseController.js
// for the pattern this was cloned from.
const mongoose = require("mongoose");

const purchaseReturnItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
    variantId: { type: mongoose.Schema.Types.ObjectId },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, min: 0 }, // quantity * unitPrice
    sku: { type: String },
  },
  { _id: false }
);

const purchaseReturnSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    // The bill being returned against — optional, since a return can also be
    // recorded standalone (e.g. the original Purchase predates this feature).
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", default: null },

    returnNumber: { type: String, required: true },
    returnDate: { type: Date, default: Date.now },

    items: [purchaseReturnItemSchema],
    subtotal: { type: Number, default: 0, min: 0 },
    transactionType: { type: String, enum: ["intra", "inter"], default: "intra" },
    gstRate: { type: Number, default: 0, min: 0 },
    totalTax: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ["Draft", "Pending", "Paid", "Cancelled"],
      default: "Draft",
    },
    // How the refund from the vendor was/will be settled — a single field
    // (not a payments sub-array like Purchase.payments) since a return is
    // one settlement, not an installment plan.
    mode: {
      type: String,
      enum: ["", "Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Other"],
      default: "",
    },
    reason: { type: String, default: "" },
    notes: { type: String, default: "" },

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  },
  { timestamps: true }
);

purchaseReturnSchema.index({ organization: 1, createdAt: -1 });
purchaseReturnSchema.index({ organization: 1, status: 1 });
purchaseReturnSchema.index({ vendor: 1, organization: 1 });
purchaseReturnSchema.index({ purchase: 1, organization: 1 });

module.exports = mongoose.model("PurchaseReturn", purchaseReturnSchema);
