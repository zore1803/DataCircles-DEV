// models/ReferralProgram.js
//
// Per-organization referral configuration — see backend/docs/REFERRAL_SYSTEM_DESIGN.md
// §15/§28. One document per organization (created lazily on first use, see
// utils/referralProgram.js). Config here only ever affects REWARDS CREATED
// AFTER a change — a Reward freezes its own rewardType/rewardValue at
// creation (§7, immutability) and never re-reads this document.
const mongoose = require('mongoose');

const referralProgramSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },

  enabled: { type: Boolean, default: true },

  rewardType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  rewardValue: { type: Number, default: 20 }, // percentage points, or rupees if rewardType === 'fixed'
  maxRewardAmount: { type: Number, default: null }, // rupee cap on a percentage-based reward; null = uncapped

  stacksWithCoupons: { type: Boolean, default: true },
  appliesTo: { type: String, enum: ['entire_invoice', 'plan_only'], default: 'entire_invoice' },

  // null/0 = never expires — the deliberate default, see design doc §15/§22.
  expiryDurationDays: { type: Number, default: null },

  eligiblePlans: [{ type: String }], // empty = all plans
  eligibleBillingCycles: [{ type: String, enum: ['monthly', 'yearly'] }], // empty = both
  minimumQualifyingPlan: { type: String, default: null },

  honoredDuringTrial: { type: Boolean, default: false },
  minimumActiveDays: { type: Number, default: 0 }, // referred org must stay active this many days before reward is granted

  maxPendingReferrals: { type: Number, default: null }, // null = unlimited
  maxTotalReferrals: { type: Number, default: null }, // null = unlimited

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin' },
}, { timestamps: true });

module.exports = mongoose.model('ReferralProgram', referralProgramSchema);
