const mongoose = require('mongoose');

const planAddonSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    displayName: { type: String, required: true },
    description: { type: String, default: '' },
    pricingType: { type: String, enum: ['quantity', 'boolean'], required: true },
    price: {
      monthly: { type: Number, default: 0 },
      yearly: { type: Number, default: 0 },
    },
    effectType: {
      type: String,
      enum: ['limit_boost', 'module_unlock', 'flag_only'],
      required: true,
    },
    targetKey: { type: String, default: null },
    incrementPerUnit: { type: Number, default: 0 },
    unlockRead: { type: Boolean, default: true },
    unlockWrite: { type: Boolean, default: true },
    availableOnPlans: [{ type: String }],
    isActive: { type: Boolean, default: false },
    maxQuantityPerOrg: { type: Number, default: null },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlanAddon', planAddonSchema);
