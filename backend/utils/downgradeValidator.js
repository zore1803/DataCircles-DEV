// utils/downgradeValidator.js
//
// The canonical downgrade eligibility gate (BILLING_DOMAIN business contract,
// agreed 2026-07-24): every downgrade must be validated BEFORE it can be
// scheduled. This module owns that decision — no other code should invent
// its own downgrade eligibility logic.
//
// Each check returns one of four statuses:
//   PASS          - no issue.
//   AUTO_FIXABLE  - resolvable by purchasing a specific add-on at a specific
//                   minimum quantity; the caller (frontend) prefills that
//                   quantity and lets the customer increase it further, but
//                   never below the minimum.
//   MANUAL_ACTION - the customer must resolve this themselves (delete data,
//                   reduce usage); not implemented by any check yet.
//   BLOCKING      - cannot be resolved at all (e.g. a feature with no
//                   purchasable replacement on the target plan); downgrade is
//                   flatly not possible until this changes.
//
// SCOPE (deliberately narrow): v1 validates SEATS ONLY. This is not a
// placeholder — checks for storage/pipelines/customFields/recordTags/etc.
// are NOT included, not flagged-as-unsupported, simply absent, because none
// of them has a real, authoritative usage-tracking function yet (per the
// 2026-07-24 codebase audit). A partial validator that pretends to clear a
// downgrade while silently ignoring real limits is worse than no validator —
// customers would schedule downgrades that later fail at renewal for
// reasons this code never checked. Add a new limit here ONLY once it has its
// own complete, tested usage function — never as a stub.
//
// This validator is READ-ONLY — it never mutates the subscription or creates
// any ScheduledChange. Scheduling only happens after eligible === true.

const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');
const User = require('../models/User');
const Invited = require('../models/Invited');
const { classifyAddonsForPlanChange, addonIdentityKey } = require('./addonManagement');
const { buildEffectiveSubscription } = require('./renewalEngine');

const STATUS = Object.freeze({
  PASS: 'PASS',
  AUTO_FIXABLE: 'AUTO_FIXABLE',
  MANUAL_ACTION: 'MANUAL_ACTION',
  BLOCKING: 'BLOCKING',
});

/**
 * Seats are the one limit with a complete, already-existing usage function
 * (getSeatStatus, addonManagement.js) — but that function reports seats
 * against the CURRENT plan. This computes the same comparison against a
 * HYPOTHETICAL target plan, before the customer has committed to anything.
 *
 * @param {Array<{addonKey, quantity}>} [plannedNewAddons] - seat add-ons the
 *   customer is requesting to buy IN THIS SAME downgrade request (contract:
 *   AUTO_FIXABLE must actually be resolvable in one step, not just reported
 *   and then rejected — the caller resubmits with these once the frontend
 *   prefills the recommended quantity, and validation must re-check against
 *   the resulting state, not the current one).
 * @param {Array<{addonKey, quantity}>} [resolvedCarryForwardAddons] - the
 *   ACTUAL carry-forward quantities after applying the customer's own
 *   carryForward overrides (computed by the caller, e.g. updateSubscription's
 *   downgrade branch). CRITICAL: if omitted, this function falls back to
 *   assuming full survival (no reduction) — that default is only correct for
 *   a PREVIEW call before the customer has edited anything. The commit path
 *   (updateSubscription) MUST always pass this, computed from the same
 *   `req.body.carryForward` the customer actually submitted — otherwise a
 *   customer who reduces a carried seat to 0 gets validated against a seat
 *   that was never going to exist, and an invalid downgrade gets scheduled.
 */
async function validateSeats(subscription, targetPlanId, plannedNewAddons = [], resolvedCarryForwardAddons = null) {
  const targetPlan = await PlanConfig.findOne({ planId: targetPlanId, isActive: true });
  if (!targetPlan) throw new Error(`Plan config not found for "${targetPlanId}"`);

  const [activeUsersCount, pendingInvitesCount] = await Promise.all([
    User.countDocuments({ organization: subscription.organization }),
    Invited.countDocuments({ organization: subscription.organization }),
  ]);
  const occupiedSeats = activeUsersCount + pendingInvitesCount;

  let carriedSeatQuantity;
  if (resolvedCarryForwardAddons) {
    // Trust the caller's already-resolved carry-forward state completely —
    // do NOT recompute an independent "full survival" assumption here, that
    // was the actual bug (validator PASS-ing against a seat the customer had
    // already reduced to 0).
    const resolvedKeys = resolvedCarryForwardAddons.map((a) => a.addonKey);
    const resolvedCatalog = resolvedKeys.length > 0 ? await PlanAddon.find({ key: { $in: resolvedKeys } }) : [];
    carriedSeatQuantity = resolvedCarryForwardAddons.reduce((sum, a) => {
      const entry = resolvedCatalog.find((e) => e.key === a.addonKey);
      return entry?.targetKey === 'seats' ? sum + a.quantity : sum;
    }, 0);
  } else {
    // PREVIEW default (no carryForward submitted yet): assume full survival
    // of whatever the effective (post-existing-scheduled-removal) state
    // would carry forward — matches the number the frontend prefills before
    // the customer touches the stepper.
    const previewHorizon = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);
    const { effective } = await buildEffectiveSubscription(subscription, previewHorizon);
    // Phase 2b: key on (addonKey, billingCycle), not addonKey alone — see
    // addonIdentityKey's own comment for why the fallback keeps this an
    // exact no-op for every subscription that can't yet have two
    // cycle-variants of the same addonKey.
    const effectiveQuantityByKey = new Map(
      (effective.activeAddons || []).map((a) => [addonIdentityKey(a, subscription.billingCycle), a.quantity])
    );

    const rawActiveAddons = subscription.activeAddons || [];
    const { compatible } = rawActiveAddons.length > 0
      ? await classifyAddonsForPlanChange(rawActiveAddons, targetPlanId, subscription.billingCycle)
      : { compatible: [] };

    const compatibleKeys = compatible.map((c) => c.addonKey);
    const catalogEntries = compatibleKeys.length > 0 ? await PlanAddon.find({ key: { $in: compatibleKeys } }) : [];
    carriedSeatQuantity = compatible.reduce((sum, c) => {
      const entry = catalogEntries.find((e) => e.key === c.addonKey);
      if (entry?.targetKey !== 'seats') return sum;
      const survives = effectiveQuantityByKey.get(addonIdentityKey(c, subscription.billingCycle)) ?? 0;
      return sum + survives;
    }, 0);
  }

  const includedSeats = targetPlan.features?.includedSeats ?? 1;

  // The seat add-on actually purchasable on the TARGET plan — looked up
  // before computing planned quantity, since plannedNewAddons must be
  // matched against whichever key the target plan actually uses (it may
  // differ from whatever key the customer's current plan uses).
  const seatAddonOnTarget = await PlanAddon.findOne({
    targetKey: 'seats',
    isActive: true,
    $or: [{ availableOnPlans: { $size: 0 } }, { availableOnPlans: targetPlanId }],
  });
  const plannedSeatQuantity = seatAddonOnTarget
    ? plannedNewAddons
        .filter((a) => a.addonKey === seatAddonOnTarget.key)
        .reduce((sum, a) => sum + (a.quantity || 0), 0)
    : 0;

  const totalAvailableSeats = includedSeats + carriedSeatQuantity + plannedSeatQuantity;
  const remainingShortfall = Math.max(0, occupiedSeats - totalAvailableSeats);

  if (remainingShortfall === 0) {
    // PASS covers both "already fit" and "fits once the requested
    // plannedNewAddons are included" — the caller (updateSubscription) is
    // responsible for actually persisting those planned addons once this
    // returns PASS; the validator itself never mutates anything.
    return { type: 'SEATS', status: STATUS.PASS, current: occupiedSeats, allowed: totalAvailableSeats };
  }

  if (!seatAddonOnTarget) {
    return {
      type: 'SEATS',
      status: STATUS.BLOCKING,
      current: occupiedSeats,
      allowed: totalAvailableSeats,
      message: `You have ${occupiedSeats} users, but ${targetPlanId} only supports ${totalAvailableSeats}, and no seat add-on is available to expand it.`,
    };
  }

  return {
    type: 'SEATS',
    status: STATUS.AUTO_FIXABLE,
    current: occupiedSeats,
    allowed: totalAvailableSeats,
    requiredAddon: seatAddonOnTarget.key,
    // Prefilled minimum — the ADDITIONAL quantity still needed on top of
    // whatever was already in plannedNewAddons. The caller may let the
    // customer increase this further, but must never allow going below it
    // (per the agreed contract).
    minimumQuantity: remainingShortfall,
    pricePerUnit: subscription.billingCycle === 'yearly' ? seatAddonOnTarget.price?.yearly : seatAddonOnTarget.price?.monthly,
    message: `You have ${occupiedSeats} users but ${targetPlanId} only supports ${totalAvailableSeats}. Add ${remainingShortfall} more seat${remainingShortfall > 1 ? 's' : ''} to continue.`,
  };
}

/**
 * Combines every check into one eligibility decision.
 *
 * `eligible` is true only when every check is PASS. Critically, AUTO_FIXABLE
 * is NOT a dead end: pass `plannedNewAddons` (add-ons the customer is buying
 * in this same downgrade request) and a shortfall that's fully covered by
 * them resolves to PASS — the whole point of AUTO_FIXABLE is that it's
 * resolvable in one round trip, not a second wall after the first one.
 * `hasHardBlocker` distinguishes "still needs the customer to add/increase
 * an addon" (AUTO_FIXABLE, not yet satisfied) from MANUAL_ACTION/BLOCKING,
 * which no addon quantity can ever fix — callers should use this instead of
 * `eligible` to decide whether to show "add N more and resubmit" vs. a flat
 * refusal.
 *
 * @param {Array<{addonKey, quantity}>|null} [resolvedCarryForwardAddons] -
 *   see validateSeats' doc. The commit path (updateSubscription) MUST always
 *   pass this — omitting it silently reverts to the "assume full survival"
 *   preview default, which is exactly the bug that let a customer schedule
 *   an invalid downgrade after reducing a carried seat to 0.
 */
async function validateDowngrade(subscription, targetPlanId, plannedNewAddons = [], resolvedCarryForwardAddons = null) {
  const results = [await validateSeats(subscription, targetPlanId, plannedNewAddons, resolvedCarryForwardAddons)];
  const blockers = results.filter((r) => r.status !== STATUS.PASS);
  const eligible = blockers.length === 0;
  const hasHardBlocker = blockers.some((r) => r.status === STATUS.MANUAL_ACTION || r.status === STATUS.BLOCKING);
  return { eligible, hasHardBlocker, results, blockers };
}

/**
 * Freeze rule (business contract, agreed 2026-07-24): once a downgrade is
 * scheduled (subscription.pendingUpdate is set), no further billing mutation
 * is allowed — no addon purchase, no addon removal, no another plan change
 * (upgrade or downgrade). The only two escape hatches are cancelling the
 * scheduled downgrade itself, and cancelling the subscription outright —
 * both of which must NOT call this guard.
 *
 * Throws (does not return a value) so call sites can just `assertNotFrozen(subscription)`
 * inside their existing try/catch and let it surface as a normal error response.
 */
function assertNotFrozen(subscription) {
  // Mongoose auto-instantiates nested-object schema fields (no `default:
  // null` on pendingUpdate) as an empty {} subdocument even when nothing was
  // ever set — plain truthiness would treat EVERY subscription as frozen.
  // planName is always set when a real downgrade was scheduled, never
  // otherwise, so it's the correct presence check.
  if (subscription.pendingUpdate?.planName) {
    const err = new Error(
      `A downgrade to ${subscription.pendingUpdate.planName} is already scheduled for ${new Date(subscription.pendingUpdate.scheduledAt).toLocaleDateString('en-IN')}. ` +
      `Cancel the scheduled downgrade before making other billing changes.`
    );
    err.code = 'DOWNGRADE_SCHEDULED_FREEZE';
    throw err;
  }
}

module.exports = { STATUS, validateSeats, validateDowngrade, assertNotFrozen };
