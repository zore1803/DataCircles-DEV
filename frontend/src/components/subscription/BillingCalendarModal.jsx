// components/subscription/BillingCalendarModal.jsx
//
// Billing Calendar — a state-over-time visualization of the subscription's
// billing lifecycle. This is NOT the Billing Timeline (an event log; see
// BillingTimeline.jsx) rendered in a modal:
//
//   Timeline  — event-centric: "Trial started. Starter selected. Seat
//               added. Growth upgrade. Annual switch." (what happened)
//   Calendar  — state-centric: a Plan track that IS a trial segment, then
//               a Starter segment, then a Growth segment, laid out against
//               a real date axis with a TODAY marker — nothing disappears
//               when the state changes, it just becomes the next segment.
//
// Visual language matches the rest of Settings (BillingSidebar.jsx,
// CurrentSubscriptionInfo.jsx): white rounded-2xl cards, gray-200 borders,
// blue-600 as the one accent color, font-bold (not font-black) headings,
// text-xs uppercase tracking-wider gray-400 section labels. This was
// previously drifting into its own invented visual system (indigo,
// font-black, tracking-widest everywhere) that didn't match anything else
// in the app.
//
// Segment/marker construction lives in utils/billingCalendarSegments.js
// (pure, presentational only — no proration, no renewal-date arithmetic).
// Both inputs it consumes are already canonical: GET /subscription/
// billing-events (history) and GET /subscription/billing-projection
// (current + scheduled + upcoming — backend/utils/billingProjection.js).
import React, { useEffect, useMemo, useState } from "react";
import { X, Calendar, AlertTriangle, Gift } from "lucide-react";
import { subscriptionAPI } from "../../services/subscriptionApi";
import { formatPrice } from "../../utils/pricingSnapshot";
import BillingCalendarTimeline from "./BillingCalendarTimeline";
import {
  computeCalendarRange, buildBasePlanSegments, buildBasePlanMarkers, buildAddonLanes, findEarliestStart,
} from "../../utils/billingCalendarSegments";

const prettyPlan = (name) => (name ? name.charAt(0).toUpperCase() + name.slice(1) : name);
const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

// Presentational rounding only (floor to whole days remaining) — `now` and
// `endsAt` both come straight from the projection, nothing computed or
// inferred beyond how many full days sit between them.
function trialCountdown(now, endsAt) {
  if (!now || !endsAt) return null;
  const msLeft = new Date(endsAt).getTime() - new Date(now).getTime();
  if (msLeft <= 0) return { label: "Trial ended", urgent: true };
  const fullDaysLeft = Math.floor(msLeft / (24 * 60 * 60 * 1000));
  if (fullDaysLeft === 0) return { label: "Ends today", urgent: true };
  if (fullDaysLeft === 1) return { label: "1 day left", urgent: true };
  return { label: `${fullDaysLeft} days left`, urgent: fullDaysLeft <= 2 };
}

// Trace finding: the header used to branch ONLY on isCommittedPaid, so once
// a trial ended (isTrialActive: false, appStatus: 'expired') it fell into
// the "else" of BOTH conditions below and rendered a green "Active" badge
// plus "Free trial ends {stale trialEnd date}" — a subscription that had
// definitively ended looked, at a glance, like a live countdown. This isn't
// a Calendar-specific bug; it's a missing third state (terminated-without-
// payment) that the header simply never accounted for. Reuses
// p.subscription.status (== the canonical appStatus, already on the
// projection payload) rather than re-deriving anything new.
const TERMINATED_COPY = {
  expired: { badge: 'Trial ended', headline: 'Your free trial has ended', cta: 'Choose a plan to continue' },
  cancelled: { badge: 'Cancelled', headline: 'Your subscription was cancelled', cta: 'Choose a plan to continue' },
  suspended: { badge: 'Suspended', headline: 'Your subscription is suspended', cta: 'Subscribe to restore access' },
};

const ZOOM_OPTIONS = [
  { months: 1, label: "1M" },
  { months: 3, label: "3M" },
  { months: 6, label: "6M" },
  { months: 12, label: "1Y" },
  { months: 24, label: "2Y" },
];

const Skeleton = () => (
  <div className="p-8 space-y-4 animate-pulse">
    <div className="h-5 bg-gray-100 rounded w-1/3" />
    <div className="h-28 bg-gray-100 rounded-xl" />
    <div className="h-16 bg-gray-100 rounded-xl" />
  </div>
);

const ComingUpPanel = ({ events, isCommittedPaid, trialEndsAt }) => {
  if (!events || events.length === 0) {
    if (!isCommittedPaid && trialEndsAt) {
      return (
        <div className="border-t border-gray-100 px-8 py-6 bg-gray-50/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Coming Up</h3>
          <div className="flex items-start gap-3">
            <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Free trial ends — {formatDate(trialEndsAt)}</p>
              <p className="text-xs text-gray-500 mt-1">No paid subscription is currently scheduled. Choose a plan to continue after the trial.</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="border-t border-gray-100 px-8 py-6 bg-gray-50/60">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Coming Up</h3>
        <p className="text-sm text-gray-500">Nothing else is scheduled.</p>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 px-8 py-6 bg-gray-50/60">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Coming Up</h3>
      <div className="space-y-4">
        {events.slice(0, 3).map((e, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${e.priority === 'critical' ? 'bg-amber-500' : 'bg-gray-300'}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {e.title} {e.amount != null && <span className="ml-1.5 px-1.5 py-0.5 bg-white border border-gray-200 text-gray-700 rounded text-[11px] font-semibold align-middle">{formatPrice(e.amount)}</span>}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{formatDate(e.date)}{e.description ? ` · ${e.description}` : ""}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const isAdminTrialAdjustment = (m) =>
  m.eventType === 'TRIAL_ADJUSTED' || (m.eventType === 'TRIAL_ENDED' && m.metadata?.endedBy === 'admin');

// Same physical spot and typography as ComingUpPanel — an admin adjustment
// is just another kind of event, so it uses the list language this Calendar
// already has rather than a one-off visual treatment on the chart itself
// (see AdjustmentOverlay in BillingCalendarTimeline.jsx). Scales cleanly:
// a third or fourth adjustment is just another row here, never another
// color crammed onto the trial bar.
const AdjustmentHistoryPanel = ({ markers }) => {
  const adjustments = (markers || []).filter(isAdminTrialAdjustment);
  if (adjustments.length === 0) return null;

  return (
    <div className="border-t border-gray-100 px-8 py-6 bg-gray-50/60">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Trial Adjustment History</h3>
      <div className="space-y-4">
        {adjustments.map((m, i) => {
          const { previousEnd, newEnd } = m.metadata || {};
          return (
            <div key={i} className="flex items-start gap-3">
              <span className="w-2 h-2 mt-1.5 rounded-full bg-gray-300 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900">{m.title || 'Trial adjusted'}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatDate(m.date)}
                  {previousEnd && newEnd ? ` · was ending ${formatDate(previousEnd)}, now ${formatDate(newEnd)}` : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const InspectorCard = ({ event, onClear }) => (
  <div className="border-t border-gray-100 px-8 py-6 bg-blue-50/40 relative">
    <button onClick={onClear} className="absolute top-5 right-5 p-1.5 hover:bg-white rounded-lg text-gray-400 transition-colors" aria-label="Close detail">
      <X className="w-4 h-4" />
    </button>
    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Event Details</h3>
    <p className="text-xs font-semibold text-gray-500">{formatDate(event.date)}</p>
    <p className="text-lg font-bold text-gray-900 mt-1">{event.title}</p>
    {event.subtitle && <p className="text-sm text-gray-600 mt-1">{event.subtitle}</p>}
    {event.detail && <div className="mt-3 bg-white p-3 rounded-lg border border-gray-200"><p className="text-sm text-gray-600">{event.detail}</p></div>}
    {event.amount != null && (
      <div className="mt-3 inline-block bg-white border border-gray-200 px-3 py-2 rounded-lg">
        <p className="text-sm font-bold text-gray-900">{formatPrice(event.amount)} <span className="text-xs text-gray-400 font-normal">amount</span></p>
      </div>
    )}
  </div>
);

const BillingCalendarModal = ({ isOpen, onClose }) => {
  const [projection, setProjection] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [zoomMonths, setZoomMonths] = useState(3);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const load = () => {
    setError(false);
    setLoading(true);
    Promise.all([
      subscriptionAPI.getBillingProjection(),
      subscriptionAPI.getBillingTimeline({ limit: 100 }),
    ])
      .then(([projRes, historyRes]) => {
        setProjection(projRes.data);
        setHistory(historyRes.data.events || []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isOpen) return;
    setProjection(null);
    setHistory([]);
    setSelectedEvent(null);
    setZoomMonths(3);
    load();
  }, [isOpen]);

  const p = projection?.hasSubscription || projection?.trial?.active ? projection : null;
  const isCommittedPaid = !!(p?.basePlan?.entitlementWindow || (p?.basePlan?.nextRenewal && !p?.trial?.active));
  // Third header state, alongside "paid" and "trialing" — a subscription
  // that has definitively ended (trial expired, or cancelled/suspended)
  // with nothing currently committed. TERMINATED_COPY above supplies the
  // reason-specific wording; the read-only access CONSEQUENCE is the same
  // for all three (subscriptionGate already treats them identically) but
  // the header should still say why, per the "access consequence shared,
  // reason specific" rule.
  const terminatedStatus = TERMINATED_COPY[p?.subscription?.status];
  const isTerminated = !isCommittedPaid && !p?.trial?.active && !!terminatedStatus;

  const calendarData = useMemo(() => {
    if (!p) return null;
    const now = new Date(p.now);
    const earliestStart = findEarliestStart(history, p);
    // 3M is the default zoom (see the useState/reset calls below) rather
    // than capping the range itself — capping the range broke the zoom
    // control (found live: 3M/6M/1Y all rendered identically for a trial,
    // because the cap silently overrode whatever the user picked). A
    // narrower default is enough to fix "too much empty space for a
    // 7-day trial" without making the buttons lie about what they do.
    const range = computeCalendarRange(zoomMonths, now, earliestStart);

    return {
      now,
      range,
      basePlanSegments: buildBasePlanSegments(history, p),
      basePlanMarkers: buildBasePlanMarkers(history, p),
      addonLanes: buildAddonLanes(p, range.end),
    };
  }, [p, history, zoomMonths]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100005] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[92rem] max-h-[94vh] overflow-hidden flex flex-col border border-gray-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">Billing Calendar</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Close">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading && <Skeleton />}

          {!loading && error && (
            <div className="p-12 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-900">We couldn't load your billing calendar.</p>
              <p className="text-xs text-gray-500 mt-1">Your subscription has not been changed.</p>
              <button onClick={load} className="mt-4 text-sm font-semibold text-blue-600 hover:underline">Try again</button>
            </div>
          )}

          {!loading && !error && !p && (
            <div className="p-12 text-center text-sm text-gray-500">No active subscription yet.</div>
          )}

          {!loading && !error && p && calendarData && (
            <div className="flex flex-col">

              {/* Summary + zoom */}
              <div className="px-8 pt-6 pb-2 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-gray-900">
                      {prettyPlan(p.basePlan.current.planName)}
                      <span className="text-gray-400 font-medium"> · {isCommittedPaid ? (p.basePlan.current.billingCycle === 'yearly' ? 'Annual' : 'Monthly') : 'Trial'}</span>
                    </h1>
                    {isTerminated ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                        {terminatedStatus.badge}
                      </span>
                    ) : !isCommittedPaid && p.trial.active ? (
                      (() => {
                        const countdown = trialCountdown(p.now, p.trial.endsAt);
                        return (
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                            countdown?.urgent
                              ? 'text-red-700 bg-red-50 border-red-200'
                              : 'text-blue-700 bg-blue-50 border-blue-200'
                          }`}>
                            {countdown ? countdown.label : 'Trial active'}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Active</span>
                    )}
                  </div>

                  {isTerminated ? (
                    <>
                      <p className="text-base font-semibold text-gray-800 mt-1.5">{terminatedStatus.headline}</p>
                      <p className="text-xs text-gray-500 mt-0.5">You can view existing data, but editing is disabled. {terminatedStatus.cta}.</p>
                    </>
                  ) : isCommittedPaid ? (
                    <>
                      <p className="text-base font-semibold text-gray-800 mt-1.5">{formatPrice(p.basePlan.current.pricePerUser)} <span className="text-xs font-normal text-gray-400">/ {p.basePlan.current.billingCycle === 'yearly' ? 'year' : 'month'}</span></p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {p.basePlan.entitlementWindow ? `Paid through ${formatDate(p.basePlan.entitlementWindow.end)}` : p.basePlan.nextRenewal ? `Next renewal ${formatDate(p.basePlan.nextRenewal.date)}` : ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-semibold text-gray-800 mt-1.5">₹0 <span className="text-xs font-normal text-gray-400">/ month</span></p>
                      <p className="text-xs text-gray-500 mt-0.5">Free trial ends {formatDate(p.trial.endsAt)}</p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                  {ZOOM_OPTIONS.map((z) => (
                    <button
                      key={z.months}
                      onClick={() => setZoomMonths(z.months)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                        zoomMonths === z.months ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {z.label}
                    </button>
                  ))}
                </div>
              </div>

              {p.trial.active && !isCommittedPaid && (
                <div className="mx-8 mt-3 flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <Gift className="w-3.5 h-3.5 flex-shrink-0" />
                  All {prettyPlan(p.basePlan.current.planName)} features are available during your trial. No charge unless you choose a plan.
                </div>
              )}

              {/* Billing journey strip */}
              <div className="px-8 pt-5 pb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Your Billing Journey</p>
                <div className="flex flex-wrap items-center gap-1 text-sm font-semibold text-gray-500">
                  {calendarData.basePlanSegments.filter(s => s.tone !== 'scheduled').map((seg, idx, arr) => {
                    const isLast = idx === arr.length - 1;
                    const isCurrent = idx === arr.length - 1;

                    let displayName = prettyPlan(seg.planName);
                    if (seg.tone === 'trial') displayName = 'Free Trial';
                    else if (seg.tone === 'none') displayName = 'No active subscription';
                    else if (seg.billingCycle) displayName += ` · ${seg.billingCycle === 'yearly' ? 'Annual' : 'Monthly'}`;

                    return (
                      <React.Fragment key={idx}>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${isCurrent ? 'text-blue-700 bg-blue-50' : ''}`}>
                          <span>{displayName}</span>
                          {isCurrent && <span className="text-[10px] font-bold uppercase tracking-wide text-blue-500">· now</span>}
                        </div>
                        {!isLast && <span className="text-gray-300 px-0.5">→</span>}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Calendar — the trial conversion fork (drag to explore
                  Monthly/Annual) lives directly on the Plan track here,
                  not as a separate widget below it. */}
              <div className="px-6 pt-4 pb-2 border-t border-gray-100 mt-3">
                {!isCommittedPaid && p.trial.active && (
                  <p className="text-xs text-gray-400 mb-1 pl-[104px]">
                    Drag the marker on Free Trial to see how a Monthly or Annual plan would begin.
                  </p>
                )}
                <BillingCalendarTimeline
                  now={calendarData.now}
                  range={calendarData.range}
                  basePlanSegments={calendarData.basePlanSegments}
                  basePlanMarkers={calendarData.basePlanMarkers}
                  addonLanes={calendarData.addonLanes}
                  onSelectEvent={setSelectedEvent}
                  trialEndsAt={!isCommittedPaid && p.trial.active ? p.trial.endsAt : null}
                />
              </div>

              {/* Inspector or Upcoming */}
              {selectedEvent ? (
                <InspectorCard event={selectedEvent} onClear={() => setSelectedEvent(null)} />
              ) : (
                <>
                  <ComingUpPanel events={p.upcomingEvents} isCommittedPaid={isCommittedPaid} trialEndsAt={p.trial?.active ? p.trial.endsAt : null} />
                  <AdjustmentHistoryPanel markers={calendarData.basePlanMarkers} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillingCalendarModal;
