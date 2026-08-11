import React, { useEffect, useMemo, useState } from "react";
import { X, Calendar, AlertTriangle } from "lucide-react";
import { subscriptionAPI } from "../../services/subscriptionApi";
import { formatPrice } from "../../utils/pricingSnapshot";
import BillingCalendarTimeline from "./BillingCalendarTimeline";
import {
  computeCalendarRange, buildBasePlanSegments, buildBasePlanMarkers, buildAddonLanes, findEarliestStart,
} from "../../utils/billingCalendarSegments";

const prettyPlan = (name) => (name ? name.charAt(0).toUpperCase() + name.slice(1) : name);
const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—");

const ZOOM_OPTIONS = [
  { months: 3, label: "3M" },
  { months: 6, label: "6M" },
  { months: 12, label: "1Y" },
];

const Skeleton = () => (
  <div className="p-6 space-y-4 animate-pulse">
    <div className="h-6 bg-gray-100 rounded w-1/3" />
    <div className="h-40 bg-gray-100 rounded" />
    <div className="h-16 bg-gray-100 rounded" />
  </div>
);

const ComingUpPanel = ({ events, isCommittedPaid, trialEndsAt }) => {
  if (!events || events.length === 0) {
    if (!isCommittedPaid && trialEndsAt) {
      return (
        <div className="mt-8 border-t border-gray-100 pt-8 px-10 pb-8 bg-gray-50/50">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-6">Coming Up</h3>
          <p className="text-sm font-bold text-gray-900 mb-1">{formatDate(trialEndsAt)}</p>
          <div className="flex items-start gap-3 mt-2">
            <span className="w-2.5 h-2.5 mt-1.5 rounded-full bg-blue-500" />
            <div>
              <p className="text-sm font-bold text-gray-900 uppercase tracking-wide">Free Trial Ends</p>
              <p className="text-sm text-gray-600 mt-1">Your free trial ends on {formatDate(trialEndsAt)}.</p>
              <p className="text-sm text-gray-600 mt-1">No paid subscription is currently scheduled.<br/>Choose a plan to continue after the trial.</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="mt-8 border-t border-gray-100 pt-8 px-10 pb-8 bg-gray-50/50">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-4">Coming Up</h3>
        <p className="text-sm text-gray-500">You're all set. No plan changes or add-on changes are scheduled.</p>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t border-gray-100 pt-8 px-10 pb-10 bg-gray-50/50">
      <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-6">Coming Up</h3>
      <div className="space-y-8">
        {events.slice(0, 3).map((e, i) => (
          <div key={i}>
            <p className="text-sm font-bold text-gray-900 mb-2">{formatDate(e.date)}</p>
            <div className="flex items-start gap-3">
              <span className={`w-2.5 h-2.5 mt-1.5 rounded-full shadow-sm ${e.priority === 'critical' ? 'bg-amber-500' : 'bg-gray-400'}`} />
              <div>
                <p className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  {e.title} {e.amount != null && <span className="ml-3 px-2 py-1 bg-white border border-gray-200 text-gray-800 rounded-md shadow-sm text-xs">{formatPrice(e.amount)}</span>}
                </p>
                <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{e.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const InspectorCard = ({ event, onClear }) => (
  <div className="mt-8 border-t border-gray-100 pt-8 px-10 pb-10 relative bg-indigo-50/30">
    <button onClick={onClear} className="absolute top-8 right-8 p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors" aria-label="Close detail">
      <X className="w-5 h-5" />
    </button>
    <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-6">Event Details</h3>
    <p className="text-sm font-bold text-gray-900 mb-1">{formatDate(event.date)}</p>
    <p className="text-xl font-black text-gray-900 mt-2 tracking-tight">{event.title}</p>
    {event.subtitle && <p className="text-base text-gray-700 mt-2 font-medium">{event.subtitle}</p>}
    {event.detail && <div className="mt-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm"><p className="text-sm text-gray-600 leading-relaxed">{event.detail}</p></div>}
    {event.amount != null && (
      <div className="mt-5 inline-block bg-white border border-gray-200 px-4 py-3 rounded-xl shadow-sm">
        <p className="text-base font-black text-gray-900">{formatPrice(event.amount)} <span className="text-sm text-gray-500 font-medium ml-1">amount</span></p>
      </div>
    )}
  </div>
);

const BillingCalendarModal = ({ isOpen, onClose }) => {
  const [projection, setProjection] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [zoomMonths, setZoomMonths] = useState(6);
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
    setZoomMonths(6);
    load();
  }, [isOpen]);

  const p = projection?.hasSubscription || projection?.trial?.active ? projection : null;

  const calendarData = useMemo(() => {
    if (!p) return null;
    const now = new Date(p.now);
    const earliestStart = findEarliestStart(history, p);
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

  const isCommittedPaid = !!(p?.basePlan?.entitlementWindow || (p?.basePlan?.nextRenewal && !p?.trial?.active));

  return (
    <div className="fixed inset-0 z-[100005] flex items-center justify-center p-6 bg-black/50 backdrop-blur-md">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[1400px] h-[92vh] overflow-hidden flex flex-col border border-gray-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-10 py-5 border-b border-gray-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-black text-gray-900 tracking-tight">Billing Calendar</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 bg-white">
          {loading && <Skeleton />}

          {!loading && error && (
            <div className="p-16 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <p className="text-lg font-bold text-gray-900">We couldn't load your billing calendar.</p>
              <button onClick={load} className="mt-6 text-sm font-bold text-indigo-600 hover:underline px-4 py-2 bg-indigo-50 rounded-lg">Try again</button>
            </div>
          )}

          {!loading && !error && !p && (
            <div className="p-16 text-center text-gray-500 font-medium">No active subscription yet.</div>
          )}

          {!loading && !error && p && calendarData && (
            <div className="flex flex-col h-full">
              
              {/* Identity & Context */}
              <div className="px-10 py-8 flex flex-wrap items-start justify-between gap-6">
                <div>
                  <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
                    {prettyPlan(p.basePlan.current.planName)} {isCommittedPaid ? `· ${p.basePlan.current.billingCycle === 'yearly' ? 'Annual' : 'Monthly'}` : '· Trial'}
                    {!isCommittedPaid && p.trial.active ? (
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-100 px-2.5 py-1 rounded-sm ml-2">Trial Active</span>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-sm ml-2">Active Now</span>
                    )}
                  </h1>
                  
                  {isCommittedPaid ? (
                    <>
                      <p className="text-lg font-bold text-gray-800 mt-2">{formatPrice(p.basePlan.current.pricePerUser)} <span className="text-sm font-medium text-gray-500">/ {p.basePlan.current.billingCycle === 'yearly' ? 'year' : 'month'}</span></p>
                      <p className="text-sm font-medium text-gray-500 mt-1">
                        {p.basePlan.entitlementWindow ? `Paid through ${formatDate(p.basePlan.entitlementWindow.end)}` : p.basePlan.nextRenewal ? `Next renewal ${formatDate(p.basePlan.nextRenewal.date)}` : ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-gray-800 mt-2">₹0 <span className="text-sm font-medium text-gray-500">/ month</span></p>
                      <p className="text-sm font-medium text-gray-500 mt-1">Free trial ends {formatDate(p.trial.endsAt)}</p>
                    </>
                  )}
                </div>
                
                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-gray-100 rounded p-1">
                  {ZOOM_OPTIONS.map((z) => (
                    <button
                      key={z.months}
                      onClick={() => setZoomMonths(z.months)}
                      className={`px-4 py-1.5 text-xs font-black tracking-widest rounded transition-all ${
                        zoomMonths === z.months ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      {z.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* State-Only Journey Strip */}
              <div className="px-10 pb-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Your Billing Journey</p>
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-600">
                  {calendarData.basePlanSegments.filter(s => s.tone !== 'scheduled').map((seg, idx, arr) => {
                    const isLast = idx === arr.length - 1;
                    const isCurrent = seg.tone === 'current' || seg.tone === 'none' || (!isCommittedPaid && seg.tone === 'trial');
                    
                    // The journey should show the pure state plan name, not event labels
                    let displayName = prettyPlan(seg.planName);
                    if (seg.tone === 'trial') displayName = 'Free Trial';
                    else if (seg.tone === 'none') displayName = 'No active subscription';
                    else if (seg.billingCycle) displayName += ` · ${seg.billingCycle === 'yearly' ? 'Annual' : 'Monthly'}`;

                    return (
                      <React.Fragment key={idx}>
                        <div className={`flex flex-col items-center relative ${isCurrent ? 'text-indigo-700' : ''}`}>
                          <span>{displayName}</span>
                          {isCurrent && <span className="absolute -bottom-5 text-[9px] font-black uppercase tracking-widest text-indigo-500 whitespace-nowrap">↑ You are here</span>}
                        </div>
                        {!isLast && <span className="mx-3 text-gray-300">→</span>}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* The Calendar Itself */}
              <div className="flex-1 px-8 relative mt-2 border-t border-gray-100 pt-6">
                <BillingCalendarTimeline
                  now={calendarData.now}
                  range={calendarData.range}
                  basePlanSegments={calendarData.basePlanSegments}
                  basePlanMarkers={calendarData.basePlanMarkers}
                  addonLanes={calendarData.addonLanes}
                  onSelectEvent={setSelectedEvent}
                />
              </div>

              {/* Inspector or Upcoming */}
              {selectedEvent ? (
                <InspectorCard event={selectedEvent} onClear={() => setSelectedEvent(null)} />
              ) : (
                <ComingUpPanel events={p.upcomingEvents} isCommittedPaid={isCommittedPaid} trialEndsAt={p.trial?.active ? p.trial.endsAt : null} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillingCalendarModal;
