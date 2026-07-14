// models/BillingEvent.js
//
// Immutable, append-only log of everything that happens to a subscription's
// billing. Each event freezes its own before/after snapshot at the moment it
// occurred, so the Billing Center timeline RENDERS history rather than
// reconstructing it by diffing subscriptions/payments/coupons later. New
// event types (referral credits, wallet, refunds, manual adjustments) just
// add to `eventType` — the timeline absorbs them with no schema redesign.
//
// Nothing here drives billing behavior. Emitting an event must never affect
// the actual charge — see utils/billingEvents.emitBillingEvent, which is
// fire-and-forget and swallows its own errors so a logging failure can never
// break a payment flow.
const mongoose = require('mongoose');

// Frozen copy of the billing-relevant subscription state. Mirrors the exact
// shapes already stored on Subscription (activeAddons, appliedCoupon) so there
// is no second snapshot format to keep in sync.
const snapshotSchema = new mongoose.Schema({
  planName: String,
  billingCycle: String,
  pricePerUser: Number,
  userCount: Number,
  totalAmount: Number, // recurring subtotal (pre-GST), i.e. what recurs
  activeAddons: [
    { addonKey: String, quantity: Number, pricePerUnit: Number },
  ],
  appliedCoupon: {
    code: String,
    name: String,
    discountAmount: Number,
  },
}, { _id: false });

const billingEventSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', index: true },

  eventType: {
    type: String,
    required: true,
    enum: [
      'SUBSCRIPTION_CREATED',
      'TRIAL_STARTED',
      'TRIAL_ENDED',
      'PLAN_UPGRADE',
      'PLAN_DOWNGRADE',
      'DOWNGRADE_SCHEDULED',
      'BILLING_CYCLE_CHANGE_SCHEDULED',
      'SCHEDULE_CANCELLED',
      'ADDON_ADDED',
      'ADDON_REMOVAL_SCHEDULED',
      'ADDON_REMOVED',
      'COUPON_APPLIED',
      'COUPON_CHANGED',
      'COUPON_REMOVED',
      'PAYMENT_SUCCESS',
      'PAYMENT_FAILED',
      'RENEWAL',
      'SUBSCRIPTION_CANCELLED',
      'REFUND',
      'CREDIT_APPLIED',
      'ADMIN_ADJUSTMENT',
      // Referral system — see backend/docs/REFERRAL_SYSTEM_DESIGN.md §17
      'REFERRAL_RECORDED',
      'REFERRAL_REWARD_EARNED',
      'REFERRAL_REWARD_RESERVED',
      'REFERRAL_REWARD_RELEASED',
      'REFERRAL_REWARD_CONSUMED',
      'REFERRAL_REWARD_REVOKED',
      'REFERRAL_REWARD_EXPIRED',
      'REFERRAL_DISABLED',
    ],
    index: true,
  },

  occurredAt: { type: Date, default: Date.now },
  // For scheduled changes this is when the change actually takes/took effect
  // (cycle end); for immediate changes it equals occurredAt.
  effectiveAt: { type: Date },

  status: {
    type: String,
    enum: ['completed', 'scheduled', 'failed', 'cancelled'],
    default: 'completed',
  },

  beforeSnapshot: snapshotSchema,
  afterSnapshot: snapshotSchema,

  // Human-readable description computed ONCE at write time (see
  // utils/billingEvents.buildEventSummary), not derived by the frontend from
  // raw snapshots. Keeps "what changed" business logic in one backend place;
  // the Timeline UI just renders these strings.
  summary: {
    title: String,      // "Upgraded to Business"
    subtitle: String,   // "Growth → Business"
    amountChange: String,  // "+₹200/month"
    detail: String,     // "₹42 paid today" / "Effective 7 Aug 2026" / etc.
  },

  // Money attached to THIS event. Any field may be absent (e.g. a scheduled
  // downgrade charges nothing now, so only recurringBefore/After are set).
  amounts: {
    base: Number,
    discount: Number,
    gst: Number,
    prorated: Number,
    paid: Number,
    recurringBefore: Number,
    recurringAfter: Number,
  },

  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPayment' },
  razorpay: {
    orderId: String,
    paymentId: String,
    subscriptionId: String,
  },

  // Free-form, per eventType (e.g. { addonKey, quantity } or { reason }).
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

billingEventSchema.index({ organization: 1, occurredAt: -1 });

module.exports = mongoose.model('BillingEvent', billingEventSchema);
