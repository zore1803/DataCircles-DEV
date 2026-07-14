const mongoose = require("mongoose");

const purchaseOrderSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
  poNumber: { type: String, required: true },
  orderDate: { type: Date, default: Date.now },
  items: [
    {
      itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
      variantId: { type: mongoose.Schema.Types.ObjectId },
      name: { type: String, required: true },
      quantity: { type: Number, required: true },
      unitPrice: { type: Number, required: true },
      total: { type: Number, required: true },
      sku: { type: String },
      variantAttributes: { type: Map, of: String },
    }
  ],
  totalAmount: { type: Number, required: true },
  paymentTerms: { type: String, default: "Net 30" },
  status: { type: String, enum: ["Pending", "Approved", "Rejected", "Delivered"], default: "Pending" },
  notes: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true }
}, { timestamps: true });

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
