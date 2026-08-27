// components/settings/BillingSidebar.jsx
//
// The left column: "what do I have, right now." Sticky on desktop so it
// stays visible while the right column (history/documents) scrolls.
// Styled to match the rest of Settings — white card, gray-200 border,
// rounded-xl, the same amber accent the Billing tile/Premium badge already
// use — rather than an isolated color scheme that only exists here.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tag, ArrowRight, Clock, CreditCard, Calendar } from "lucide-react";
import { formatPrice, computeGST } from "../../utils/pricingSnapshot";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { deriveSubscriptionUIState, SUBSCRIPTION_UI_STATES } from "../../utils/subscriptionHelpers";
import { subscriptionAPI } from "../../services/subscriptionApi";
import RewardAvailabilityBadge from "../subscription/RewardAvailabilityBadge";
import { isCouponStillRecurring } from "../../utils/couponHelpers";
import BillingCalendarModal from "../subscription/BillingCalendarModal";

const prettyPlan = (name) => (name ? name.charAt(0).toUpperCase() + name.slice(1) : name);
const prettyKey = (k) => (k || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const formatDate = (d, opts = { day: "numeric", month: "short" }) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (dt.getFullYear() < 2020) return "—";
  return dt.toLocaleDateString("en-IN", opts);
};

// Keyed by the canonical derived UI state (never the legacy `status` field,
// which stays permanently "created" under CAW — see subscriptionHelpers.js).
const STATUS_STYLES = {
  [SUBSCRIPTION_UI_STATES.ACTIVE]: "bg-emerald-50 text-emerald-700 border-emerald-200",
  [SUBSCRIPTION_UI_STATES.TRIAL]: "bg-blue-50 text-blue-700 border-blue-200",
  [SUBSCRIPTION_UI_STATES.PENDING_MANDATE]: "bg-amber-50 text-amber-700 border-amber-200",
  [SUBSCRIPTION_UI_STATES.PENDING_PAYMENT]: "bg-amber-50 text-amber-700 border-amber-200",
  [SUBSCRIPTION_UI_STATES.PAST_DUE]: "bg-orange-50 text-orange-700 border-orange-200",
  [SUBSCRIPTION_UI_STATES.SUSPENDED]: "bg-red-50 text-red-700 border-red-200",
  [SUBSCRIPTION_UI_STATES.CANCELLED]: "bg-gray-100 text-gray-600 border-gray-200",
  [SUBSCRIPTION_UI_STATES.EXPIRED]: "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUS_LABELS = {
  [SUBSCRIPTION_UI_STATES.ACTIVE]: "ACTIVE",
  [SUBSCRIPTION_UI_STATES.TRIAL]: "TRIAL",
  [SUBSCRIPTION_UI_STATES.PENDING_MANDATE]: "PENDING PAYMENT",
  [SUBSCRIPTION_UI_STATES.PENDING_PAYMENT]: "PENDING PAYMENT",
  [SUBSCRIPTION_UI_STATES.PAST_DUE]: "PAST DUE",
  [SUBSCRIPTION_UI_STATES.SUSPENDED]: "SUSPENDED",
  [SUBSCRIPTION_UI_STATES.CANCELLED]: "CANCELLED",
  [SUBSCRIPTION_UI_STATES.EXPIRED]: "EXPIRED",
};

const Row = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
    <span className="text-xs text-gray-500">{label}</span>
    <span className="text-sm font-semibold text-gray-900 text-right">{children}</span>
  </div>
);

const BillingSidebar = ({ subscription }) => {
  const navigate = useNavigate();
  const { seatStatus, scheduledChanges, effectiveRecurringTotal, removedAddons } = useSubscription();
  // BILLING_UX_SPEC.md §2.2 — "Next Renewal" preview, backend-computed
  // (previewRenewal(), read-only) rather than client math, so this can
  // never disagree with what renewSubscription() actually charges.
  const [renewalPreview, setRenewalPreview] = useState(null);
  const [showBillingCalendar, setShowBillingCalendar] = useState(false);

  useEffect(() => {
    if (!subscription?.isPaymentConfirmed) return;
    let cancelled = false;
    subscriptionAPI.getRenewalPreview()
      .then((res) => { if (!cancelled) setRenewalPreview(res.data); })
      .catch(() => { if (!cancelled) setRenewalPreview(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription?.isPaymentConfirmed, subscription?._id]);

  if (!subscription) return null;

  const gst = computeGST(subscription.totalAmount);
  const recurringTotal = subscription.totalAmount + gst;
  // effectiveRecurringTotal (from getScheduledChanges — priced via
  // calculateInvoice() against the same buildEffectiveSubscription() the
  // Renewal Engine itself uses) is non-null whenever ANY change is
  // scheduled — not just a PLAN_CHANGE/BILLING_CYCLE_CHANGE. Shown
  // independently of the "Changing soon" plan-change card below, since a
  // REMOVE_ADDON-only schedule (no plan/cycle change) has nothing to show
  // there but still changes what the customer will pay.
  const effectiveGST = effectiveRecurringTotal != null ? computeGST(effectiveRecurringTotal) : 0;
  const uiState = deriveSubscriptionUIState(subscription);
  const statusStyle = STATUS_STYLES[uiState] || "bg-gray-100 text-gray-600 border-gray-200";
  const statusLabel = STATUS_LABELS[uiState] || uiState;
  // Canonical source of future intent (Ownership Law 5) — never the legacy
  // subscription.pendingUpdate. A subscription has at most one PENDING
  // PLAN_CHANGE/BILLING_CYCLE_CHANGE record (enforced by a DB partial unique
  // index — ScheduledChange.js), so the first match is the only one.
  const pendingPlanOrCycleChange = (scheduledChanges || []).find(
    (c) => c.type === "PLAN_CHANGE" || c.type === "BILLING_CYCLE_CHANGE"
  );

  return (
    <div className="md:sticky md:top-6 md:self-start bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 pb-5">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 capitalize">{prettyPlan(subscription.planName)}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${statusStyle}`}>
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowBillingCalendar(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline flex-shrink-0"
          >
            <Calendar className="w-3.5 h-3.5" /> Calendar
          </button>
        </div>
        <p className="text-3xl font-bold text-gray-900 mt-2">
          {formatPrice(recurringTotal)}<span className="text-sm font-medium text-gray-400">/{subscription.billingCycle === "monthly" ? "mo" : "yr"}</span>
        </p>
        {/* Found via dashboard polish pass: effectiveRecurringTotal (from
            getScheduledChanges) prices scheduled plan/add-on changes but
            NEVER includes a referral discount, while the renewal-preview box
            below prices the SAME effective (post-scheduled-change)
            subscription INCLUDING referral — so when both a scheduled
            change and a reward existed, this line and that box used to show
            two different numbers for the same future renewal, one silently
            missing the discount. Only shown when the box below ISN'T
            (no coupon/referral to preview), so there's exactly one number
            for "what changes at next renewal," never two. */}
        {effectiveRecurringTotal != null && !(renewalPreview?.pricingBreakdown?.couponDiscount || renewalPreview?.pricingBreakdown?.referralDiscount) && (
          <p className="text-xs text-amber-700 mt-1">
            Becomes {formatPrice(effectiveRecurringTotal + effectiveGST)}/{subscription.billingCycle === "monthly" ? "mo" : "yr"} after scheduled changes
          </p>
        )}
        <RewardAvailabilityBadge compact />
      </div>

      {/* BILLING_UX_SPEC.md §2.2 — only shown when a discount will actually
          hit the next renewal (coupon still eligible, or a reward available)
          — an undiscounted renewal already has its date in the Row below,
          nothing further to preview. */}
      {(renewalPreview?.pricingBreakdown?.couponDiscount || renewalPreview?.pricingBreakdown?.referralDiscount) && (
        <div className="mx-6 mb-5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
          <p className="text-xs font-semibold text-emerald-700 mb-1">
            Next Renewal — {formatDate(renewalPreview.nextRenewalDate)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Original</span>
            <span>{formatPrice(renewalPreview.pricingBreakdown.subtotal)}</span>
          </div>
          {renewalPreview.pricingBreakdown.couponDiscount && (
            <div className="flex items-center justify-between text-xs text-emerald-700">
              <span>Coupon</span>
              <span>− {formatPrice(renewalPreview.pricingBreakdown.couponDiscount.amount)}</span>
            </div>
          )}
          {renewalPreview.pricingBreakdown.referralDiscount && (
            <div className="flex items-center justify-between text-xs text-purple-700">
              <span>Referral Reward</span>
              <span>− {formatPrice(renewalPreview.pricingBreakdown.referralDiscount.amount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs font-semibold text-gray-900 pt-1 mt-1 border-t border-emerald-100">
            <span>Estimated</span>
            <span>{formatPrice(renewalPreview.pricingBreakdown.total)}</span>
          </div>
        </div>
      )}

      {pendingPlanOrCycleChange && (
        <div className="mx-6 mb-5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <Clock className="w-3 h-3" /> Changing soon
          </div>
          <p className="text-sm mt-0.5 text-gray-800">
            <span className="capitalize">{subscription.planName}</span>
            <span className="text-gray-400 mx-1">→</span>
            <span className="capitalize font-semibold">{pendingPlanOrCycleChange.payload?.planId || prettyPlan(subscription.planName)}</span>
            <span className="text-amber-600 text-xs ml-1">on {formatDate(pendingPlanOrCycleChange.effectiveAt)}</span>
          </p>
        </div>
      )}

      <div className="px-6">
        <Row label="Next Renewal">
          {formatDate(subscription.nextBillingDate)}
          {/* Amount shown here only when neither box above already shows it
              (the discount-preview box, or the scheduled-change line) — one
              number for "what renews," never a third, possibly-stale one. */}
          {effectiveRecurringTotal == null && !(renewalPreview?.pricingBreakdown?.couponDiscount || renewalPreview?.pricingBreakdown?.referralDiscount) && (
            <span className="text-gray-400 font-normal"> · {formatPrice(recurringTotal)}</span>
          )}
        </Row>
        {seatStatus && (
          <Row label="Seats">
            Admin {seatStatus.occupiedAdminSeats}/{seatStatus.includedSeats} · Staff {seatStatus.occupiedStaffSeats}/{seatStatus.totalStaffSeats}
          </Row>
        )}
        {/* Task 4 (Aug 2026), extended per live-QA follow-up: monthly and
            annual add-ons shown separately (they can coexist as independent
            billable items — Phase 2c — with different prices/cadences) AND
            each one states how/when it's actually charged next, so a
            customer with a monthly add-on knows it keeps billing monthly
            (and separately from the plan) even if they can cancel it
            anytime — never just a flattened name list. Backend-sourced only:
            billingCycle/periodEnd/nextRenewalAt straight off the addon
            record, removal date from the same removedAddons/scheduledChanges
            derivation every other screen already uses — no client math. */}
        {(subscription.activeAddons || []).length > 0 && (() => {
          const byCycle = { monthly: [], yearly: [] };
          subscription.activeAddons.forEach((a) => {
            const cycle = a.billingCycle || subscription.billingCycle;
            (byCycle[cycle] || byCycle.monthly).push(a);
          });

          const addonDetail = (a, cycle) => {
            const removal = (removedAddons || []).find(
              (r) => r.addonKey === a.addonKey && (r.billingCycle || subscription.billingCycle) === cycle
            );
            const removalChange = (scheduledChanges || []).find(
              (c) => c.type === "REMOVE_ADDON" && c.payload?.addonKey === a.addonKey &&
                (c.payload?.billingCycle || subscription.billingCycle) === cycle
            );
            if (removal) {
              const date = removalChange?.effectiveAt ? formatDate(removalChange.effectiveAt) : "soon";
              return { text: `removing ${date}`, tone: "text-amber-600" };
            }
            if (cycle === "yearly") {
              return { text: a.periodEnd ? `renews ${formatDate(a.periodEnd)}` : "annual", tone: "text-gray-400" };
            }
            // Monthly: either independently billed (its own clock, separate
            // from the base plan) or riding the base plan's own renewal
            // because the two cycles happen to match — genuinely different
            // facts, so this must never blur them into one generic label.
            return a.nextRenewalAt
              ? { text: `next charge ${formatDate(a.nextRenewalAt)}`, tone: "text-gray-400" }
              : { text: "billed with your plan", tone: "text-gray-400" };
          };

          const renderGroup = (label, items, cycle) => (
            <div className="py-2 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-500">{label}</span>
              <div className="mt-1 space-y-0.5">
                {items.map((a) => {
                  const detail = addonDetail(a, cycle);
                  return (
                    <div key={`${a.addonKey}-${cycle}`} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-gray-900">
                        {prettyKey(a.addonKey)}{a.quantity > 1 ? ` ×${a.quantity}` : ""}
                      </span>
                      <span className={detail.tone}>{detail.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );

          return (
            <>
              {byCycle.monthly.length > 0 && renderGroup("Monthly Add-ons", byCycle.monthly, "monthly")}
              {byCycle.yearly.length > 0 && renderGroup("Annual Add-ons", byCycle.yearly, "yearly")}
            </>
          );
        })()}
        {/* Coupon P0 fix (found via live QA): "save ₹X" only shown while the
            coupon actually still discounts future billing — a first_payment
            coupon that already fired shows as a past, one-time saving
            instead, never implying it's still recurring. */}
        {subscription.appliedCoupon?.code && (
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="text-xs text-gray-500">Coupon</span>
            <span className="text-sm font-semibold text-gray-900 text-right flex items-center gap-1">
              <Tag className="w-3 h-3 text-emerald-600" /> {subscription.appliedCoupon.code}
              {isCouponStillRecurring(subscription.appliedCoupon) ? (
                <span className="text-[11px] text-emerald-600 font-normal ml-1">save {formatPrice(subscription.appliedCoupon.discountAmount)}</span>
              ) : (
                <span className="text-[11px] text-gray-400 font-normal ml-1">used on first payment</span>
              )}
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

      <BillingCalendarModal isOpen={showBillingCalendar} onClose={() => setShowBillingCalendar(false)} />
    </div>
  );
};

export default BillingSidebar;
