// models/ContactFields.js
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
  }], // For dropdown fields
  required: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true  // ✅ Track field creator
  },
  // 👉 ADDED: Which category this field belongs to by default
  category: { 
    type: String, 
    default: 'Uncategorized' 
  }
});

const contactFieldsSchema = new mongoose.Schema({
  // 👉 ADDED: The master list of categories for the whole organization
  fieldCategories: [{ type: String }],

  fields: [fieldSchema],
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true }
}, { timestamps: true });

// Create index for better query performance
contactFieldsSchema.index({ organization: 1, updatedAt: -1 });

module.exports = mongoose.model('ContactFields', contactFieldsSchema);