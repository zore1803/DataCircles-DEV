const mongoose = require('mongoose');

const planConfigSchema = new mongoose.Schema({
  planId: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  monthlyPrice: { type: Number, required: true },
  yearlyPrice: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  razorpayPlanIds: {
    monthly: { type: String, required: true },
    yearly: { type: String, required: true },
  },
  features: {
    type: Object,
    required: true,
    default: {
      // recordsLimit REMOVED — replaced by individual per-module limits
      // below. If this field still exists on old documents, it is no
      // longer read anywhere in restrictByPlan.js and is safe to leave
      // or strip via the migration script.
      emailTemplates: 0,
      salesPipelines: 0,
      customFields: 0,
      recordTags: 0,
      websiteForms: 0,
      fileStorage: 0, // bytes, per user
      modules: {
        contacts: { read: false, write: false, limit: 0 },
        companies: { read: false, write: false, limit: 0 },
        deals: { read: false, write: false, limit: 0 },
        vendors: { read: false, write: false, limit: 0 },
        invoices: { read: false, write: false, limit: 0 }, // also covers proforma invoices, by design
        tasks: { read: false, write: false, limit: 0 },
        callLogs: { read: false, write: false, limit: 0 },
        meetings: { read: false, write: false, limit: 0 },
        quotations: { read: false, write: false, limit: 0 },
        'delivery-challans': { read: false, write: false, limit: 0 },
        purchases: { read: false, write: false, limit: 0 }, // also covers purchase orders, by design
        emails: { read: false, write: false, limit: 0 },
        folders: { read: false, write: false }, // NO limit field — Folder model has no organization field to count against
      },
      rottenDeals: false,
      advancedReports: false,
      includedSeats: 1,
      extraSeatPrice: {
        monthly: 0,
        yearly: 0,
      },
      extraSeatRazorpayPlanIds: {
        monthly: null,
        yearly: null,
      },
    },
  },
});

module.exports = mongoose.model('PlanConfig', planConfigSchema);