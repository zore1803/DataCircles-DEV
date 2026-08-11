// utils/billingCalendarSegments.js

const ZOOM_DAYS = { 3: 90, 6: 182, 12: 365 };

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

  const veryLast = segments[segments.length - 1];
  if (veryLast && veryLast.end != null && !scheduledPlanChange) {
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
