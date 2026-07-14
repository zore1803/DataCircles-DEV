// models/dealSettings.model.js
const mongoose = require('mongoose');

const dealSettingsSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true,
  },
  staleDays: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DealSettings', dealSettingsSchema);
