// utils/billingCalendarSegments.js

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

export function buildBasePlanSegments(history, projection) {
  const segments = [];
  const completed = (history || []).filter((e) => e.status === 'completed');

  const trialStarted = completed.find((e) => e.eventType === 'TRIAL_STARTED');
  const trialEnded = completed.find((e) => e.eventType === 'TRIAL_ENDED');
  
  // Trial State
  if (trialStarted || projection?.trial?.active) {
    const trialPlan = trialEnded?.beforeSnapshot?.planName || projection?.basePlan?.current?.planName;
    const trialCycle = trialEnded?.beforeSnapshot?.billingCycle || projection?.basePlan?.current?.billingCycle;
    
    // If trial ended in history, use that. If active, use endsAt. Otherwise, use started + 7 days as a fallback.
    let trialEndStr = null;
    if (trialEnded) trialEndStr = trialEnded.occurredAt;
    else if (projection?.trial?.active) trialEndStr = projection.trial.endsAt;
    else if (trialStarted) trialEndStr = new Date(new Date(trialStarted.occurredAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    segments.push({
      tone: 'trial',
      start: trialStarted ? new Date(trialStarted.occurredAt) : new Date(projection.trial.startsAt),
      end: trialEndStr ? new Date(trialEndStr) : null,
      planName: trialPlan,
      billingCycle: trialCycle,
      label: 'Free Trial',
    });
  }

  // Change Events (Historical states)
  const changeEvents = completed
    .filter((e) => BASE_PLAN_CHANGE_TYPES.includes(e.eventType) && e.afterSnapshot?.planName)
    .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));

  for (let i = 0; i < changeEvents.length; i++) {
    const e = changeEvents[i];
    const next = changeEvents[i + 1];
    
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

export function buildBasePlanMarkers(history, projection) {
  const past = (history || [])
    .filter((e) => e.status === 'completed' && BASE_PLAN_MARKER_TYPES.includes(e.eventType))
    .map((e) => ({
      tone: 'past',
      date: e.occurredAt,
      title: e.summary?.title,
      subtitle: e.summary?.subtitle,
      detail: e.summary?.detail,
      amount: e.amounts?.paid ?? null,
      // Passed through so the renderer can give admin trial actions a
      // visually distinct treatment (a +/-N day badge) instead of the
      // same plain dot every other marker gets — these change a boundary
      // date, not a one-off event, and reading like "just another dot" is
      // exactly what made a real trial-shortening easy to miss.
      eventType: e.eventType,
      metadata: e.metadata,
    }));

  const isCommittedPaid = !!(projection?.basePlan?.entitlementWindow || (projection?.basePlan?.nextRenewal && !projection?.trial?.active));

  const future = (projection?.upcomingEvents || [])
    .filter((e) => ['trial_end', 'base_renewal', 'plan_change', 'billing_cycle_change', 'cancellation'].includes(e.type))
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
  const segments = [{
    tone: 'current',
    start: new Date(addon.current.addedAt),
    end: addon.scheduled ? new Date(addon.scheduled.effectiveAt) : horizonEnd,
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
