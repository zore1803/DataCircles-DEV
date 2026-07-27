// utils/couponRenewalEligibility.js
//
// R7 — coupon revalidation at renewal (§3.6a, Chapter 19 C2/C4, Chapter 17).
// One algorithm evaluated against appliedCoupon.duration.type, not
// resource-specific branching (same house style Chapter 12 already
// established for downgrade eligibility).
//
// SCOPE, verified by tracing the actual code before writing this (not
// assumed): only 'lifetime' and 'until_cancelled' are creatable today
// (couponController.js's ENFORCEABLE_DURATIONS) — every real coupon in
// production is one of these two, and both should apply at every renewal
// unconditionally. This function is therefore NOT fixing a live bug; it
// exists so enabling 'first_payment' later (a one-line validation change)
// doesn't silently start discounting renewals it should never touch.
//
// 'fixed_cycles' and 'until_date' are NOT implemented here — both need new
// persistent state that doesn't exist yet (a cycles-consumed counter for
// fixed_cycles; an expiry field on the appliedCoupon snapshot itself for
// until_date, since Subscription.js's own comment already establishes that
// renewal logic must read the SNAPSHOT, never the live Coupon.validity.expiryDate).
// Confirmed by grep: zero counter fields exist anywhere in the codebase, and
// the appliedCoupon.duration snapshot has only `type`/`cycles`, no date.
// Both are rejected at coupon creation today, so leaving them
// fail-closed (never eligible) below matches current production behavior
// exactly, not a regression — same 🟩 (not urgent) triage class as this
// project's other "declared enum value, not yet backed by real state"
// findings (RewardUsage.releaseReason:'REPLACED_BY_NEW_INVOICE' before this
// session's R8 work; the missing referral-reservation imports).

// Per C2 (Chapter 9): "eligibility is evaluated at the exact moment the
// invoice is generated... no grace window." `now` is accepted as a parameter
// (not read internally) so callers/fixtures control it precisely, matching
// the same pattern this project already uses for time-sensitive checks.
function isCouponStillEligibleForRenewal(appliedCoupon, { now = new Date() } = {}) {
  const durationType = appliedCoupon?.duration?.type;
  switch (durationType) {
    case 'lifetime':
    case 'until_cancelled':
      // Per §3.6a — applies indefinitely once applied. Disabling/archiving
      // the underlying Coupon is a separate concern (not this snapshot's to
      // enforce — the snapshot exists precisely so an admin edit to the live
      // Coupon can't retroactively change what this subscriber agreed to).
      return true;
    case 'first_payment':
      // Never eligible at renewal, by definition — applies to the first
      // invoice only. Not reachable in production today (rejected at coupon
      // creation), but must fail closed once it becomes creatable.
      return false;
    case 'fixed_cycles':
    case 'until_date':
      // Not implemented — both need new persistent state not yet built (see
      // file header). Fail closed rather than silently apply indefinitely,
      // per this project's Law 8 posture: an unrecognized/not-yet-supported
      // state must never risk an unintended discount persisting forever.
      // Not reachable in production today (rejected at coupon creation).
      return false;
    default:
      // Unknown/missing duration type — fail closed, don't silently discount.
      return false;
  }
}

module.exports = { isCouponStillEligibleForRenewal };
