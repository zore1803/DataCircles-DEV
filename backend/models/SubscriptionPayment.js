const mongoose = require('mongoose');

const subscriptionPaymentSchema = new mongoose.Schema({
  organization: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization', 
    required: true 
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },
  // Phase 1 — schema only, nullable, unused until Phase 3 wires
  // CommercialTransaction/BillingInvoice into the payment flow (see
  // IMPLEMENTATION_PLAN_V1.md §1.5). Which specific invoice this payment was
  // charged against, once BillingInvoice exists as its own collection.
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'BillingInvoice' },
  razorpayPaymentId: { type: String, unique: true },
  razorpayOrderId: { type: String },
  razorpaySignature: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { 
    type: String, 
    enum: ['created', 'authorized', 'captured', 'refunded', 'failed'], 
    default: 'created' 
  },
  method: { type: String }, // card, netbanking, wallet, upi
  paymentFor: { 
    type: String, 
    enum: ['subscription', 'upgrade', 'additional_users','initial', 'upgrade_proration', 'seat_addition', 'addon_purchase', 'plan_upgrade'],
    default: 'subscription' 
  },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

// subscriptionPaymentSchema.index({ organization: 1 });
// subscriptionPaymentSchema.index({ razorpayPaymentId: 1 });

module.exports = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);
