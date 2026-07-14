const mongoose = require('mongoose');

const industrySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false // default industries won't have an organization
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, { timestamps: true });

industrySchema.index({ organization: 1, name: 1 }, { unique: true, partialFilterExpression: { organization: { $exists: true } } });

module.exports = mongoose.model('Industry', industrySchema);
