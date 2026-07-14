// models/Reward.js
//
// IMMUTABLE once created — see REFERRAL_SYSTEM_DESIGN.md §6/§7. A Reward
// freezes rewardType/rewardValue forever at creation time; a later change to
// ReferralProgram config must never alter an already-earned Reward. Whether
// a reward has been used is tracked entirely by RewardUsage, never by a
// status field mutated on this document. `revokedAt` is the one deliberate
// exception — it marks revocation without deleting or rewriting the
// original grant, preserving the audit trail (§15).
//
// Application code must never call findOneAndUpdate/updateOne on this model
// for rewardType/rewardValue/organization/referral/source — those fields
// are write-once. Only `revokedAt` may be set after creation.
const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  referral: { type: mongoose.Schema.Types.ObjectId, ref: 'Referral' }, // null unless source === 'REFERRAL'

  source: {
    type: String,
    enum: ['REFERRAL', 'MANUAL', 'PARTNER', 'LOYALTY', 'SUPER_ADMIN', 'PROMOTION'],
    required: true,
  },

  rewardType: { type: String, enum: ['percentage', 'fixed'], required: true },
  rewardValue: { type: Number, required: true },
  maxRewardAmount: { type: Number, default: null }, // frozen at creation from the program config in effect at the time

  expiresAt: { type: Date, default: null }, // null = never expires (the default, per design §15/§22)

  createdAt: { type: Date, default: Date.now },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

rewardSchema.index({ organization: 1, revokedAt: 1 });

module.exports = mongoose.model('Reward', rewardSchema);
