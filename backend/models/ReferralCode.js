// models/ReferralCode.js
//
// The shareable code itself, separate from the Referral it produces and the
// Reward that eventually comes from it — see REFERRAL_SYSTEM_DESIGN.md §2.
// An org can have more than one code over time (reissue/rotation) without
// losing the history of Referrals its earlier codes already produced.
const mongoose = require('mongoose');

const referralCodeSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

referralCodeSchema.index({ organization: 1, isActive: 1 });

module.exports = mongoose.model('ReferralCode', referralCodeSchema);
