const mongoose = require('mongoose');

const additionalFieldSchema = new mongoose.Schema({
  key: { type: String, required: true }, // e.g., "Annual Revenue"
  value: mongoose.Schema.Types.Mixed,    // e.g., "250000000"
  type: { 
    type: String, 
    enum: ['string', 'number', 'dropdown', 'text', 'url', 'date', 'multiselect'],
    default: 'text'
  },
  // KEPT: This allows the frontend to easily group this specific data point
  category: { 
    type: String,
    default: 'Uncategorized'
  }
});

const socialMediaSchema = new mongoose.Schema({
  twitter: { type: String, default: '' },
  linkedin: { type: String, default: '' },
  facebook: { type: String, default: '' },
  whatsapp: { type: String, default: '' }
}, { _id: false });

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    industry: { type: String, required: true },
    gstin: {
      type: String,
    },
    address: String,
    website: String,
    profilePicture: String,
    socialMedia: {
      type: socialMediaSchema,
      default: () => ({}),
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    parentCompany: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
    subsidiaries: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
      },
    ],
    additionalFields: [additionalFieldSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model('Company', companySchema);