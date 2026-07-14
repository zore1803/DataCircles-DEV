// models/Referral.js
//
// One specific instance of an organization signing up with another
// organization's referral code — the INTENT record, per
// REFERRAL_SYSTEM_DESIGN.md §3/§5. Creating this does NOT create a Reward —
// a Reward is only created by settlement (the referred org's first
// confirmed payment), never here. This is the referral-system equivalent of
// Subscription.pendingPlanChange: recorded before external confirmation,
// acted on only by the one settlement function allowed to qualify it.
const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrerOrganization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  referredOrganization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true }, // one referrer per org, permanent once set (§24)
  referralCode: { type: mongoose.Schema.Types.ObjectId, ref: 'ReferralCode', required: true },

  status: { type: String, enum: ['pending', 'qualified', 'expired'], default: 'pending', index: true },

  createdAt: { type: Date, default: Date.now },
  qualifiedAt: { type: Date }, // set only by settlement, when the referred org's first payment is confirmed
}, { timestamps: true });

referralSchema.index({ referrerOrganization: 1, status: 1 });

module.exports = mongoose.model('Referral', referralSchema);
