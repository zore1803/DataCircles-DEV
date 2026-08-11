// utils/modifierResolver.js
//
// Normalizes a Reward document into the generic Modifier shape consumed by
// utils/pricingEngine.js's calculateInvoice()/buildPricingSnapshot(). This
// module does no arithmetic — that belongs entirely to pricingEngine.js
// (invariant #5).
//
// Phase 7 cleanup: resolveModifiers(), couponToModifier(), and
// resolveReferralModifier() were removed here — confirmed zero callers
// anywhere in the codebase (resolveModifiers() was never wired into any
// production path; the other two existed only to support it). Their
// ordering guarantee (coupon before referral) is now enforced inside
// pricingEngine.js itself, derived from each modifier's own `type`
// (Phase 3 item 5b) — not by pre-sorting here, which is what made this
// module's sort dead weight rather than load-bearing.
const PRIORITY = { coupon: 10, referral: 20 };

// Normalizes a Reward document into the generic Modifier shape. Used by the
// upgrade and add-on-purchase checkout paths, which build a modifier from a
// reward they've already atomically reserved.
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

// Builds a referral Modifier directly from a pending referral's PROGRAM
// CONFIG — not from a Reward (none exists yet). Used only at first-payment
// signup pricing (createSubscription, via utils/referralUtils.js's
// findPendingReferralForSignup()): the referee's benefit applies directly to
// their first invoice, once, and is never reserved-then-consumed. Every other
// referral call site (upgrade/add-on purchase/renewal) uses rewardToModifier()
// above, wrapping an already-earned, already-reserved Reward — this is a
// deliberately different shape, not a variant of that one.
function referralModifierFromPendingProgram(program) {
  return {
    type: 'referral',
    source: 'REFERRAL_SIGNUP',
    priority: PRIORITY.referral,
    value: { kind: program.rewardType, amount: program.rewardValue, maxAmount: program.maxRewardAmount },
    appliesTo: 'entire_invoice',
    stackable: true,
  };
}

module.exports = { rewardToModifier, referralModifierFromPendingProgram, PRIORITY };
