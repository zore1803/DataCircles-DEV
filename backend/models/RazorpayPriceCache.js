const mongoose = require('mongoose');

const razorpayPriceCacheSchema = new mongoose.Schema(
  {
    amountPaise: { type: Number, required: true },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], required: true },
    razorpayPlanId: { type: String, required: true },
    lastUsedForOrganization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  },
  { timestamps: true }
);

razorpayPriceCacheSchema.index({ amountPaise: 1, billingCycle: 1 }, { unique: true });

module.exports = mongoose.model('RazorpayPriceCache', razorpayPriceCacheSchema);
