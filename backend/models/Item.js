// models/Item.js
const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Red - XL" or "Monthly Plan"
  sku: { type: String, default: "" },      // unique SKU/barcode per variant
  attributes: {
    // flexible object for custom attributes like size/color
    type: Map,
    of: String
    // Example: { size: 'XL', color: 'Red' }
  },
  purchasePrice: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  stock: { type: Number, default: 0 }, // optional for product inventory
  isActive: { type: Boolean, default: true },
  gstRate: { type: Number, default: 0 } // GST rate for this variant
}, { _id: false }); // prevents auto _id for each variant

const itemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["product", "service"],
    required: true,
    default: "product"
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },

  // Pricing (default/base)
  purchasePrice: { type: Number, required: true, default: 0 },
  sellingPrice: { type: Number, required: true, default: 0 },
  taxInclusive: { type: Boolean, default: true },

  // GST/Tax
  gstRate: { type: Number, default: 0 }, // GST rate for the item (used for CGST/SGST/IGST calculation)

  // Identification
  hsnSac: { type: String, default: "" },
  barcode: { type: String, default: "" },
  category: { type: String, default: "" },

  // Units
  primaryUnit: { type: String, default: "OTH OTHERS" },

  // Media
  images: [{ type: String }],

  // Variants
  variants: [variantSchema],

  // System fields
  isActive: { type: Boolean, default: true },

  // User and Organization tracking
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true }
}, { timestamps: true });

// Indexes
itemSchema.index({ organization: 1, name: 1 });
itemSchema.index({ organization: 1, category: 1 });
itemSchema.index({ organization: 1, isActive: 1 });
itemSchema.index({ organization: 1, gstRate: 1 });

module.exports = mongoose.model("Item", itemSchema);