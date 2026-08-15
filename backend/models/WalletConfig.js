// models/WalletConfig.js
const mongoose = require('mongoose');

// Singleton, Super-Admin editable. Two independent knobs:
//   creditValueInRupees ΓÇö what a customer pays per credit
//   usagePricing        ΓÇö how many credits a future feature consumes
const walletConfigSchema = new mongoose.Schema(
  {
    creditValueInRupees: { type: Number, required: true, default: 1 },
    defaultFreeCredits: { type: Number, required: true, default: 0 },
    gstRate: { type: Number, required: true, default: 18 },
    usagePricing: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WalletConfig', walletConfigSchema);
