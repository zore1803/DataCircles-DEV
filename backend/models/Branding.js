const mongoose = require('mongoose');

const brandingSchema = new mongoose.Schema({
  companyName: String,
  gstin: String,
  address: String,
  email: String,
  mobile: String,
  logoUrl: String,
  signatureUrl: String,
  colors: {
    primary: String,
    secondary: String,
  },
  organization: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization', 
    required: true 
  }
}, { timestamps: true });

// Index for better query performance
brandingSchema.index({ organization: 1, updatedAt: -1 });

module.exports = mongoose.model('Branding', brandingSchema);