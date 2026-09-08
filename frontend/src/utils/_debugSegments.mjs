import { buildPaidPlanSegments, buildTrialTrackSegments, computeCalendarRange, findEarliestStart } from './billingCalendarSegments.js';

const now = new Date('2026-08-27T06:32:51.328Z');

// REAL data, pulled directly from Mongo for this org.
const history = [
  { status: 'completed', eventType: 'SUBSCRIPTION_ACTIVATED', occurredAt: '2026-08-13T10:02:02.269Z', afterSnapshot: { planName: 'growth', billingCycle: 'monthly', pricePerUser: 450 } },
  { status: 'completed', eventType: 'SUBSCRIPTION_CREATED', occurredAt: '2026-08-13T09:25:10.836Z', afterSnapshot: { planName: 'growth', billingCycle: 'monthly', pricePerUser: 450 } },
  { status: 'completed', eventType: 'TRIAL_ADJUSTED', occurredAt: '2026-08-13T07:49:45.962Z', metadata: { previousEnd: '2026-08-21T07:47:59.537Z', newEnd: '2026-08-24T07:47:59.537Z' } },
  { status: 'completed', eventType: 'TRIAL_ADJUSTED', occurredAt: '2026-08-13T07:49:19.104Z', metadata: { previousEnd: '2026-08-20T07:47:59.537Z', newEnd: '2026-08-21T07:47:59.537Z' } },
  { status: 'completed', eventType: 'TRIAL_STARTED', occurredAt: '2026-08-13T07:47:59.630Z', afterSnapshot: { planName: 'growth', billingCycle: 'monthly', pricePerUser: 0 } },
];

const projection = {
  now: now.toISOString(),
  trial: { active: false, startsAt: '2026-08-13T07:47:59.537Z', endsAt: '2026-08-24T07:47:59.537Z' },
  basePlan: {
    current: { planName: 'growth', billingCycle: 'monthly', pricePerUser: 450, periodStart: '2026-08-13T10:02:01.770Z', periodEnd: '2026-09-13T10:02:01.770Z' },
    entitlementWindow: null,
    nextRenewal: { date: '2026-09-13T10:02:01.770Z' },
  },
  scheduledChanges: [],
  addons: { monthly: [], annual: [] },
};

const paidSegments = buildPaidPlanSegments(history, projection);
const { segments: trialSegments, convertedAt } = buildTrialTrackSegments(history, projection, paidSegments);
const earliestStart = findEarliestStart(history, projection);
const range = computeCalendarRange(3, now, earliestStart);

function pctManual(date) {
  if (!date) return null;
  const t = new Date(date).getTime();
  return ((t - range.start.getTime()) / (range.end.getTime() - range.start.getTime())) * 100;
}

console.log('paidSegments[0]:', paidSegments[0]);
console.log('trialSegments[0]:', trialSegments[0]);
console.log('range:', range);
console.log('trial width %:', pctManual(trialSegments[0].end) - pctManual(trialSegments[0].start));
console.log('trial start/end %:', pctManual(trialSegments[0].start), pctManual(trialSegments[0].end));
console.log('paid start/end %:', pctManual(paidSegments[0].start), pctManual(paidSegments[0].end));
console.log('today %:', pctManual(now));
console.log('total range days:', (range.end.getTime() - range.start.getTime()) / 86400000);
console.log('trial duration (real hours):', (new Date(trialSegments[0].end).getTime() - new Date(trialSegments[0].start).getTime()) / 3600000);
