// utils/billingCalendarSegments.js
import { PLAN_PRIORITY } from './subscriptionHelpers';

// Plan-tier ranking — drives both the paid subscription track's vertical
// LEVEL (Business highest/top, Starter lowest/bottom, matching the org's
// actual tier ladder) and each tier's own color (see PLAN_TIER_COLOR in
// BillingCalendarTimeline.jsx). Reuses subscriptionHelpers.js's existing
// PLAN_PRIORITY rather than keeping a separate copy — this ranking was
// ALREADY duplicated in 4+ places across the codebase (frontend and
// backend) before this file existed; consolidating THIS one, display-only
// use is safe to do immediately (it drives no real upgrade/downgrade
// eligibility decision), unlike the behavior-driving copies, which stay
// untouched per backend/utils/planTiers.js's own stated additive-only
// design. An unrecognized plan name (a future new plan) just gets rank 0
// and renders on its own lowest lane rather than crashing.
export const PLAN_TIER_RANK = PLAN_PRIORITY;

// Mirrors backend/utils/renewalEngine.js's own addBillingCycle exactly —
// monthly is a CALENDAR month via setMonth(+1), not a flat 30 days, and
// annual is a calendar year via setFullYear(+1). Used ONLY for cosmetic
// projection-branch length on the chart (the trial fork's own Monthly/
// Annual display, and the paid-plan downgrade projection's visual end) —
// never for an actual charged amount or committed date, which always come
// from the verified backend contract (previewPlanUpgrade / currentPeriodEnd).
export function addBillingCycle(date, cycle) {
  const next = new Date(date);
  if (cycle === 'monthly') next.setMonth(next.getMonth() + 1);
  else next.setFullYear(next.getFullYear() + 1);
  return next;
}

// Splits a chronological list of paid-plan segments (buildPaidPlanSegments'
// own output) into one group per DISTINCT plan tier the org has ever been
// on, ordered highest-rank-first (Business top) — found necessary live: a
// single shared "Subscription" row put Starter -> Growth -> Business
// segments end-to-end on one flat line, with no visual sense of "this was
// an upgrade" versus "this was a downgrade." A `tone: 'none'` segment (the
// terminal "No active subscription" notice) has no real plan of its own —
// it's attached to whichever tier the org was LAST actually on, so it
// keeps rendering as a continuation of that same lane rather than
// inventing a lane for "Action required".
export function groupPaidSegmentsByTier(paidSegments) {
  const real = (paidSegments || []).filter((s) => s.tone !== 'none');
  const lapsedNotice = (paidSegments || []).find((s) => s.tone === 'none');

  const groups = new Map(); // planName -> segments[]
  for (const seg of real) {
    const key = (seg.planName || 'unknown').toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(seg);
  }

  const ordered = Array.from(groups.entries())
    .map(([planName, segments]) => ({ planName, rank: PLAN_TIER_RANK[planName] ?? 0, segments }))
    .sort((a, b) => b.rank - a.rank);

  if (lapsedNotice) {
    // Attach to whichever tier the org was CHRONOLOGICALLY last actually
    // on, not the highest-rank tier it ever touched — found in a self-check
    // before this shipped: an org that went Starter -> Growth -> Business ->
    // back down to Growth, then lapsed, must show the lapse continuing on
    // Growth's row (where it actually ended up), not jump back onto
    // Business's row just because Business ranks higher. `real` is already
    // chronological (buildPaidPlanSegments' own ordering), so its last
    // element is that actual final tier.
    const lastRealPlanName = (real[real.length - 1]?.planName || '').toLowerCase();
    const target = ordered.find((g) => g.planName === lastRealPlanName) || ordered[0];
    if (target) target.segments = [...target.segments, lapsedNotice];
    else ordered.push({ planName: lapsedNotice.planName, rank: 0, segments: [lapsedNotice] });
  }

  return ordered;
}

// 24 added so the Annual branch's own renewal date has somewhere to land —
// at 12M zoom, a handle dragged anywhere past early in the trial pushes the
// Annual branch's +1-year end past the visible range, so it always shows
// clipped with no renewal date. 2Y exists specifically to show that limit.
const ZOOM_DAYS = { 1: 30, 3: 90, 6: 182, 12: 365, 24: 730 };

// No content-based cap on `end` here — the 3M/6M/1Y control must always do
// what it says, for every org, trial or not (a previous version capped the
// range at a trial's end date regardless of the selected zoom, which fixed
// one complaint — too much empty space by default — by silently breaking
// another: the zoom buttons stopped doing anything at all). The fix for
// "too much empty space for a short trial" belongs at the DEFAULT zoom
// level the caller picks, not by overriding the user's explicit choice.
export function computeCalendarRange(zoomMonths, now, earliestStart) {
  const horizonDays = ZOOM_DAYS[zoomMonths] || 90;
  const fallbackStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const start = earliestStart && earliestStart < now ? new Date(earliestStart) : fallbackStart;
  const end = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  return { start, end };
}

const BASE_PLAN_CHANGE_TYPES = [
  'SUBSCRIPTION_ACTIVATED',
  'SUBSCRIPTION_CREATED',
  'TRIAL_ENDED',
  'PLAN_UPGRADE',
  'PLAN_DOWNGRADE',
  'BILLING_CYCLE_CHANGE_COMPLETED',
];

const BASE_PLAN_MARKER_TYPES = [
  'PAYMENT_SUCCESS',
  'RENEWAL',
  'PLAN_UPGRADE',
  'PLAN_DOWNGRADE',
  'BILLING_CYCLE_CHANGE_COMPLETED',
  'SUBSCRIPTION_CANCELLED',
  'SCHEDULE_CANCELLED',
  // Super-admin trial actions (extend/shorten/end-early) now emit these —
  // without listing them here they'd have a real BillingEvent but never
  // show up as a marker on the Plan track, exactly the "invisible admin
  // change" gap that was flagged and just fixed on the backend.
  'TRIAL_ENDED',
  'TRIAL_ADJUSTED',
];

// Trial and paid subscription are different concepts, not one shared lane —
// forcing a trial-then-converted org's whole life through a single track
// is exactly what produced the trial-vs-paid overlap bug (a stale
// SUBSCRIPTION_CREATED anchoring the "current" segment's start almost on
// top of the trial's own start). Two tracks now: buildTrialTrackSegments
// (historical foundation, always below) and buildPaidPlanSegments (the
// dominant, primary track once any paid entitlement exists). See
// BillingCalendarTimeline.jsx's Track ordering for how these render.
//
// buildPaidPlanSegments is called FIRST so its earliest real start can tell
// buildTrialTrackSegments exactly when the trial's real end was — the
// moment the org actually converted, which is often NOT recorded by any
// single event (TRIAL_ENDED never fires on a live conversion; only cron/
// admin-driven endings emit it).
export function buildPaidPlanSegments(history, projection) {
  const segments = [];
  const completed = (history || []).filter((e) => e.status === 'completed');

  // Change Events (Historical states)
  const changeEvents = completed
    .filter((e) => BASE_PLAN_CHANGE_TYPES.includes(e.eventType) && e.afterSnapshot?.planName)
    .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));

  // Collapse a RUN of consecutive events that land on the SAME plan+cycle
  // down to its LAST event — found live: a trial conversion emits BOTH
  // SUBSCRIPTION_CREATED (the moment the user clicks Subscribe, payment
  // still pending) and SUBSCRIPTION_ACTIVATED (once payment actually
  // confirms), and both carry the same afterSnapshot.planName/billingCycle.
  // Pushing one segment per event produced two adjacent, identically-
  // labeled "Growth · Monthly" chips for what is really ONE plan the org
  // has been on the whole time.
  //
  // Keeping the run's LAST event (not its first) matters beyond that cosmetic
  // fix — found on a real org with a messier history: SUBSCRIPTION_CREATED
  // is only ever emitted ONCE per Subscription document (guarded in
  // updateSubscription's trial-conversion branch, `alreadyRecorded`), so an
  // org that clicked Subscribe on Growth, switched to Starter, then actually
  // completed the ORIGINAL Growth payment days later (see the CAW
  // registration-link reconciliation fix) has its one-and-only
  // SUBSCRIPTION_CREATED sitting near the very first attempt, with a real
  // (but never separately recorded, because of that same guard) Starter-
  // pending stretch in between it and the eventual SUBSCRIPTION_ACTIVATED.
  // Both events still read afterSnapshot.planName: 'growth', so they still
  // collapse into one run — but taking the run's FIRST event as the
  // boundary anchored the "current" segment's start at that old, stale
  // date, landing it right on top of the trial segment. The run's LAST
  // event — the most recent transition into this exact state — is the only
  // date in a possibly-gappy history that's safe to trust as "since when".
  const planBoundaryEvents = changeEvents.filter((e, i) => {
    const next = changeEvents[i + 1];
    if (!next) return true;
    return e.afterSnapshot.planName !== next.afterSnapshot.planName
      || e.afterSnapshot.billingCycle !== next.afterSnapshot.billingCycle;
  });

  for (let i = 0; i < planBoundaryEvents.length; i++) {
    const e = planBoundaryEvents[i];
    const next = planBoundaryEvents[i + 1];
    
    // Check if this was a cancellation
    if (e.eventType === 'SUBSCRIPTION_CANCELLED') {
       segments.push({
         tone: 'past',
         start: new Date(e.occurredAt),
         end: new Date(e.occurredAt),
         planName: e.afterSnapshot.planName,
         billingCycle: e.afterSnapshot.billingCycle,
         label: 'Cancelled',
       });
       continue;
    }

    segments.push({
      tone: 'past',
      start: new Date(e.occurredAt),
      end: next ? new Date(next.occurredAt) : null,
      planName: e.afterSnapshot.planName,
      billingCycle: e.afterSnapshot.billingCycle,
      pricePerUser: e.afterSnapshot.pricePerUser,
      label: e.summary?.title || e.afterSnapshot.planName,
    });
  }

  const scheduledPlanChange = (projection?.scheduledChanges || []).find(
    (c) => c.type === 'PLAN_CHANGE' || c.type === 'BILLING_CYCLE_CHANGE'
  );
  
  const currentBoundary =
    scheduledPlanChange?.effectiveAt ||
    projection?.basePlan?.entitlementWindow?.end ||
    projection?.basePlan?.nextRenewal?.date ||
    projection?.basePlan?.current?.periodEnd ||
    null;

  const isCommittedPaid = !!(projection?.basePlan?.entitlementWindow || (projection?.basePlan?.nextRenewal && !projection?.trial?.active));
  
  if (segments.length === 0 && isCommittedPaid) {
    segments.push({
      tone: 'current',
      start: projection.basePlan.current.periodStart || projection.now,
      end: currentBoundary,
      planName: projection.basePlan.current.planName,
      billingCycle: projection.basePlan.current.billingCycle,
      pricePerUser: projection.basePlan.current.pricePerUser,
      label: projection.basePlan.current.planName,
    });
  } else if (segments.length > 0) {
    const last = segments[segments.length - 1];
    if (last.tone !== 'trial' && last.end == null) {
      if (isCommittedPaid) {
         last.tone = 'current';
         last.end = currentBoundary;
      } else {
         last.end = new Date(projection.now);
      }
    }
  }

  if (scheduledPlanChange && isCommittedPaid) {
    segments.push({
      tone: 'scheduled',
      start: new Date(scheduledPlanChange.effectiveAt),
      end: null,
      planName: scheduledPlanChange.payload?.planId || projection.basePlan.current.planName,
      billingCycle: scheduledPlanChange.payload?.billingCycle || projection.basePlan.current.billingCycle,
      pricePerUser: scheduledPlanChange.payload?.pricePerUser,
      label: 'Scheduled Change',
    });
  }

  // Only a GENUINE lapse — no paid plan ever committed AND the trial isn't
  // currently active — earns the "Action required" terminal segment.
  // `veryLast.end != null` alone is NOT enough: the trial segment always
  // carries a defined `end` (trial.endsAt), even while still active, so
  // checking only for a defined end fires this the instant a trial starts
  // (found live — screenshot showed "No active subscription" appearing
  // immediately next to "Free Trial", both marked "you are here", on day
  // one of a 7-day trial). A super admin can also start/extend/end a trial
  // at any time (superAdminController.js) — none of that writes
  // BillingEvent history, it mutates the Subscription document directly,
  // so `projection.trial.active`/`endsAt` (read fresh on every fetch) is
  // already correct for any such change without special-casing it here.
  const veryLast = segments[segments.length - 1];
  const genuinelyLapsed = !isCommittedPaid && !projection?.trial?.active;
  if (veryLast && veryLast.end != null && !scheduledPlanChange && genuinelyLapsed) {
      segments.push({
        tone: 'none',
        start: new Date(veryLast.end),
        end: null,
        label: 'No active subscription',
        planName: 'Action required'
      });
  }

  return segments;
}

// The trial's own track — historical foundation, always rendered (never
// deleted once a paid plan exists). `paidSegments` (buildPaidPlanSegments'
// own output, computed first by the caller) is what lets this compute the
// trial's REAL end on conversion: TRIAL_ENDED is never emitted by a live
// trial→paid conversion (only cron/admin-driven endings emit it — see
// subscriptionLifecycleJobs.js/superAdminController.js), so without this,
// the trial segment either ran open-ended forever or fell back to a flat
// "+7 days" guess that had nothing to do with when the org actually
// converted.
export function buildTrialTrackSegments(history, projection, paidSegments = []) {
  const completed = (history || []).filter((e) => e.status === 'completed');
  const trialStarted = completed.find((e) => e.eventType === 'TRIAL_STARTED');
  const trialEnded = completed.find((e) => e.eventType === 'TRIAL_ENDED');

  if (!trialStarted && !projection?.trial?.active) return { segments: [], convertedAt: null };

  const trialPlan = trialEnded?.beforeSnapshot?.planName || projection?.basePlan?.current?.planName;
  const trialCycle = trialEnded?.beforeSnapshot?.billingCycle || projection?.basePlan?.current?.billingCycle;

  // The earliest real paid entitlement — a genuine conversion moment, not a
  // stale/superseded attempt (buildPaidPlanSegments already resolved that).
  const firstPaidSegment = paidSegments.find((s) => s.tone !== 'none') || null;

  let trialEndDate = null;
  let convertedAt = null;
  if (trialEnded) {
    // A real cron/admin-driven end DID happen — trust it even if a paid
    // plan exists later (e.g. the org subscribed again after lapsing).
    trialEndDate = new Date(trialEnded.occurredAt);
  } else if (firstPaidSegment) {
    trialEndDate = new Date(firstPaidSegment.start);
    convertedAt = trialEndDate;
  } else if (projection?.trial?.active) {
    trialEndDate = new Date(projection.trial.endsAt);
  } else if (trialStarted) {
    trialEndDate = new Date(new Date(trialStarted.occurredAt).getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  return {
    segments: [{
      tone: 'trial',
      start: trialStarted ? new Date(trialStarted.occurredAt) : new Date(projection.trial.startsAt),
      end: trialEndDate,
      planName: trialPlan,
      billingCycle: trialCycle,
      label: 'Free Trial',
    }],
    convertedAt,
  };
}

const TRIAL_MARKER_TYPES = ['TRIAL_ADJUSTED', 'TRIAL_ENDED'];

export function buildTrialTrackMarkers(history, projection, convertedAt) {
  const past = (history || [])
    .filter((e) => e.status === 'completed' && TRIAL_MARKER_TYPES.includes(e.eventType))
    .map((e) => ({
      tone: 'past',
      date: e.occurredAt,
      title: e.summary?.title,
      subtitle: e.summary?.subtitle,
      detail: e.summary?.detail,
      amount: e.amounts?.paid ?? null,
      eventType: e.eventType,
      metadata: e.metadata,
    }));

  const isCommittedPaid = !!(projection?.basePlan?.entitlementWindow || (projection?.basePlan?.nextRenewal && !projection?.trial?.active));

  const future = !isCommittedPaid
    ? (projection?.upcomingEvents || [])
        .filter((e) => e.type === 'trial_end')
        .map((e) => ({
          tone: e.priority === 'critical' ? 'critical' : 'scheduled',
          date: e.date,
          title: e.title,
          subtitle: e.description,
          amount: e.amount,
          type: e.type,
        }))
    : [];

  // Synthetic "Converted" marker — there is no real BillingEvent for this
  // moment (see buildTrialTrackSegments' own comment), so it's constructed
  // here rather than read from history. Only added when the trial's end was
  // actually DERIVED from a real conversion (convertedAt set), not for a
  // genuine cron/admin-driven end (trialEnded already gives that its own,
  // real marker via TRIAL_MARKER_TYPES above).
  const converted = convertedAt
    ? [{ tone: 'past', date: convertedAt.toISOString(), title: 'Converted to paid plan', subtitle: undefined, type: 'converted' }]
    : [];

  return [...past, ...future, ...converted].sort((a, b) => new Date(a.date) - new Date(b.date));
}

const PAID_MARKER_TYPES = [
  'PAYMENT_SUCCESS',
  'RENEWAL',
  'PLAN_UPGRADE',
  'PLAN_DOWNGRADE',
  'BILLING_CYCLE_CHANGE_COMPLETED',
  'SUBSCRIPTION_CANCELLED',
  'SCHEDULE_CANCELLED',
];

export function buildPaidPlanMarkers(history, projection) {
  const past = (history || [])
    .filter((e) => e.status === 'completed' && PAID_MARKER_TYPES.includes(e.eventType))
    .map((e) => ({
      tone: 'past',
      date: e.occurredAt,
      title: e.summary?.title,
      subtitle: e.summary?.subtitle,
      detail: e.summary?.detail,
      amount: e.amounts?.paid ?? null,
      eventType: e.eventType,
      metadata: e.metadata,
    }));

  const isCommittedPaid = !!(projection?.basePlan?.entitlementWindow || (projection?.basePlan?.nextRenewal && !projection?.trial?.active));

  const future = (projection?.upcomingEvents || [])
    .filter((e) => ['base_renewal', 'plan_change', 'billing_cycle_change', 'cancellation'].includes(e.type))
    .filter((e) => {
        if (!isCommittedPaid && e.type === 'base_renewal') return false;
        return true;
    })
    .map((e) => ({
      tone: e.priority === 'critical' ? 'critical' : 'scheduled',
      date: e.date,
      title: e.title,
      subtitle: e.description,
      amount: e.amount,
      type: e.type
    }));

  return [...past, ...future].sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function buildAddonSegments(addon, horizonEnd) {
  // An ongoing add-on's bar must stop at its own next renewal, same as the
  // base plan segment does — found live: it was stretching all the way to
  // the chart's visible horizon (range.end, whatever the zoom happens to
  // be) instead, making a monthly add-on's bar look like it ran far longer
  // than the monthly plan it's billed alongside, even though the
  // projection already carries the real renewal date
  // (addon.current.nextRenewal.date — the exact same date the base plan
  // itself renews on). Falls back to horizonEnd only if that field is
  // ever missing, rather than leaving the bar with no end at all.
  const ongoingEnd = addon.current.nextRenewal?.date
    ? new Date(addon.current.nextRenewal.date)
    : horizonEnd;
  const segments = [{
    tone: 'current',
    start: new Date(addon.current.addedAt),
    end: addon.scheduled ? new Date(addon.scheduled.effectiveAt) : ongoingEnd,
    quantity: addon.current.quantity,
  }];
  if (addon.scheduled) {
    segments.push({
      tone: 'scheduled',
      start: new Date(addon.scheduled.effectiveAt),
      end: horizonEnd,
      quantity: addon.scheduled.quantity,
    });
  }
  return segments;
}

export function buildAddonLanes(projection, horizonEnd) {
  if (!projection) return [];
  const toLane = (addon, cycle) => ({
    key: `${addon.addonKey}-${cycle}`,
    name: addon.name,
    cycle,
    currentQuantity: addon.current.quantity,
    scheduled: addon.scheduled,
    segments: buildAddonSegments(addon, horizonEnd),
  });
  return [
    ...(projection.addons?.monthly || []).map((a) => toLane(a, 'monthly')),
    ...(projection.addons?.annual || []).map((a) => toLane(a, 'yearly')),
  ];
}

export function findEarliestStart(history, projection) {
  if (!projection) return null;
  const candidates = [
    ...(history || []).filter((e) => e.status === 'completed').map((e) => e.occurredAt),
    projection.trial?.active ? projection.trial.startsAt : null,
    projection.basePlan?.current?.periodStart,
    ...(projection.addons?.monthly || []).map((a) => a.current.addedAt),
    ...(projection.addons?.annual || []).map((a) => a.current.addedAt),
  ].filter(Boolean).map((d) => new Date(d));
  return candidates.length ? new Date(Math.min(...candidates.map((d) => d.getTime()))) : null;
}
