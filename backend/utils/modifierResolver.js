// utils/modifierResolver.js
//
// The Modifier Resolution stage — see backend/docs/PRICING_MODIFIER_ARCHITECTURE.md.
// Looks up which discounts currently apply to an organization (a coupon
// already priced by discountEngine, an available referral reward) and
// returns them as an ordered, UNRESOLVED-to-rupees Modifier[] for the
// Pricing Engine to apply. This module does the I/O (DB lookups); it does
// NOT compute rupee amounts — that arithmetic belongs entirely to
// buildPricingSnapshot (utils/pricingEngine.js), per invariant #5.
const { getNextAvailableReward } = require('./referralRewards');

// Lower number = applied earlier in the discount sequence (see
// PRICING_MODIFIER_ARCHITECTURE.md §3 — coupon before referral reward).
const PRIORITY = { coupon: 10, referral: 20 };

// Normalizes a Reward document into the generic Modifier shape. One place
// so the committing checkout path (which builds a modifier from a reward it
// already atomically reserved) and the read-only preview path
// (resolveReferralModifier) produce identical modifier objects.
function rewardToModifier(reward) {
  return {
    type: 'referral',
    source: reward.source,
    priority: PRIORITY.referral,
    value: { kind: reward.rewardType, amount: reward.rewardValue, maxAmount: reward.maxRewardAmount },
    appliesTo: 'entire_invoice',
    stackable: true,
    referenceId: reward._id,
    reward, // full document attached; never used for arithmetic
  };
}

// Wraps an already-priced coupon result (from discountEngine.validateAndPriceCoupon)
// into the generic Modifier shape. Coupon per-line-item eligibility/pricing
// stays exactly as-is in discountEngine.js — this only normalizes its
// already-resolved rupee total into a Modifier, it doesn't re-derive it.
function couponToModifier(couponResult) {
  if (!couponResult || !couponResult.discountAmount) return null;
  return {
    type: 'coupon',
    source: 'COUPON',
    priority: PRIORITY.coupon,
    value: { kind: 'fixed', amount: couponResult.discountAmount },
    appliesTo: 'entire_invoice',
    stackable: true,
    referenceId: couponResult.coupon?._id || null,
  };
}

// Resolves the next available referral reward (if any) into a Modifier.
// Returns null if the org has no usable reward. Deliberately returns the
// reward's raw type/value/cap UNRESOLVED (kind: 'percentage' | 'fixed') —
// the engine computes the actual rupee amount against the running subtotal.
async function resolveReferralModifier(organizationId) {
  const reward = await getNextAvailableReward(organizationId);
  if (!reward) return null;
  return rewardToModifier(reward);
}

// Main entry point. `couponResult` is optional and is whatever the caller
// already got back from discountEngine.validateAndPriceCoupon (or null).
// Returns an ordered Modifier[], sorted by priority, ready for
// buildPricingSnapshot's `modifiers` input.
async function resolveModifiers({ organizationId, couponResult = null }) {
  const modifiers = [];

  const couponModifier = couponToModifier(couponResult);
  if (couponModifier) modifiers.push(couponModifier);

  const referralModifier = await resolveReferralModifier(organizationId);
  if (referralModifier) modifiers.push(referralModifier);

  return modifiers.sort((a, b) => a.priority - b.priority);
}

module.exports = { resolveModifiers, couponToModifier, resolveReferralModifier, rewardToModifier, PRIORITY };
