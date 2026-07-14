// components/subscription/CheckoutSummaryModal.jsx
import React from "react";
import { X, ShoppingCart, AlertTriangle, CheckCircle2 } from "lucide-react";

// Coupons are applied/removed on the plans page (outside checkout) so the
// customer sees the discount ripple across every plan/add-on card before
// they even open checkout. This modal only DISPLAYS the already-applied
// coupon's effect — no apply/remove controls here.
const CheckoutSummaryModal = ({ checkoutData, onConfirm, onCancel, processing }) => {
  if (!checkoutData) return null;

  const {
    plan, selectedAddonsList, basePrice, addonsTotal, total, billingCycle,
    type, addonChanges, currentTotal, newTotal,
    compatibleCarryForward = [], incompatibleDropped = [],
    // addon_removal fields
    addonKey, displayName, quantity: removalQty, pricePerUnit,
    newRecurringTotal, effectiveAt,
    // plan_upgrade / plan_downgrade shared fields
    proratedAmount, incompatibleAddons = [], carriedForwardAddons = [], newAddonsList = [],
    // referral reward already applied to proratedAmount by the backend; shown here so
    // the customer can see WHY the charge is lower (proratedAmount is post-discount).
    referralDiscountApplied = 0,
    // plan_downgrade fields
    newBasePrice, periodEnd,
    // coupon (new-subscription checkout only)
    appliedCoupon,
  } = checkoutData;

  const prettyKey = (k) => (k || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const cycleLabel = billingCycle === "yearly" ? "yr" : "mo";
  const isAddonChange = type === "addon_change";
  const isAddonRemoval = type === "addon_removal";
  const isPlanUpgrade = type === "plan_upgrade";
  const isPlanDowngrade = type === "plan_downgrade";
  const isNewSubscription = !isAddonChange && !isAddonRemoval && !isPlanUpgrade && !isPlanDowngrade;
  // For addon_change, use newTotal; for new subs/upgrades, use total
  const rawTotal = isAddonChange ? (newTotal ?? currentTotal + (addonsTotal || 0)) : total;
  // Coupon discounts the base rupee amount BEFORE GST, mirroring the backend.
  const displayTotal = isNewSubscription && appliedCoupon ? Math.max(0, rawTotal - appliedCoupon.discountAmount) : rawTotal;

  // Downgrade recurring total with GST (computed before render to avoid IIFE in JSX)
  const downgradeRecurringBase = newRecurringTotal ?? newBasePrice ?? 0;
  const downgradeRecurringGST = Math.round(downgradeRecurringBase * 0.18);
  const downgradeRecurringWithGST = downgradeRecurringBase + downgradeRecurringGST;

  const formatDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (dt.getFullYear() < 2020) return '—';
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(price);

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[1000004]">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isAddonRemoval || isPlanDowngrade ? "bg-amber-100" : "bg-blue-100"}`}>
              {isAddonRemoval || isPlanDowngrade
                ? <AlertTriangle className="w-5 h-5 text-amber-600" />
                : <ShoppingCart className="w-5 h-5 text-blue-600" />}
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              {isAddonRemoval ? "Schedule Removal"
                : isPlanUpgrade ? `Upgrade to ${plan?.name || plan?.id || ""}`
                : isPlanDowngrade ? `Downgrade to ${plan?.name || plan?.id || ""}`
                : "Order Summary"}
            </h3>
          </div>
          <button
            onClick={onCancel}
            disabled={processing}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Line items */}
        {isPlanDowngrade ? (
          <div className="space-y-3 mb-4">
            {/* New base plan */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-900 capitalize">{plan?.name || plan?.id} plan</span>
              </div>
              <span className="text-sm font-semibold text-gray-800">{formatPrice(newBasePrice)}/{cycleLabel}</span>
            </div>

            {/* Carry-forward addons */}
            {carriedForwardAddons.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Carrying forward</div>
                {carriedForwardAddons.map((a) => (
                  <div key={a.addonKey} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      {prettyKey(a.addonKey)}{a.quantity > 1 && <span className="text-gray-400 ml-1">×{a.quantity}</span>}
                      {a.remappedFrom && a.remappedFrom !== a.addonKey && (
                        <span className="text-gray-400 ml-1">(was {prettyKey(a.remappedFrom)})</span>
                      )}
                    </span>
                    <span className="text-sm text-gray-600">{formatPrice(a.quantity * a.pricePerUnit)}/{cycleLabel}</span>
                  </div>
                ))}
              </div>
            )}

            {/* New selected addons */}
            {newAddonsList.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Adding now</div>
                {newAddonsList.map((a) => (
                  <div key={a.addonKey} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      {prettyKey(a.addonKey)}{a.quantity > 1 && <span className="text-gray-400 ml-1">×{a.quantity}</span>}
                    </span>
                    <span className="text-sm text-green-700">+{formatPrice(a.quantity * a.pricePerUnit)}/{cycleLabel}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recurring total with GST */}
            <div className="border-t border-gray-100 pt-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-sm font-semibold text-gray-900">New recurring from {formatDate(periodEnd)}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-gray-900">{formatPrice(downgradeRecurringWithGST)}/{cycleLabel}</span>
                  <p className="text-xs text-gray-400">{formatPrice(downgradeRecurringBase)} + {formatPrice(downgradeRecurringGST)} GST</p>
                </div>
              </div>
            </div>

            {incompatibleAddons.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800 mb-1">Add-ons not available on this plan</p>
                  <ul className="space-y-0.5">
                    {incompatibleAddons.map((a) => (
                      <li key={a.addonKey} className="text-xs text-amber-700">
                        {a.displayName || prettyKey(a.addonKey)}{a.quantity > 1 && ` ×${a.quantity}`} — removed at cycle end
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-600 mt-1">You keep access until {formatDate(periodEnd)}.</p>
                </div>
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                No refund. You keep current plan access until <strong>{formatDate(periodEnd)}</strong>.
              </p>
            </div>
          </div>
        ) : isPlanUpgrade ? (
          <div className="space-y-3 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-900 capitalize">{plan?.name || plan?.id} plan</span>
                <p className="text-xs text-gray-400">New recurring bill from next renewal</p>
              </div>
              <span className="text-sm font-semibold text-gray-800">{formatPrice(newRecurringTotal)}/{cycleLabel}</span>
            </div>
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-sm font-bold text-gray-900">Charged now</span>
                <p className="text-xs text-gray-400">Pro-rated for the remaining cycle</p>
              </div>
              <span className="text-base font-bold text-blue-700">{formatPrice(proratedAmount)}</span>
            </div>

            {carriedForwardAddons.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Carrying forward</div>
                {carriedForwardAddons.map((a) => (
                  <div key={a.addonKey} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      {prettyKey(a.addonKey)}{a.quantity > 1 && <span className="text-gray-400 ml-1">×{a.quantity}</span>}
                      {a.remappedFrom && a.remappedFrom !== a.addonKey && (
                        <span className="text-gray-400 ml-1">(was {prettyKey(a.remappedFrom)})</span>
                      )}
                    </span>
                    <span className="text-sm text-gray-600">{formatPrice(a.quantity * a.pricePerUnit)}/{cycleLabel}</span>
                  </div>
                ))}
              </div>
            )}

            {newAddonsList.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Adding now</div>
                {newAddonsList.map((a) => (
                  <div key={a.addonKey} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      {prettyKey(a.addonKey)}{a.quantity > 1 && <span className="text-gray-400 ml-1">×{a.quantity}</span>}
                    </span>
                    <span className="text-sm text-green-700">+{formatPrice(a.quantity * a.pricePerUnit)}/{cycleLabel}</span>
                  </div>
                ))}
              </div>
            )}

            {incompatibleAddons.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800 mb-1">Add-ons not available on this plan</p>
                  <ul className="space-y-0.5">
                    {incompatibleAddons.map((a) => (
                      <li key={a.addonKey} className="text-xs text-amber-700">
                        {a.displayName || a.addonKey}
                        {a.quantity > 1 && ` ×${a.quantity}`} — removed at cycle end
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-600 mt-1">You keep access to these until your current billing period ends.</p>
                </div>
              </div>
            )}
          </div>
        ) : isAddonRemoval ? (
          <div className="space-y-3 mb-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Removing</div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-sm text-gray-700">{displayName} ×{removalQty}</span>
              <span className="text-sm font-medium text-red-600">−{formatPrice(removalQty * pricePerUnit)}/{cycleLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Current recurring bill</span>
              <span className="text-sm font-semibold text-gray-800">{formatPrice(currentTotal)}/{cycleLabel}</span>
            </div>
            <div className="flex items-start justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-900">New recurring bill</span>
                <p className="text-xs text-gray-400">from {formatDate(effectiveAt)}</p>
              </div>
              <span className="text-sm font-bold text-gray-900">{formatPrice(newRecurringTotal)}/{cycleLabel}</span>
            </div>
            <div className="mt-1 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                No charge today. Access continues until <strong>{formatDate(effectiveAt)}</strong>.
              </p>
            </div>
          </div>
        ) : isAddonChange ? (
          <div className="space-y-3 mb-4">
            {(() => {
              const additions = (addonChanges || []).filter((c) => c.delta > 0);
              const removals = (addonChanges || []).filter((c) => c.delta < 0);
              const isMixed = additions.length > 0 && removals.length > 0;

              if (isMixed) {
                return (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    Please add and remove add-ons separately.
                  </div>
                );
              }

              return (
                <>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Current billing</span>
                    <span className="text-sm font-semibold text-gray-800">{formatPrice(currentTotal)}/{cycleLabel}</span>
                  </div>

                  {additions.length > 0 && (
                    <>
                      <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Adding</div>
                      {additions.map((change) => (
                        <div key={change.addonKey} className="flex items-start justify-between">
                          <span className="text-sm text-gray-700">
                            {change.delta} × {change.displayName}
                          </span>
                          <div className="text-right">
                            <div className="text-sm font-medium text-green-700">
                              +{formatPrice(change.delta * change.pricePerUnit)}/{cycleLabel}
                            </div>
                            <div className="text-xs text-gray-400">from next renewal · prorated now</div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {removals.length > 0 && (
                    <>
                      <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Removing</div>
                      {removals.map((change) => (
                        <div key={change.addonKey} className="flex items-start justify-between">
                          <span className="text-sm text-gray-700">
                            {change.displayName}
                            {Math.abs(change.delta) > 1 && <span className="text-gray-400 ml-1">×{Math.abs(change.delta)}</span>}
                          </span>
                          <div className="text-right">
                            <div className="text-sm font-medium text-red-600">
                              -{formatPrice(Math.abs(change.delta) * change.pricePerUnit)}/{cycleLabel}
                            </div>
                            <div className="text-xs text-gray-400">From next renewal</div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {/* Base plan */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 font-medium capitalize">
                {plan.name} Plan
                {appliedCoupon?.lineItems?.find((li) => li.key === plan.id && li.discount > 0) && (
                  <span className="ml-1.5 text-xs font-medium text-green-600">
                    − {formatPrice(appliedCoupon.lineItems.find((li) => li.key === plan.id).discount)} coupon
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {formatPrice(basePrice)}/{cycleLabel}
              </span>
            </div>

            {/* Selected add-ons — annotated with the coupon's per-line-item
                discount, if any, so it's clear the discount applies to just
                this item rather than the whole order */}
            {selectedAddonsList.map((addon) => {
              const itemDiscount = appliedCoupon?.lineItems?.find((li) => li.key === addon.key && li.discount > 0);
              return (
                <div key={addon.key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {addon.displayName}
                    {addon.pricingType !== "boolean" && (
                      <span className="text-gray-400 ml-1">× {addon.quantity}</span>
                    )}
                    {itemDiscount && (
                      <span className="ml-1.5 text-xs font-medium text-green-600">− {formatPrice(itemDiscount.discount)} coupon</span>
                    )}
                  </span>
                  <span className="text-sm text-gray-700">{formatPrice(addon.subtotal)}/{cycleLabel}</span>
                </div>
              );
            })}

            {/* Add-ons carried forward from current plan */}
            {compatibleCarryForward.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Carrying forward</div>
                {compatibleCarryForward.map((addon) => (
                  <div key={addon.addonKey} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {addon.addonKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      {addon.quantity > 1 && <span className="text-gray-400 ml-1">× {addon.quantity}</span>}
                    </span>
                    <span className="text-sm text-gray-700">{formatPrice(addon.quantity * addon.pricePerUnit)}/{cycleLabel}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Incompatible add-ons being dropped */}
            {incompatibleDropped.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800 mb-1">Add-ons not available on this plan</p>
                    <ul className="space-y-0.5">
                      {incompatibleDropped.map((addon) => (
                        <li key={addon.addonKey} className="text-xs text-amber-700">
                          {addon.displayName || addon.addonKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          {addon.quantity > 1 && ` × ${addon.quantity}`} — will be removed at cycle end
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-amber-600 mt-1">You keep access to these until your current billing period ends.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Coupon effect display only — applied/removed on the plans
                page, not here. This just confirms what's already active. */}
            {appliedCoupon && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-green-800">Coupon Applied — {appliedCoupon.code}</p>
                    <p className="text-xs text-green-700">You saved {formatPrice(appliedCoupon.discountAmount)} today.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Divider + Total — hidden for addon_removal, plan_upgrade, plan_downgrade (shown inline above) */}
        {!isAddonRemoval && !isPlanUpgrade && !isPlanDowngrade && (
          <>
            {isAddonChange ? (
              <>
                <div className="border-t border-gray-200 pt-4 mb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-gray-900">New total</span>
                    <span className="text-base font-bold text-gray-900">
                      {formatPrice(displayTotal)}/{cycleLabel}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-6">
                  {(addonChanges || []).some((c) => c.delta > 0)
                    ? "Razorpay checkout opens for the prorated charge. Recurring amount updates at next renewal."
                    : "No charge. Removal takes effect at the end of your current billing period."}
                </p>
              </>
            ) : (() => {
              const gst = Math.round(displayTotal * 0.18);
              const totalWithGST = displayTotal + gst;
              return (
                <>
                  <div className="border-t border-gray-200 pt-4 mb-2 space-y-1.5">
                    {appliedCoupon && (
                      <>
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>Subtotal</span>
                          <span>{formatPrice(rawTotal)}/{cycleLabel}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-green-700">
                          <span>Coupon Discount ({appliedCoupon.code})</span>
                          <span>− {formatPrice(appliedCoupon.discountAmount)}/{cycleLabel}</span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>GST (18%)</span>
                      <span>+ {formatPrice(gst)}/{cycleLabel}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-100 pt-1.5">
                      <span className="text-base font-bold text-gray-900">Total</span>
                      <span className="text-base font-bold text-gray-900">
                        {formatPrice(totalWithGST)}/{cycleLabel}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-6">GST included in the amount above.</p>
                </>
              );
            })()}
          </>
        )}
        {isPlanUpgrade && (() => {
          const chargeGST = Math.round(proratedAmount * 0.18);
          const chargeTotal = proratedAmount + chargeGST;
          const recurringGST = Math.round(newRecurringTotal * 0.18);
          const recurringTotal = newRecurringTotal + recurringGST;
          // proratedAmount is ALREADY post-discount (backend applied the reward).
          // Reconstruct the pre-discount figure only for display.
          const hasReferralReward = referralDiscountApplied > 0;
          const originalProrated = proratedAmount + referralDiscountApplied;
          return (
            <>
              {hasReferralReward && (
                <div className="mb-3 rounded-lg bg-purple-50 border border-purple-100 px-3 py-2.5 text-xs text-purple-700">
                  🎉 <span className="font-semibold">Referral reward applied</span> — you saved {formatPrice(referralDiscountApplied)} on this purchase.
                </div>
              )}
              <div className="text-xs text-gray-500 mb-6 space-y-1 bg-gray-50 rounded-lg p-3">
                {hasReferralReward ? (
                  <>
                    <p className="font-semibold text-gray-700">Charged today (incl. GST)</p>
                    <div className="flex justify-between"><span>Prorated upgrade</span><span>{formatPrice(originalProrated)}</span></div>
                    <div className="flex justify-between text-purple-700"><span>Referral reward</span><span>−{formatPrice(referralDiscountApplied)}</span></div>
                    <div className="flex justify-between border-t border-gray-200 pt-1"><span>Subtotal</span><span>{formatPrice(proratedAmount)}</span></div>
                    <div className="flex justify-between"><span>GST (18%)</span><span>{formatPrice(chargeGST)}</span></div>
                    <div className="flex justify-between border-t border-gray-200 pt-1 font-bold text-gray-900"><span>Pay today</span><span>{formatPrice(chargeTotal)}</span></div>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-gray-700">Charged today (incl. GST)</p>
                    <p>{formatPrice(proratedAmount)} + {formatPrice(chargeGST)} GST = <span className="font-bold text-gray-900">{formatPrice(chargeTotal)}</span></p>
                  </>
                )}
                <p className="mt-1 font-semibold text-gray-700">New recurring from next renewal</p>
                <p>{formatPrice(newRecurringTotal)}/{cycleLabel} + {formatPrice(recurringGST)} GST = <span className="font-bold text-gray-900">{formatPrice(recurringTotal)}/{cycleLabel}</span></p>
              </div>
            </>
          );
        })()}
        {isPlanDowngrade && <div className="mb-6" />}
        {isAddonRemoval && <div className="mb-6" />}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onConfirm}
            disabled={processing}
            className={`w-full py-3 px-4 rounded-lg font-medium disabled:opacity-50 transition-colors text-white ${isAddonRemoval || isPlanDowngrade ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : isAddonRemoval ? (
              "Schedule Removal"
            ) : isPlanDowngrade ? (
              "Schedule Downgrade"
            ) : isPlanUpgrade ? (
              `Pay ${formatPrice(proratedAmount + Math.round(proratedAmount * 0.18))} & Upgrade`
            ) : isAddonChange ? (
              (addonChanges || []).some((c) => c.delta > 0)
                ? `Pay (Prorated) & Add`
                : `Schedule Removal (no charge)`
            ) : (
              `Confirm & Pay ${formatPrice(displayTotal + Math.round(displayTotal * 0.18))}/${cycleLabel}`
            )}
          </button>
          <button
            onClick={onCancel}
            disabled={processing}
            className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSummaryModal;
