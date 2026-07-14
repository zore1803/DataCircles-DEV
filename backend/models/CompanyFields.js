const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['string', 'number', 'dropdown', 'text', 'url', 'date', 'multiselect'],
    required: true,
    default: 'text'
  },
  options: [{ type: String }],
  required: { type: Boolean, default: false },
  
  // ADDED: Which category this field belongs to by default
  category: { 
    type: String, 
    default: 'Uncategorized' 
  }
});

const companyFieldsSchema = new mongoose.Schema({
  // ADDED: The master list of categories for the whole organization
  fieldCategories: [{ type: String }], 
  
  fields: [fieldSchema],
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true }
}, { timestamps: true });

companyFieldsSchema.index({ organization: 1, updatedAt: -1 });

module.exports = mongoose.model('CompanyFields', companyFieldsSchema);