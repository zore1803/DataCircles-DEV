// components/subscription/SubscriptionPricingBreakdown.jsx
//
// Renders the itemized pricing for an ALREADY-PURCHASED subscription, purely
// from the stored subscription document — plan price, active add-ons, the
// frozen coupon snapshot (if any), subtotal, GST, recurring total. This does
// NOT recompute a discount, re-run the coupon engine, or reload coupon rules
// — it only formats fields that already exist on `subscription`
// (pricePerUser, activeAddons, appliedCoupon, totalAmount, billingCycle).
//
// Used by both CurrentSubscriptionInfo (the summary card) and PlanCard (the
// current-plan card's recurring breakdown) so the two surfaces can never show
// different numbers for the same subscription — one component, one render.
import React from "react";
import { Tag } from "lucide-react";
import { formatPrice, computeGST } from "../../utils/pricingSnapshot";

const SubscriptionPricingBreakdown = ({ subscription, compact = false }) => {
  if (!subscription) return null;

  const appliedCoupon = subscription.appliedCoupon?.code ? subscription.appliedCoupon : null;
  const cycleLabel = subscription.billingCycle === "monthly" ? "mo" : "yr";
  const gst = computeGST(subscription.totalAmount);
  const recurringTotal = subscription.totalAmount + gst;

  if (!appliedCoupon) {
    // No coupon on this subscription — the plain total line, unchanged from
    // what both surfaces already showed before this component existed.
    return (
      <p className={`text-xs text-gray-600 ${compact ? "" : "mt-1"}`}>
        Total: <span className="font-semibold">{formatPrice(subscription.totalAmount)}</span>
        {" "}<span className="text-gray-500">+ {formatPrice(gst)} GST</span>
        {" "}<span className="text-gray-700 font-semibold">= {formatPrice(recurringTotal)}/{cycleLabel}</span>
      </p>
    );
  }

  return (
    <div className={`text-xs text-gray-600 space-y-0.5 ${compact ? "" : "mt-1"}`}>
      <div className="flex items-center justify-between">
        <span className="capitalize">{subscription.planName} plan</span>
        <span>{formatPrice(subscription.pricePerUser)}</span>
      </div>
      {(subscription.activeAddons || []).map((a) => (
        <div key={a.addonKey} className="flex items-center justify-between">
          <span>{a.addonKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}{a.quantity > 1 && ` ×${a.quantity}`}</span>
          <span>{formatPrice(a.pricePerUnit * a.quantity)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between text-green-700">
        <span className="inline-flex items-center gap-1">
          <Tag className="w-3 h-3" /> Coupon {appliedCoupon.code}
          {appliedCoupon.duration?.type === "until_cancelled" && (
            <span className="text-[10px] text-green-500">(until cancelled)</span>
          )}
        </span>
        <span>− {formatPrice(appliedCoupon.discountAmount)}</span>
      </div>
      <div className="flex items-center justify-between pt-0.5 border-t border-gray-100 font-medium text-gray-700">
        <span>Subtotal</span>
        <span>{formatPrice(subscription.totalAmount)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>GST (18%)</span>
        <span>{formatPrice(gst)}</span>
      </div>
      <div className="flex items-center justify-between font-semibold text-gray-900 pt-0.5 border-t border-gray-100">
        <span>Recurring Total</span>
        <span>{formatPrice(recurringTotal)}/{cycleLabel}</span>
      </div>
    </div>
  );
};

export default SubscriptionPricingBreakdown;
