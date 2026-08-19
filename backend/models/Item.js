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

// Values for the org-defined custom fields configured in ItemFields.
// Same shape the other modules use for their additionalFields.
const additionalFieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  value: mongoose.Schema.Types.Mixed, // Can store string, number, or any value
  type: {
    type: String,
    enum: ['string', 'number', 'dropdown', 'text', 'url', 'date', 'multiselect'],
    default: 'text'
  },
  category: {
    type: String,
    default: 'Uncategorized'
  }
});

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

  // Default discount applied when this product is added to a document
  // (invoice/quotation/etc.) — a starting point the user can still change
  // on that specific document, not a forced discount.
  discount: {
    type: {
      type: String,
      enum: ['percentage', 'amount'],
      default: 'percentage',
    },
    value: { type: Number, default: 0, min: 0 },
  },
  // Upper bound on how much discount a user can apply to this product on a
  // document (always a percentage, regardless of the discount type above —
  // e.g. max 10% even if the applied discount is entered as a flat amount).
  // null/undefined = no limit.
  maxDiscountPercent: { type: Number, default: null, min: 0, max: 100 },

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

  // Org-defined custom field values (definitions live in ItemFields)
  additionalFields: [additionalFieldSchema],

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