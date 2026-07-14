// components/settings/BillingSidebar.jsx
//
// The left column: "what do I have, right now." Sticky on desktop so it
// stays visible while the right column (history/documents) scrolls.
// Styled to match the rest of Settings — white card, gray-200 border,
// rounded-xl, the same amber accent the Billing tile/Premium badge already
// use — rather than an isolated color scheme that only exists here.
import React from "react";
import { useNavigate } from "react-router-dom";
import { Tag, ArrowRight, Clock, CreditCard } from "lucide-react";
import { formatPrice, computeGST } from "../../utils/pricingSnapshot";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { hasValidPendingUpdate } from "../../utils/subscriptionHelpers";

const prettyPlan = (name) => (name ? name.charAt(0).toUpperCase() + name.slice(1) : name);
const prettyKey = (k) => (k || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const formatDate = (d, opts = { day: "numeric", month: "short" }) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (dt.getFullYear() < 2020) return "—";
  return dt.toLocaleDateString("en-IN", opts);
};

const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  created: "bg-amber-50 text-amber-700 border-amber-200",
  authenticated: "bg-amber-50 text-amber-700 border-amber-200",
};

const Row = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
    <span className="text-xs text-gray-500">{label}</span>
    <span className="text-sm font-semibold text-gray-900 text-right">{children}</span>
  </div>
);

const BillingSidebar = ({ subscription }) => {
  const navigate = useNavigate();
  const { seatStatus } = useSubscription();

  if (!subscription) return null;

  const gst = computeGST(subscription.totalAmount);
  const recurringTotal = subscription.totalAmount + gst;
  const statusStyle = STATUS_STYLES[subscription.status] || "bg-gray-100 text-gray-600 border-gray-200";
  const pending = hasValidPendingUpdate(subscription) ? subscription.pendingUpdate : null;

  return (
    <div className="md:sticky md:top-6 md:self-start bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900 capitalize">{prettyPlan(subscription.planName)}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${statusStyle}`}>
                {subscription.status?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
        <p className="text-3xl font-bold text-gray-900 mt-2">
          {formatPrice(recurringTotal)}<span className="text-sm font-medium text-gray-400">/{subscription.billingCycle === "monthly" ? "mo" : "yr"}</span>
        </p>
      </div>

      {pending && (
        <div className="mx-6 mb-5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <Clock className="w-3 h-3" /> Changing soon
          </div>
          <p className="text-sm mt-0.5 text-gray-800">
            <span className="capitalize">{subscription.planName}</span>
            <span className="text-gray-400 mx-1">→</span>
            <span className="capitalize font-semibold">{pending.planName}</span>
            <span className="text-amber-600 text-xs ml-1">on {formatDate(pending.scheduledAt)}</span>
          </p>
        </div>
      )}

      <div className="px-6">
        <Row label="Next Renewal">{formatDate(subscription.nextBillingDate)}</Row>
        {seatStatus && <Row label="Seats">{seatStatus.occupiedSeats} / {seatStatus.totalSeats}</Row>}
        {(subscription.activeAddons || []).length > 0 && (
          <Row label="Recurring">
            {subscription.activeAddons.map((a) => prettyKey(a.addonKey)).join(", ")}
          </Row>
        )}
        {subscription.appliedCoupon?.code && (
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="text-xs text-gray-500">Coupon</span>
            <span className="text-sm font-semibold text-gray-900 text-right flex items-center gap-1">
              <Tag className="w-3 h-3 text-emerald-600" /> {subscription.appliedCoupon.code}
              <span className="text-[11px] text-emerald-600 font-normal ml-1">save {formatPrice(subscription.appliedCoupon.discountAmount)}</span>
            </span>
          </div>
        )}
      </div>

      <div className="p-6 pt-5">
        <button
          onClick={() => navigate("/settings/subscription")}
          className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Manage Subscription <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default BillingSidebar;
