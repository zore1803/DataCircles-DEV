// models/ItemFields.js
//
// Org-level definitions of the custom fields shown on the Item (Products &
// Services) form. Mirrors VendorFields/DealFields/CompanyFields/ContactFields
// exactly so the settings UI, limit checks and form rendering all behave the
// same way across every module.
const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['string', 'number', 'dropdown', 'text', 'url', 'date', 'multiselect'],
    required: true,
    default: 'text'
  },
  options: [{
    type: String
  }], // For dropdown and multiselect fields
  required: {
    type: Boolean,
    default: false
  },
  // Which category this field belongs to by default
  category: {
    type: String,
    default: 'Uncategorized'
  },
  // Tracked so per-user custom-field plan limits can be counted
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

const itemFieldsSchema = new mongoose.Schema({
  // The master list of categories for the whole organization
  fieldCategories: [{ type: String }],

  fields: [fieldSchema],
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true }
}, { timestamps: true });

// Create index for better query performance
itemFieldsSchema.index({ organization: 1, updatedAt: -1 });
itemFieldsSchema.index({ organization: 1, user: 1 });

module.exports = mongoose.model('ItemFields', itemFieldsSchema);
