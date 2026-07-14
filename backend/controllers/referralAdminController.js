// controllers/referralAdminController.js
//
// Super Admin referral configuration + manual overrides. Backend only —
// no frontend UI this pass (see PROJECT_STATE.md). Per
// REFERRAL_SYSTEM_DESIGN.md §7/§15: config changes here only ever affect
// REWARDS CREATED AFTER the change — never rewritten retroactively, because
// Reward is immutable once created (see models/Reward.js).
const mongoose = require('mongoose');
const ReferralProgram = require('../models/ReferralProgram');
const ReferralCode = require('../models/ReferralCode');
const Referral = require('../models/Referral');
const Reward = require('../models/Reward');
const RewardUsage = require('../models/RewardUsage');
const { getOrCreateReferralProgram, buildReferralOverview } = require('../utils/referralUtils');
const { releaseReservation } = require('../utils/referralRewards');
const { emitBillingEvent } = require('../utils/billingEvents');

// GET /super-admin/referrals/programs/:organizationId
exports.getReferralProgram = async (req, res) => {
  try {
    const program = await getOrCreateReferralProgram(req.params.organizationId);
    res.json({ program });
  } catch (error) {
    console.error('getReferralProgram error:', error);
    res.status(500).json({ error: error.message });
  }
};

// PUT /super-admin/referrals/programs/:organizationId
// Only ever affects rewards created from this point forward — see file header.
exports.updateReferralProgram = async (req, res) => {
  try {
    const allowedFields = [
      'enabled', 'rewardType', 'rewardValue', 'maxRewardAmount',
      'stacksWithCoupons', 'appliesTo', 'expiryDurationDays',
      'eligiblePlans', 'eligibleBillingCycles', 'minimumQualifyingPlan',
      'honoredDuringTrial', 'minimumActiveDays',
      'maxPendingReferrals', 'maxTotalReferrals',
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const program = await ReferralProgram.findOneAndUpdate(
      { organization: req.params.organizationId },
      { $set: updates, $setOnInsert: { organization: req.params.organizationId } },
      { new: true, upsert: true }
    );

    if (req.body.enabled === false) {
      await emitBillingEvent({
        organization: req.params.organizationId,
        eventType: 'REFERRAL_DISABLED',
        status: 'completed',
        metadata: { by: 'super_admin' },
      });
    }

    res.json({ program });
  } catch (error) {
    console.error('updateReferralProgram error:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET /super-admin/referrals/organizations/:organizationId
// Overview: codes, referrals (sent/pending/qualified), rewards (available/consumed/revoked).
// Shared with the org-facing "my referrals" endpoint via buildReferralOverview
// (utils/referralUtils.js) — one query shape, not a duplicated copy.
exports.getOrganizationReferralOverview = async (req, res) => {
  try {
    const overview = await buildReferralOverview(req.params.organizationId);
    res.json({ ...overview, referrals: overview.referralsSent }); // `referrals` kept for backward compatibility with any existing caller
  } catch (error) {
    console.error('getOrganizationReferralOverview error:', error);
    res.status(500).json({ error: error.message });
  }
};

// POST /super-admin/referrals/rewards/manual
// Manually grant a reward (support/goodwill case) — still funnels through
// the same Reward model, source: 'MANUAL', never a second writer of the
// underlying concept (REFERRAL_SYSTEM_DESIGN.md §16).
exports.grantManualReward = async (req, res) => {
  try {
    const { organizationId, rewardType, rewardValue, maxRewardAmount, expiresAt } = req.body;
    if (!organizationId || !mongoose.Types.ObjectId.isValid(organizationId)) {
      return res.status(400).json({ error: 'A valid organizationId is required.' });
    }
    if (!['percentage', 'fixed'].includes(rewardType)) {
      return res.status(400).json({ error: 'rewardType must be "percentage" or "fixed".' });
    }
    if (typeof rewardValue !== 'number' || rewardValue <= 0) {
      return res.status(400).json({ error: 'rewardValue must be a positive number.' });
    }

    const reward = await Reward.create({
      organization: organizationId,
      source: 'MANUAL',
      rewardType,
      rewardValue,
      maxRewardAmount: maxRewardAmount ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    await emitBillingEvent({
      organization: organizationId,
      eventType: 'REFERRAL_REWARD_EARNED',
      status: 'completed',
      metadata: { rewardId: reward._id, rewardType, rewardValue, source: 'MANUAL' },
    });

    res.json({ reward });
  } catch (error) {
    console.error('grantManualReward error:', error);
    res.status(500).json({ error: error.message });
  }
};

// POST /super-admin/referrals/rewards/:rewardId/revoke
// Revocation preserves the original Reward record (immutable — never
// deleted or edited) and only sets revokedAt, per §6/§15.
exports.revokeReward = async (req, res) => {
  try {
    const reward = await Reward.findById(req.params.rewardId);
    if (!reward) return res.status(404).json({ error: 'Reward not found.' });
    if (reward.revokedAt) {
      return res.status(400).json({ error: 'Reward is already revoked.' });
    }

    reward.revokedAt = new Date();
    await reward.save();

    // Release any live reservation against this reward — otherwise an
    // in-flight checkout could still silently consume a reward the admin
    // just revoked. If the reservation was already consumed (settlement won
    // the race before revocation), releaseReservation's conditional update
    // simply won't match — that consumption already happened and stands;
    // revoking only prevents this reward from being used from now on.
    const liveUsage = await RewardUsage.findOne({ reward: reward._id, status: 'reserved' });
    if (liveUsage) {
      await releaseReservation(liveUsage._id);
    }

    await emitBillingEvent({
      organization: reward.organization,
      eventType: 'REFERRAL_REWARD_REVOKED',
      status: 'completed',
      metadata: { rewardId: reward._id, releasedUsageId: liveUsage?._id },
    });

    res.json({ reward });
  } catch (error) {
    console.error('revokeReward error:', error);
    res.status(500).json({ error: error.message });
  }
};
