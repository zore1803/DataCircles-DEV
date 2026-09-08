// utils/planTiers.js
//
// The canonical vertical ordering of plan tiers — needed by the Billing
// Calendar's step chart, where a plan's tier IS its vertical position, so an
// upgrade visibly steps UP and a downgrade steps DOWN.
//
// This ordering already exists as an inline `{ starter: 1, growth: 2,
// business: 3 }` object literal in four separate places:
//   frontend/src/utils/subscriptionHelpers.js  (PLAN_PRIORITY)
//   frontend/src/components/settings/SubscriptionPlans.jsx
//   backend/controllers/subscriptionController.js  (x2: the upgrade check,
//     and isGenuineDowngrade)
// This module is deliberately ADDITIVE — it does not refactor those four
// sites in this pass (they drive real upgrade/downgrade branching, and
// changing them is a behavioural change that belongs in its own change with
// its own verification). It exists so the projection has one place to read a
// rank from rather than adding a fifth copy.
//
// `trial` is ranked 0 and is NOT a plan tier in any of the four existing
// copies — a trial is a boolean/date state on the subscription
// (isTrialActive/trialStart/trialEnd), not a purchasable plan. It is ranked
// here purely so the calendar can draw it as the bottom-most row beneath the
// paid tiers, which is a display concern only. Never use this rank to decide
// whether something is an upgrade or a downgrade.
const PLAN_TIER_RANK = {
  trial: 0,
  starter: 1,
  growth: 2,
  business: 3,
};

// Highest rank + 1 — how many horizontal gridlines the chart's Y-axis needs.
const PLAN_TIER_COUNT = Object.keys(PLAN_TIER_RANK).length;

// Returns null (not 0) for an unrecognised plan name, so the caller can tell
// "unknown plan" apart from "trial" rather than silently drawing an unknown
// tier at the trial row.
function planTierRank(planName) {
  if (!planName) return null;
  const rank = PLAN_TIER_RANK[String(planName).toLowerCase()];
  return rank === undefined ? null : rank;
}

module.exports = { PLAN_TIER_RANK, PLAN_TIER_COUNT, planTierRank };
