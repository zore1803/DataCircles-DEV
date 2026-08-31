// models/MeetingFields.js
//
// Custom-field DEFINITIONS for Meeting — same shape as VendorFields.js/
// DealFields.js/ContactFields.js/CompanyFields.js. One doc per organization
// holds the org's field catalog (name/type/options/category); actual VALUES
// live per-document on Meeting.additionalFields (see models/Meeting.js).
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
  category: {
    type: String,
    default: 'Uncategorized'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const meetingFieldsSchema = new mongoose.Schema({
  fieldCategories: [{ type: String }],
  fields: [fieldSchema],
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true }
}, { timestamps: true });

meetingFieldsSchema.index({ organization: 1, updatedAt: -1 });
meetingFieldsSchema.index({ organization: 1, user: 1 });

module.exports = mongoose.model('MeetingFields', meetingFieldsSchema);
