// utils/referralUtils.js
//
// Referral-specific helpers: code generation/validation and program config
// lookup (with defaults, never hardcoded). See REFERRAL_SYSTEM_DESIGN.md.
//
// The reward RESERVATION LIFECYCLE (availability, reserve/consume/release)
// lives in utils/referralRewards.js, not here — kept separate so the
// concurrency-sensitive state machine is in one place.
const ReferralProgram = require('../models/ReferralProgram');
const ReferralCode = require('../models/ReferralCode');
const Referral = require('../models/Referral');
const Reward = require('../models/Reward');
const RewardUsage = require('../models/RewardUsage');

async function generateUniqueReferralCode() {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 9).toUpperCase();
  } while (await ReferralCode.findOne({ code }));
  return code;
}

// Lazily creates a ReferralProgram with defaults if the org doesn't have one
// yet — the org never needs to explicitly "enable" referrals before this
// exists; Super Admin config only ever overrides these defaults.
async function getOrCreateReferralProgram(organizationId) {
  let program = await ReferralProgram.findOne({ organization: organizationId });
  if (!program) {
    program = await ReferralProgram.create({ organization: organizationId });
  }
  return program;
}

// Issues a new active ReferralCode for an org. Does not deactivate any
// existing code — reissue/rotation is a deliberate separate action, not
// automatic, so an org's existing shared links keep working unless someone
// explicitly deactivates the old code.
async function issueReferralCode(organizationId) {
  const code = await generateUniqueReferralCode();
  return ReferralCode.create({ organization: organizationId, code });
}

// Validates a code entered at signup. Returns { valid, reason, referralCode }
// or { valid: true, referralCode }. Does NOT create a Referral — that's the
// caller's job (recordReferralIntent), keeping validation and the actual
// intent-write as separate steps.
async function validateReferralCode(code, { signupOrganizationId } = {}) {
  if (!code) return { valid: false, reason: 'No referral code provided.' };

  const referralCode = await ReferralCode.findOne({ code: code.trim().toUpperCase(), isActive: true });
  if (!referralCode) {
    return { valid: false, reason: 'Referral code not found or no longer active.' };
  }

  // Self-referral guard (§18/§24) — only the cheapest, structural check
  // (same organization) is enforced here. GST/PAN/payment-method/IP/domain
  // signals are documented as fraud-review signals, not hard blocks, and are
  // deliberately not implemented as automatic denials yet (see design doc §18).
  if (signupOrganizationId && referralCode.organization.toString() === signupOrganizationId.toString()) {
    return { valid: false, reason: 'An organization cannot refer itself.' };
  }

  const program = await getOrCreateReferralProgram(referralCode.organization);
  if (!program.enabled) {
    return { valid: false, reason: 'Referrals are not currently enabled for this organization.' };
  }

  if (program.maxTotalReferrals != null) {
    const totalCount = await Referral.countDocuments({ referrerOrganization: referralCode.organization });
    if (totalCount >= program.maxTotalReferrals) {
      return { valid: false, reason: 'This organization has reached its maximum number of referrals.' };
    }
  }

  if (program.maxPendingReferrals != null) {
    const pendingCount = await Referral.countDocuments({ referrerOrganization: referralCode.organization, status: 'pending' });
    if (pendingCount >= program.maxPendingReferrals) {
      return { valid: false, reason: 'This organization has reached its maximum number of pending referrals.' };
    }
  }

  return { valid: true, referralCode, program };
}

// One organization may have exactly one referrer, permanent once set (§24)
// — enforced at the DB level too via Referral.referredOrganization's unique
// index; this is the friendly pre-check.
async function orgAlreadyHasReferrer(organizationId) {
  const existing = await Referral.findOne({ referredOrganization: organizationId });
  return !!existing;
}

// Records referral INTENT — creates a Referral in 'pending' status. This
// is domain-level, not tied to any one screen or flow: the business event
// is "this code is now known and validated for this organization," which
// must never be gated behind a trial start or a purchase decision (see
// REFERRAL_SYSTEM_DESIGN.md §3). Called from two independent entry points,
// both funneling through this one function rather than duplicating the
// logic:
//   - authController.completeRegistration — a code captured from a shared
//     link, known before the organization even exists.
//   - subscriptionController.applyReferralCode — a code typed in manually
//     on the checkout page, applied immediately via its own button, since
//     manual entry can only happen after the organization already exists.
//
// Never creates a Reward and never touches pricing — that only happens
// later, in settlement, once this Referral is qualified by a confirmed
// payment (subscriptionController.js maybeQualifyReferral). Safe to call
// with no code (no-op) and safe to call more than once for the same org
// (idempotent — a second call is a no-op once one Referral already exists,
// per the one-referrer-ever rule).
//
// Returns { created, reason? } — never throws; the caller decides whether
// to log/swallow, since a referral code should never block a real purchase.
async function recordReferralIntent(organizationId, code) {
  if (!code) return { created: false, reason: 'No code provided.' };

  if (await orgAlreadyHasReferrer(organizationId)) {
    return { created: false, reason: 'This organization already has a referrer.' };
  }

  const result = await validateReferralCode(code, { signupOrganizationId: organizationId });
  if (!result.valid) {
    return { created: false, reason: result.reason };
  }

  const referral = await Referral.create({
    referrerOrganization: result.referralCode.organization,
    referredOrganization: organizationId,
    referralCode: result.referralCode._id,
  });

  const { emitBillingEvent } = require('./billingEvents');
  await emitBillingEvent({
    organization: result.referralCode.organization,
    eventType: 'REFERRAL_RECORDED',
    status: 'completed',
    metadata: { referralId: referral._id, referredOrganization: organizationId },
  });

  return { created: true, referral };
}

// Read-only overview for one organization — codes it owns, referrals it
// sent, whether it was itself referred by someone, and every reward it
// holds (as referrer or referee — Reward.organization covers both, see
// REFERRAL_SYSTEM_DESIGN.md §6 amendment) with a derived status per reward.
// Shared by the org-facing "my referrals" endpoint and the Super Admin
// per-org overview — one query shape, not two copies of the same logic.
async function buildReferralOverview(organizationId) {
  const [codes, referralsSent, referredBy, rewards] = await Promise.all([
    ReferralCode.find({ organization: organizationId }).sort({ createdAt: -1 }),
    Referral.find({ referrerOrganization: organizationId })
      .sort({ createdAt: -1 })
      .populate('referredOrganization', 'name'),
    Referral.findOne({ referredOrganization: organizationId })
      .populate('referrerOrganization', 'name'),
    Reward.find({ organization: organizationId }).sort({ createdAt: -1 }),
  ]);

  const rewardIds = rewards.map((r) => r._id);
  const usages = rewardIds.length ? await RewardUsage.find({ reward: { $in: rewardIds } }) : [];
  const usageByReward = new Map();
  for (const u of usages) {
    const key = u.reward.toString();
    if (!usageByReward.has(key)) usageByReward.set(key, []);
    usageByReward.get(key).push(u);
  }

  const now = new Date();
  const rewardsWithStatus = rewards.map((r) => {
    const rUsages = usageByReward.get(r._id.toString()) || [];
    const consumed = rUsages.some((u) => u.status === 'consumed');
    const activelyReserved = rUsages.some((u) => u.status === 'reserved' && u.expiresAt > now);
    const expired = r.expiresAt && r.expiresAt <= now;
    let status = 'available';
    if (r.revokedAt) status = 'revoked';
    else if (consumed) status = 'consumed';
    else if (activelyReserved) status = 'reserved';
    else if (expired) status = 'expired';
    return { ...r.toObject(), status };
  });

  return {
    codes,
    referralsSent,
    referredBy,
    rewards: rewardsWithStatus,
    summary: {
      referralsSent: referralsSent.length,
      referralsQualified: referralsSent.filter((r) => r.status === 'qualified').length,
      referralsPending: referralsSent.filter((r) => r.status === 'pending').length,
      rewardsAvailable: rewardsWithStatus.filter((r) => r.status === 'available').length,
      rewardsConsumed: rewardsWithStatus.filter((r) => r.status === 'consumed').length,
    },
  };
}

module.exports = {
  generateUniqueReferralCode,
  getOrCreateReferralProgram,
  issueReferralCode,
  validateReferralCode,
  orgAlreadyHasReferrer,
  buildReferralOverview,
  recordReferralIntent,
};
