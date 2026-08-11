// components/subscription/TransitionConfirmationCard.jsx
//
// Task 4 (Aug 2026): extracted from CheckoutSummaryModal.jsx's cycle_transition
// branch — same shape (current state -> target state -> price breakdown ->
// GST -> total), generalized with plain prop names so it can also back an
// annual add-on purchase confirmation. Pure extraction: cycle_transition's
// visual output is unchanged, this component just holds the JSX that used
// to be inline.
//
// All numbers are backend-sourced (pricingBreakdown), never computed here —
// same Single Source of Truth rule every other confirmation screen in this
// codebase already follows.
import React from "react";

const formatPrice = (amount) => `₹${Math.round(amount || 0).toLocaleString("en-IN")}`;

const TransitionConfirmationCard = ({
  currentLabel,
  currentSubLabel,
  targetLabel,
  targetSubLabel,
  // Optional explanatory note above the breakdown (e.g. anchor-window context)
  note,
  // Breakdown line items: [{ label, amount, isSubtraction, isTotal }]
  breakdownLines = [],
  pricingBreakdown,
}) => {
  return (
    <div className="space-y-3 mb-4">
      <div className="flex items-start justify-between pb-2 border-b border-gray-100">
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Current</span>
          <p className="text-sm font-semibold text-gray-900 capitalize mt-0.5">{currentLabel}</p>
          {currentSubLabel && <p className="text-xs text-gray-400">{currentSubLabel}</p>}
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            {targetLabel ? "Switching to" : ""}
          </span>
          <p className="text-sm font-semibold text-gray-900 capitalize mt-0.5">{targetLabel}</p>
          {targetSubLabel && <p className="text-xs text-gray-400">{targetSubLabel}</p>}
        </div>
      </div>

      {note && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{note}</div>
      )}

      {breakdownLines.length > 0 && (
        <div className="space-y-1.5">
          {breakdownLines.map((line, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between text-sm ${line.isTotal ? "font-semibold border-t border-gray-100 pt-1.5" : ""}`}
            >
              <span className={line.isTotal ? "text-gray-900" : "text-gray-600"}>{line.label}</span>
              <span className={line.isSubtraction ? "text-red-600 font-medium" : "text-gray-900 font-medium"}>
                {line.isSubtraction ? "− " : ""}{formatPrice(line.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {pricingBreakdown && (
        <div className="space-y-1.5 pt-1 border-t border-gray-100">
          {pricingBreakdown.couponDiscount && (
            <div className="flex items-center justify-between text-sm text-red-600">
              <span>Coupon Discount{pricingBreakdown.couponDiscount.code ? ` (${pricingBreakdown.couponDiscount.code})` : ""}</span>
              <span>− {formatPrice(pricingBreakdown.couponDiscount.amount)}</span>
            </div>
          )}
          {pricingBreakdown.referralDiscount && (
            <div className="flex items-center justify-between text-sm text-purple-600">
              <span>Referral Reward</span>
              <span>− {formatPrice(pricingBreakdown.referralDiscount.amount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">GST (18%)</span>
            <span className="text-gray-900 font-medium">+ {formatPrice(pricingBreakdown.gst)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-1.5">
            <span className="text-base font-bold text-gray-900">Total</span>
            <span className="text-base font-bold text-gray-900">{formatPrice(pricingBreakdown.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransitionConfirmationCard;
