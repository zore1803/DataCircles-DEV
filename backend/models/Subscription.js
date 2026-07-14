// models/Subscription.js
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  organization: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization', 
    required: true,
    unique: true 
  },
  razorpaySubscriptionId: { type: String },
  razorpayPlanId: { type: String, required: true },
  planName: { 
    type: String, 
    enum: ['starter', 'growth', 'business','test'], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['created', 'authenticated', 'active', 'paused', 'halted', 'cancelled', 'completed', 'expired'], 
    default: 'created' 
  },

  // ============================================================
  // NEW: app-level status, separate from Razorpay's raw `status` above.
  // This is the field subscriptionGate.js and all access-control logic
  // should read — not `status`, which is just a passthrough of whatever
  // vocabulary Razorpay happens to use.
  // ============================================================
  appStatus: {
    type: String,
    enum: ['trial', 'active', 'past_due', 'cancelled', 'expired', 'suspended'],
    default: 'trial',
  },
  appStatusHistory: [
    {
      from: String,
      to: String,
      reason: String,
      at: Date,
    },
  ],

  billingCycle: { 
    type: String, 
    enum: ['monthly', 'yearly'], 
    required: true 
  },
  pricePerUser: { type: Number, required: true },
  userCount: { type: Number, required: true, min: 1 },
  totalAmount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  currentPeriodStart: { type: Date },
  currentPeriodEnd: { type: Date },
  nextBillingDate: { type: Date },
  trialStart: { type: Date },
  trialEnd: { type: Date },
  isTrialActive: { type: Boolean, default: false },
  trialUsed: { type: Boolean, default: false },
  trialReminder48hSent: { type: Boolean, default: false },
  trialReminder24hSent: { type: Boolean, default: false },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancelledAt: { type: Date },
  metadata: { type: mongoose.Schema.Types.Mixed },
  activeAddons: [
    {
      addonKey: { type: String, required: true },
      quantity: { type: Number, required: true, default: 1 },
      pricePerUnit: { type: Number, required: true },
      addedAt: { type: Date, default: Date.now },
    },
  ],
  // Coupon applied at initial checkout — a full SNAPSHOT of what the customer
  // agreed to pay, not just a code + one number. The recurring amount this
  // produced is separately baked into a fixed-price Razorpay Plan (see
  // findOrCreateRazorpayPlan), so renewals never re-run the discount engine —
  // this snapshot exists purely so the org can see what's applied and why,
  // without it ever silently drifting if the coupon is edited/deleted later.
  // Redemption (usage-limit consumption + analytics) is recorded separately
  // once payment is actually captured — see utils/discountEngine.recordRedemption.
  appliedCoupon: {
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
    code: String,
    name: String,
    // Copied from the Coupon at the moment it was applied — support/renewal
    // logic should read THIS, never the live Coupon.duration, so an admin
    // editing the coupon's duration later can't retroactively change what an
    // existing subscriber agreed to.
    duration: {
      type: { type: String, enum: ['lifetime', 'first_payment', 'fixed_cycles', 'until_date', 'until_cancelled'] },
      cycles: Number,
    },
    discountAmount: Number,
    baseSubtotal: Number, // plan + add-ons, before this coupon's discount
    recurringSubtotal: Number, // baseSubtotal - discountAmount — what recurs each cycle
    rulesApplied: [
      {
        productType: String, // 'plan' | 'addon'
        productKey: String,
        discountType: String, // 'percentage' | 'fixed'
        discountValue: Number,
        discountAmount: Number,
      },
    ],
    redeemed: { type: Boolean, default: false },
  },
  pendingUpdate: {
    planName: String,
    pricePerUser: Number,
    userCount: Number,
    totalAmount: Number,
    billingCycle: String,
    scheduledAt: Date,
    // Frozen snapshot of add-ons carrying into the scheduled plan, taken at the
    // moment the change was scheduled. Later add-on purchases on the active
    // subscription do not retroactively modify this list.
    carriedAddons: [
      {
        addonKey: String,
        quantity: Number,
        pricePerUnit: Number,
      },
    ],
    // Frozen snapshot of add-ons dropped by this plan change (incompatible with
    // the target plan), same reasoning as carriedAddons above.
    removedAddons: [
      {
        addonKey: String,
        quantity: Number,
        pricePerUnit: Number,
      },
    ],
  },
  pendingUpgrade: {  // New field for temporary upgrade state
    planName: String,
    pricePerUser: Number,
    userCount: Number,
    totalAmount: Number,
    billingCycle: String,
    prorationAmount: Number,
    orderId: String,  // Razorpay order ID for the proration payment
    createdAt: Date,
    activeAddons: [  // Compatible add-ons to carry forward on upgrade completion
      {
        addonKey: String,
        quantity: Number,
        pricePerUnit: Number,
        addedAt: Date,
      }
    ],
    droppedAddons: [  // Incompatible add-ons that will be dropped on upgrade
      {
        addonKey: String,
        displayName: String,
        quantity: Number,
        pricePerUnit: Number,
        reason: String,
      }
    ],
  },
  pendingAddonAddition: {
    addonKey: { type: String },
    quantity: { type: Number },
    pricePerUnit: { type: Number },
    prorationAmount: { type: Number },
    orderId: { type: String },
    createdAt: { type: Date },
    // Set only if a referral reward was reserved against this order's
    // proration amount — settlement uses this to consume/release the
    // RewardUsage. See backend/docs/REFERRAL_SYSTEM_DESIGN.md §9.
    referralRewardUsageId: { type: mongoose.Schema.Types.ObjectId, ref: 'RewardUsage' },
  },
  pendingPlanChange: {
    newPlanName: { type: String },
    newBasePrice: { type: Number },
    proratedDiffCharged: { type: Number },
    orderId: { type: String },
    needsRazorpaySync: { type: Boolean },
    compatibleAddons: [
      {
        addonKey: String,
        quantity: Number,
        pricePerUnit: Number,
      },
    ],
    incompatibleAddons: [
      {
        addonKey: String,
        displayName: String,
        quantity: Number,
        pricePerUnit: Number,
      },
    ],
    newAddonPurchases: [
      {
        addonKey: String,
        quantity: Number,
        pricePerUnit: Number,
      },
    ],
    createdAt: { type: Date },
    // Set only if a referral reward was reserved against this upgrade's
    // prorated order — settlement uses this to consume/release the
    // RewardUsage. Same pattern as pendingAddonAddition.referralRewardUsageId.
    // See backend/docs/REFERRAL_SYSTEM_DESIGN.md §9.
    referralRewardUsageId: { type: mongoose.Schema.Types.ObjectId, ref: 'RewardUsage' },
  },
  pendingAddonRemovals: [
    {
      addonKey: { type: String, required: true },
      displayName: { type: String },
      quantity: { type: Number, required: true },
      pricePerUnit: { type: Number, required: true },
      scheduledAt: { type: Date, default: Date.now },
      effectiveAt: { type: Date },
    },
  ],
  paymentStatus: {
    type: String,
    enum: ['pending_payment', 'payment_completed', 'payment_failed', 'payment_cancelled'],
    default: 'pending_payment'
  },
  
  // Track actual subscription activation
  isPaymentConfirmed: {
    type: Boolean,
    default: false
  },
  
  // Store payment details for tracking
  lastPaymentAttempt: {
    razorpayPaymentId: String,
    amount: Number,
    attemptedAt: { type: Date, default: Date.now },
    status: String
  },

  // One-shot dashboard notice for super-admin-initiated changes (trial
  // adjusted/ended, subscription cancelled on the org's behalf). Cleared
  // the first time getCurrentSubscription returns it, so it shows exactly
  // once — not a persistent notification log.
  adminNotice: {
    message: String,
    createdAt: Date,
  },
}, { timestamps: true });

// subscriptionSchema.index({ organization: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);