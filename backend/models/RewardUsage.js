// models/RewardUsage.js
//
// One row per attempt to apply a Reward to an invoice — see
// REFERRAL_SYSTEM_DESIGN.md §6/§9. A Reward's "is it available" state is
// DERIVED, never stored: a reward is available if it has no RewardUsage row
// in 'reserved' or 'consumed' status (see utils/referralRewards.js). This
// mirrors ARCHITECTURE.md invariant #6 (entitlements are derived from
// canonical state, never cached independently).
//
// `expiresAt` bounds a reservation's lifetime — if nothing consumes it by
// then, releaseExpiredReservations (utils/referralRewards.js, called in the
// reservation path and by a future cron) flips it to 'released'.
//
// CONCURRENCY: the partial unique index below is the atomic guard that makes
// reservation safe under concurrent checkouts. Two simultaneous attempts to
// reserve the SAME reward both try to insert a { reward, status:'reserved' }
// row; the unique index lets exactly one succeed and rejects the other with
// a duplicate-key error (code 11000), which reserveNextAvailableReward
// catches and retries against the next reward. Without this, the
// check-then-act between getNextAvailableReward (read) and the insert (write)
// is a TOCTOU race that allows one reward to be spent twice. The index only
// covers 'reserved' rows (partialFilterExpression), so once a reservation
// transitions to 'consumed' or 'released' it no longer occupies the slot —
// which is exactly why expired reservations MUST be moved out of 'reserved'
// (not left lazily) or the slot would jam forever.
const mongoose = require('mongoose');

const rewardUsageSchema = new mongoose.Schema({
  // No field-level index here — the compound { reward, status } index and the
  // partial-unique { reward } index below both cover reward-prefixed queries.
  reward: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', required: true },

  // What this usage attempt was for. One of these should be set depending on
  // which settlement flow reserved it (a one-time Order for a prorated
  // charge, or a recurring renewal payment).
  invoiceId: { type: String },
  paymentId: { type: String },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },

  status: { type: String, enum: ['reserved', 'consumed', 'released'], default: 'reserved', index: true },

  reservedAt: { type: Date, default: Date.now },
  consumedAt: { type: Date },
  releasedAt: { type: Date },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

rewardUsageSchema.index({ reward: 1, status: 1 });

// Atomic reservation guard — see the CONCURRENCY note in the header. At most
// one 'reserved' usage may exist per reward at a time.
rewardUsageSchema.index(
  { reward: 1 },
  { unique: true, partialFilterExpression: { status: 'reserved' } }
);

module.exports = mongoose.model('RewardUsage', rewardUsageSchema);
