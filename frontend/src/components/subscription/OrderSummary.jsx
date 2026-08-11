// components/subscription/OrderSummary.jsx
//
// The ONE Order Summary component — see backend/docs/audit/BILLING_UX_SPEC.md
// §1. Every checkout surface (signup, trial→paid, upgrade, add-on purchase,
// renewal preview, seat purchase) renders through this component, fed by the
// backend's canonical `pricingBreakdown` shape (invoiceEngine.js's
// toPricingBreakdown()). Per §0 (Single Source of Truth), this component
// performs NO pricing arithmetic of its own — every amount it renders is a
// value already computed by the backend; it only formats and decides row
// visibility (hide-if-zero/null, per §1.1).
import React from "react";
import { formatPrice } from "../../utils/pricingSnapshot";

/**
 * @param {Object} props
 * @param {Object} props.pricingBreakdown - the canonical shape:
 *   { pricingLineItems, subtotal, couponDiscount, referralDiscount,
 *     taxableAmount, gst, total }
 * @param {String} [props.header] - e.g. "Order Summary", "Upgrade to Business" (§1.4)
 * @param {String} [props.contextLine] - e.g. "You'll be charged the prorated difference today." (§1.4)
 * @param {Boolean} [props.readOnly] - true for the renewal-preview variant (§1.4) — no submit action lives inside this component regardless, this only affects styling (no "processing" affordance)
 * @param {Boolean} [props.rewardConsumedThisCheckout] - shows the §1.5 callout above the totals when a referral reward is actively being spent on THIS checkout (not just previewed)
 * @param {String} [props.ineligibleRewardNotice] - §2.4: "reward exists but isn't eligible for this purchase." When set, rendered in the callout position INSTEAD of the reward-consumed banner, and no referral row is expected (there is none — the backend simply won't have included one).
 */
const OrderSummary = ({
  pricingBreakdown,
  header = "Order Summary",
  contextLine,
  readOnly = false,
  rewardConsumedThisCheckout = false,
  ineligibleRewardNotice,
}) => {
  if (!pricingBreakdown) return null;

  const {
    pricingLineItems = [],
    subtotal,
    couponDiscount,
    referralDiscount,
    taxableAmount,
    gst,
    total,
  } = pricingBreakdown;

  return (
    <div className={`rounded-lg border border-gray-200 ${readOnly ? "bg-gray-50" : "bg-white"} p-4`}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{header}</h3>
        {contextLine && <p className="text-xs text-gray-500 mt-0.5">{contextLine}</p>}
      </div>

      {/* §1.5 — explicit callout, above the table, never inferred from the rows alone. */}
      {ineligibleRewardNotice ? (
        <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-xs font-medium text-amber-800">Reward not applicable to this purchase</p>
          <p className="text-xs text-amber-700 mt-0.5">{ineligibleRewardNotice}</p>
        </div>
      ) : rewardConsumedThisCheckout && referralDiscount ? (
        <div className="mb-3 rounded-md bg-purple-50 border border-purple-200 px-3 py-2">
          <p className="text-xs font-medium text-purple-800">
            ✓ Referral Reward Applied — You're saving {formatPrice(referralDiscount.amount)} today.
          </p>
        </div>
      ) : null}

      <div className="space-y-1.5 text-sm">
        {pricingLineItems.map((line, i) => (
          <div key={i} className="flex items-center justify-between text-gray-700">
            <span>{line.label}</span>
            <span className="tabular-nums">{formatPrice(line.amount)}</span>
          </div>
        ))}

        <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 font-medium text-gray-900">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatPrice(subtotal)}</span>
        </div>

        {/* §1.1 — hidden when null; rendered as negative/red when present, even if the discount amount itself happens to be ₹0 (a capped coupon, say) — visibility keys off `null` vs. an object, never a numeric zero-check. */}
        {couponDiscount && (
          <div className="flex items-center justify-between text-red-600">
            <span>Coupon Discount{couponDiscount.code ? ` (${couponDiscount.code})` : ""}</span>
            <span className="tabular-nums">− {formatPrice(couponDiscount.amount)}</span>
          </div>
        )}
        {referralDiscount && (
          <div className="flex items-center justify-between text-red-600">
            <span>Referral Reward{referralDiscount.percent != null ? ` (${referralDiscount.percent}% off)` : ""}</span>
            <span className="tabular-nums">− {formatPrice(referralDiscount.amount)}</span>
          </div>
        )}

        {(couponDiscount || referralDiscount) && (
          <div className="flex items-center justify-between text-gray-700">
            <span>Taxable Amount</span>
            <span className="tabular-nums">{formatPrice(taxableAmount)}</span>
          </div>
        )}

        {/* §1.1 — GST is the one row that never hides, even at ₹0. */}
        <div className="flex items-center justify-between text-gray-700">
          <span>GST (18%)</span>
          <span className="tabular-nums">{formatPrice(gst)}</span>
        </div>

        <div className="flex items-center justify-between pt-1.5 border-t border-gray-200 text-base font-semibold text-gray-900">
          <span>Total Payable</span>
          <span className="tabular-nums">{formatPrice(total)}</span>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;
