// models/CouponRedemption.js
//
// One row per successful redemption. This is the durable audit trail behind
// Coupon.analytics — kept separate so per-organization usage limits and
// historical reporting don't depend on recomputing from billing records.
const mongoose = require('mongoose');

const couponRedemptionSchema = new mongoose.Schema({
  coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true, index: true },
  couponCode: { type: String, required: true }, // denormalized for cheap reporting even if the coupon is later deleted
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },

  // What the discount was applied against.
  context: {
    planId: String,
    billingCycle: String,
    checkoutType: { type: String, enum: ['new_subscription', 'addon_purchase', 'plan_upgrade'] },
  },

  baseAmount: { type: Number, required: true }, // pre-discount, pre-GST
  discountAmount: { type: Number, required: true },
  finalAmount: { type: Number, required: true }, // post-discount, pre-GST

  redeemedAt: { type: Date, default: Date.now },
}, { timestamps: true });

couponRedemptionSchema.index({ coupon: 1, organization: 1 });

module.exports = mongoose.model('CouponRedemption', couponRedemptionSchema);
