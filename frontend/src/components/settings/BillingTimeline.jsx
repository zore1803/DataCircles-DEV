// components/settings/BillingTimeline.jsx
//
// Pure visualization layer over BillingEvent. Renders `event.summary`
// (title/subtitle/amountChange/detail) computed once on the backend at
// write time — this component never infers "what changed" from raw
// before/after snapshots itself, it only displays them on expand. Provider-
// agnostic: works identically whether the charge came from Razorpay
// Subscriptions, Charge at Will, or anything else, because it only reads
// events our own backend already decided to record.
import React, { useEffect, useState } from "react";
import {
  Clock, CheckCircle2, XCircle, CalendarClock, ChevronDown, ChevronUp,
  Rocket, ArrowUp, ArrowDown, Tag, Gift, Ban, RefreshCw, CreditCard,
} from "lucide-react";
import { subscriptionAPI } from "../../services/subscriptionApi";

const EVENT_ICONS = {
  SUBSCRIPTION_CREATED: Rocket,
  TRIAL_STARTED: Gift,
  TRIAL_ENDED: Gift,
  PLAN_UPGRADE: ArrowUp,
  PLAN_DOWNGRADE: ArrowDown,
  DOWNGRADE_SCHEDULED: CalendarClock,
  BILLING_CYCLE_CHANGE_SCHEDULED: CalendarClock,
  ADDON_ADDED: ArrowUp,
  ADDON_REMOVAL_SCHEDULED: CalendarClock,
  ADDON_REMOVED: ArrowDown,
  COUPON_APPLIED: Tag,
  COUPON_CHANGED: Tag,
  COUPON_REMOVED: Tag,
  PAYMENT_SUCCESS: CheckCircle2,
  PAYMENT_FAILED: XCircle,
  RENEWAL: RefreshCw,
  SUBSCRIPTION_CANCELLED: Ban,
};

const STATUS_STYLES = {
  completed: { dot: "bg-green-500", badge: "bg-green-50 text-green-700 border-green-200" },
  scheduled: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  failed: { dot: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200" },
  cancelled: { dot: "bg-gray-400", badge: "bg-gray-50 text-gray-600 border-gray-200" },
};

const prettyKey = (k) => (k || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const formatDateTime = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const SnapshotRow = ({ label, snapshot }) => {
  if (!snapshot) return null;
  return (
    <div className="text-xs text-gray-600">
      <span className="font-medium text-gray-500">{label}:</span>{" "}
      {prettyKey(snapshot.planName)}
      {snapshot.totalAmount != null && ` · ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(snapshot.totalAmount)}/${snapshot.billingCycle === "yearly" ? "yr" : "mo"}`}
      {snapshot.activeAddons?.length > 0 && ` · ${snapshot.activeAddons.map((a) => `${prettyKey(a.addonKey)}×${a.quantity}`).join(", ")}`}
      {snapshot.appliedCoupon?.code && ` · Coupon ${snapshot.appliedCoupon.code}`}
    </div>
  );
};

// A single connected line per event — dot, title, the facts that matter,
// inline. Expand reveals full snapshot/amount detail on demand; the default
// view is the story, not a stack of cards.
const TimelineEvent = ({ event, isLast }) => {
  const [expanded, setExpanded] = useState(false);
  const statusStyle = STATUS_STYLES[event.status] || STATUS_STYLES.completed;
  const summary = event.summary || {};
  const hasDetail = event.beforeSnapshot || event.afterSnapshot || event.payment?.razorpayPaymentId ||
    (event.amounts && Object.values(event.amounts).some((v) => v != null));

  return (
    <div className="relative pl-6">
      <div className={`absolute left-0.5 top-1.5 w-2 h-2 rounded-full ${statusStyle.dot}`} />
      {!isLast && <div className="absolute left-[5px] top-3.5 bottom-0 w-px bg-gray-200" />}

      <div className="pb-2.5">
        <button
          onClick={() => hasDetail && setExpanded((v) => !v)}
          className={`w-full text-left flex items-baseline gap-2 flex-wrap ${hasDetail ? "cursor-pointer group" : "cursor-default"}`}
        >
          <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">{summary.title}</span>
          {summary.subtitle && <span className="text-xs text-gray-500">{summary.subtitle}</span>}
          {summary.amountChange && <span className="text-xs font-medium text-gray-700">· {summary.amountChange}</span>}
          {summary.detail && <span className="text-xs text-gray-400">· {summary.detail}</span>}
          <span className="text-xs text-gray-400">· {formatDateTime(event.occurredAt)}</span>
          {event.status !== "completed" && (
            <span className={`px-1.5 py-0 rounded text-[10px] font-medium border ${statusStyle.badge}`}>{event.status}</span>
          )}
          {hasDetail && (expanded ? <ChevronUp className="w-3 h-3 text-gray-300" /> : <ChevronDown className="w-3 h-3 text-gray-300" />)}
        </button>

        {expanded && (
          <div className="mt-2 pl-0.5 space-y-1.5 border-l-2 border-gray-100 pl-3">
            <SnapshotRow label="Before" snapshot={event.beforeSnapshot} />
            <SnapshotRow label="After" snapshot={event.afterSnapshot} />
            {event.effectiveAt && (
              <div className="text-xs text-gray-600">
                <span className="font-medium text-gray-500">Effective:</span> {formatDateTime(event.effectiveAt)}
              </div>
            )}
            {event.amounts && Object.values(event.amounts).some((v) => v != null) && (
              <div className="text-xs text-gray-600 flex flex-wrap gap-x-3 gap-y-1">
                {event.amounts.prorated != null && <span><span className="text-gray-500">Prorated:</span> ₹{event.amounts.prorated}</span>}
                {event.amounts.paid != null && <span><span className="text-gray-500">Paid:</span> ₹{event.amounts.paid}</span>}
                {event.amounts.discount != null && event.amounts.discount > 0 && <span><span className="text-gray-500">Discount:</span> ₹{event.amounts.discount}</span>}
                {event.amounts.gst != null && <span><span className="text-gray-500">GST:</span> ₹{event.amounts.gst}</span>}
              </div>
            )}
            {event.payment?.razorpayPaymentId && (
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <CreditCard className="w-3 h-3" /> {event.payment.razorpayPaymentId}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// `bare`: skip the outer card (bg/border/padding) — used when a parent
// container already supplies it, so the Timeline doesn't nest a second
// bordered box inside the Billing Center's unified right-column card.
const BillingTimeline = ({ bare = false } = {}) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await subscriptionAPI.getBillingTimeline({ limit: 50 });
        if (!cancelled) setEvents(res.data.events || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || "Failed to load billing timeline");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading timeline...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-16 text-sm text-red-600">{error}</div>;
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-sm text-gray-500">
        Nothing to show yet — subscription events will appear here as they happen.
      </div>
    );
  }

  const list = events.map((event, i) => (
    <TimelineEvent key={event._id} event={event} isLast={i === events.length - 1} />
  ));

  if (bare) return <>{list}</>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {list}
    </div>
  );
};

export default BillingTimeline;
