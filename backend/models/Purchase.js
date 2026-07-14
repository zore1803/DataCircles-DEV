const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
    variantId: { type: mongoose.Schema.Types.ObjectId },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, min: 0 }, // per item total (quantity * unitPrice)
    sku: { type: String },
    variantAttributes: { type: Map, of: String },
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      default: null,
    },
    purchaseNumber: { type: String, required: true },
    purchaseDate: { type: Date, default: Date.now },
    items: [purchaseItemSchema],
    subtotal: { type: Number, default: 0, min: 0 }, // sum of item totals before tax
    transactionType: {
      type: String,
      enum: ["intra", "inter"],
      default: "intra",
    },
    gstRate: { type: Number, default: 0, min: 0 },
    totalTax: { type: Number, default: 0, min: 0 }, // CGST + SGST or IGST
    grandTotal: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["Draft", "Pending", "Received", "Partial", "Cancelled"],
      default: "Draft",
    },
    notes: { type: String, default: "" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes
purchaseSchema.index({ organization: 1, createdAt: -1 });
purchaseSchema.index({ organization: 1, status: 1 });
purchaseSchema.index({ vendor: 1, organization: 1 });

module.exports = mongoose.model("Purchase", purchaseSchema);
