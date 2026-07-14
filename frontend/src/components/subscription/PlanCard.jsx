import React, { useState } from "react";
import { Check, ArrowUp, ArrowDown, CreditCard, Gift, Sparkles, Eye, ChevronDown, ChevronUp, Plus, Minus, X } from "lucide-react";
import FeaturesModal from "./FeaturesModal";
import { ruleForProduct, discountForItem } from "../../utils/couponHelpers";

const PlanCard = ({
  plan,
  currentSubscription,
  billingCycle,
  onSelectPlan,
  processing,
  locked, // disabled without spinner (e.g. downgrade pending)
  isScheduledTarget, // this card IS the plan a downgrade is scheduled to become — informational only
  // Expansion / add-on props
  isExpanded,
  onExpand,
  addons,        // undefined = not yet loaded, [] = loaded but empty
  selectedAddons,
  onAddonChange,
  onRemoveAddon,
  couponRules, // per-product discount rules from a coupon applied on the plans page, or null
}) => {
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);

  const getCurrentPrice = () => (plan.trial ? 0 : billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice);

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(price);

  const isCurrentPlan = () => {
    if (!currentSubscription || !currentSubscription.isPaymentConfirmed) return false;
    if (currentSubscription.isTrialActive && plan.trial) return true;
    return currentSubscription.planName === plan.id && currentSubscription.billingCycle === billingCycle;
  };

  const isPendingPayment = () =>
    currentSubscription &&
    currentSubscription.planName === plan.id &&
    currentSubscription.billingCycle === billingCycle &&
    !currentSubscription.isPaymentConfirmed &&
    currentSubscription.paymentStatus === "pending_payment";

  const shouldHidePlan = () =>
    plan.trial &&
    currentSubscription &&
    !currentSubscription.isTrialActive &&
    currentSubscription.status === "active" &&
    currentSubscription.trialUsed;

  const getActionType = () => {
    if (plan.trial) {
      if (currentSubscription?.isTrialActive) return "Current Trial";
      if (currentSubscription?.trialUsed) return "Free Trial Used";
      return "Start Trial";
    }
    if (isPendingPayment()) return "Complete Payment";
    if (!currentSubscription || currentSubscription.isTrialActive || !currentSubscription.isPaymentConfirmed)
      return "Subscribe";

    const planPriority = { starter: 1, growth: 2, business: 3 };
    const currentPlanPriority = planPriority[currentSubscription.planName] || 0;
    const selectedPlanPriority = planPriority[plan.id] || 0;
    const now = new Date();
    const isMidCycle = now < new Date(currentSubscription.currentPeriodEnd);

    if (selectedPlanPriority > currentPlanPriority) return "Upgrade";
    if (selectedPlanPriority < currentPlanPriority) return "Downgrade";
    if (currentSubscription.billingCycle !== billingCycle)
      return isMidCycle
        ? "Cycle Change Not Available"
        : billingCycle === "yearly"
        ? "Switch to Annual"
        : "Switch to Monthly";
    return "Current Plan";
  };

  const getActionIcon = () => {
    const action = getActionType();
    if (plan.trial) return <Gift className="w-4 h-4" />;
    if (action === "Upgrade") return <ArrowUp className="w-4 h-4" />;
    if (action === "Downgrade") return <ArrowDown className="w-4 h-4" />;
    return <CreditCard className="w-4 h-4" />;
  };

  const getActionColor = () => {
    const action = getActionType();
    if (plan.trial) return "bg-green-600 hover:bg-green-700";
    if (action === "Upgrade") return "bg-green-600 hover:bg-green-700";
    if (action === "Downgrade") return "bg-orange-600 hover:bg-orange-700";
    if (action.includes("Switch")) return "bg-purple-600 hover:bg-purple-700";
    return "bg-blue-600 hover:bg-blue-700";
  };

  if (shouldHidePlan()) return null;

  const price = getCurrentPrice();
  const action = getActionType();
  const isCurrentActive = isCurrentPlan();

  const getCardStyles = () => {
    if (plan.popular) {
      return {
        container: "bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 border-0 transform scale-105 shadow-2xl",
        text: "text-white",
        subtext: "text-purple-100",
        icon: "bg-white/20 text-white",
        badge: "bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900",
        button: "bg-white text-purple-600 hover:bg-gray-100 font-semibold",
        checkBg: "bg-white/20",
        checkIcon: "text-white",
        priceHighlight: "text-white",
        viewMoreButton: "text-white hover:bg-white/10",
        expandBtn: "text-white/70 hover:text-white",
        addonBg: "bg-white/10",
        addonText: "text-white",
        addonSubtext: "text-purple-200",
        addonBorder: "border-white/20",
        totalBg: "bg-white/10",
        totalText: "text-white",
      };
    }
    return {
      container: "bg-white border border-gray-200 hover:border-gray-300 hover:shadow-lg",
      text: "text-gray-900",
      subtext: "text-gray-500",
      icon:
        plan.color === "blue"
          ? "bg-blue-50 text-blue-600"
          : plan.color === "purple"
          ? "bg-purple-50 text-purple-600"
          : plan.color === "green"
          ? "bg-green-50 text-green-600"
          : "bg-amber-50 text-amber-600",
      badge: plan.trial ? "bg-green-500 text-white" : "bg-blue-500 text-white",
      button: getActionColor() + " text-white",
      checkBg: "bg-green-50",
      checkIcon: "text-green-600",
      priceHighlight: "text-gray-900",
      viewMoreButton: "text-blue-600 hover:bg-blue-50",
      expandBtn: "text-gray-400 hover:text-gray-600",
      addonBg: "bg-gray-50",
      addonText: "text-gray-800",
      addonSubtext: "text-gray-500",
      addonBorder: "border-gray-100",
      totalBg: "bg-blue-50",
      totalText: "text-blue-700",
    };
  };

  const styles = getCardStyles();
  const hasMoreFeatures = plan.features.length > 6;

  // Live total calculation
  const addonsTotal = (addons || []).reduce((sum, a) => {
    const qty = selectedAddons?.[a.key] || 0;
    const unitPrice = billingCycle === "yearly" ? a.price?.yearly : a.price?.monthly;
    return sum + qty * (unitPrice || 0);
  }, 0);
  const liveTotal = price + addonsTotal;

  // Coupon discount preview — applied on the plans page, rippled onto every
  // OTHER card here so the customer sees the discount before checkout even
  // opens. This only previews a FUTURE purchase's pricing — it must never be
  // used for the card that represents the ALREADY-PAID current subscription,
  // which has its own frozen snapshot below.
  const planRule = couponRules ? ruleForProduct(couponRules, "plan", plan.id) : null;
  const planDiscount = planRule ? discountForItem(planRule, price) : 0;
  const addonsDiscount = couponRules
    ? (addons || []).reduce((sum, a) => {
        const qty = selectedAddons?.[a.key] || 0;
        if (qty <= 0) return sum;
        const unitPrice = billingCycle === "yearly" ? a.price?.yearly : a.price?.monthly;
        const rule = ruleForProduct(couponRules, "addon", a.key);
        return sum + discountForItem(rule, qty * (unitPrice || 0));
      }, 0)
    : 0;
  const totalDiscount = planDiscount + addonsDiscount;
  const discountedLiveTotal = Math.max(0, liveTotal - totalDiscount);

  // The current-plan card renders its price from the SUBSCRIPTION SNAPSHOT,
  // not catalog pricing — same struck-through/discounted/savings visual
  // language as every catalog card, just sourced from what was actually
  // billed. The detailed subtotal/GST/recurring-total breakdown lives ONLY
  // in CurrentSubscriptionInfo — this card stays a product card, not a second
  // invoice. Every other card (upgrade/downgrade targets) keeps using catalog
  // + page-level couponRules preview, since those represent a hypothetical
  // future purchase, not what's already billed.
  const useSubscriptionSnapshot = isCurrentActive && !!currentSubscription?.appliedCoupon?.code;
  const appliedCoupon = useSubscriptionSnapshot ? currentSubscription.appliedCoupon : null;
  const snapshotBaseSubtotal = appliedCoupon?.baseSubtotal ?? liveTotal;
  const snapshotDiscount = appliedCoupon?.discountAmount ?? 0;
  const snapshotRecurringSubtotal = appliedCoupon ? (appliedCoupon.recurringSubtotal ?? (snapshotBaseSubtotal - snapshotDiscount)) : liveTotal;

  // Allow clicking "Add Add-ons" even on the current plan when addons are selected
  const hasSelectedAddons = addonsTotal > 0;
  // The active subscription's own card must keep behaving exactly as before —
  // a scheduled downgrade should never disable actions on the CURRENT plan.
  // `locked` (and the scheduled-target's informational-only state) only apply
  // to other cards, since acting on them while a change is pending is ambiguous.
  const isDisabled =
    processing ||
    (locked && !isCurrentActive) ||
    isScheduledTarget ||
    (isCurrentActive && !hasSelectedAddons) ||
    action === "Cycle Change Not Available" ||
    action === "Free Trial Used" ||
    action === "Current Trial";

  const displayAction =
    action === "Complete Payment" && processing
      ? "Processing Payment..."
      : isCurrentActive && hasSelectedAddons
      ? "Add Add-ons"
      : action;

  return (
    <>
      <div className={`relative rounded-xl p-5 transition-all duration-300 ${styles.container}`}>
        {/* Popular Badge */}
        {plan.popular && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <div className={`${styles.badge} px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg`}>
              <Sparkles className="w-3 h-3" />
              MOST POPULAR
            </div>
          </div>
        )}

        {/* Trial Badge */}
        {plan.trial && !plan.popular && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <div className={`${styles.badge} px-3 py-1 rounded-full text-xs font-semibold shadow-md`}>
              Free Trial
            </div>
          </div>
        )}

        {/* Current Plan Badge */}
        {isCurrentActive && !plan.trial && (
          <div className="absolute -top-3 right-4">
            <div className={`${styles.badge} px-3 py-1 rounded-full text-xs font-semibold shadow-md`}>
              Current
            </div>
          </div>
        )}

        {/* Icon & Title */}
        <div className="text-center mb-4">
          <div className={`inline-flex p-2 rounded-lg ${styles.icon} mb-2`}>{plan.icon}</div>
          <h3 className={`text-lg font-bold ${styles.text} mb-1`}>{plan.name}</h3>
          <p className={`text-xs ${styles.subtext}`}>{plan.tagline}</p>
        </div>

        {/* Price */}
        <div className="text-center mb-4">
          {plan.trial ? (
            <div>
              <div className={`text-2xl font-bold ${plan.popular ? "text-white" : "text-green-600"} mb-1`}>FREE</div>
              <div className={`text-xs ${styles.subtext}`}>{plan.trialDays} days trial</div>
            </div>
          ) : useSubscriptionSnapshot ? (
            // Current plan, purchased with a coupon — same visual language as
            // every catalog card (struck original price, discounted price,
            // savings note, GST note). NO billing breakdown here — subtotal/
            // GST/recurring total are the Current Subscription section's job,
            // not this card's. Numbers still come only from the subscription
            // snapshot, never recomputed from catalog + live coupon rules.
            <div>
              <div className="flex items-baseline justify-center gap-1.5 mb-1">
                <span className={`text-sm line-through ${plan.popular ? "text-white/50" : "text-gray-400"}`}>
                  {formatPrice(snapshotBaseSubtotal)}
                </span>
                <h6 className="text-2xl font-bold text-green-500">
                  {formatPrice(snapshotRecurringSubtotal)}
                </h6>
                <span className={`${styles.subtext} ml-1 text-xs`}>/{billingCycle === "monthly" ? "mo" : "yr"}</span>
              </div>
              <p className="text-xs font-semibold text-green-600 mt-0.5">
                Coupon Applied — {appliedCoupon.code}
              </p>
              <p className="text-xs font-semibold text-green-600">
                You save {formatPrice(snapshotDiscount)} every billing cycle
              </p>
              <p className={`text-xs ${styles.subtext} mt-1`}>+ 18% GST</p>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline justify-center gap-1.5 mb-1">
                {totalDiscount > 0 && (
                  <span className={`text-sm line-through ${plan.popular ? "text-white/50" : "text-gray-400"}`}>
                    {formatPrice(liveTotal)}
                  </span>
                )}
                <h6 className={`text-2xl font-bold ${totalDiscount > 0 ? "text-green-500" : styles.priceHighlight}`}>
                  {formatPrice(discountedLiveTotal)}
                </h6>
                <span className={`${styles.subtext} ml-1 text-xs`}>/{billingCycle === "monthly" ? "mo" : "yr"}</span>
              </div>
              {totalDiscount > 0 && (
                <p className="text-xs font-semibold text-green-600 mt-0.5">
                  Coupon saves you {formatPrice(totalDiscount)}
                </p>
              )}
              {addonsTotal > 0 && (
                <p className={`text-xs ${styles.subtext} mt-0.5`}>
                  Base {formatPrice(price)} + Add-ons {formatPrice(addonsTotal)}
                </p>
              )}
              {billingCycle === "yearly" && plan.discount > 0 && (
                <p className={`${plan.popular ? "text-green-300" : "text-green-600"} text-xs font-medium mt-0.5`}>
                  Save {plan.discount}% annually
                </p>
              )}
              <p className={`text-xs ${styles.subtext} mt-1`}>+ 18% GST</p>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="space-y-2 mb-4">
          {plan.features.slice(0, 6).map((feature, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className={`flex-shrink-0 w-4 h-4 ${styles.checkBg} rounded-full flex items-center justify-center mt-0.5`}>
                <Check className={`w-2.5 h-2.5 ${styles.checkIcon}`} />
              </div>
              <span className={`text-xs ${styles.text}`}>{feature.name}</span>
            </div>
          ))}
          {hasMoreFeatures && (
            <button
              onClick={() => setShowFeaturesModal(true)}
              className={`flex items-center gap-1.5 text-xs font-medium ${styles.viewMoreButton} pl-6 py-2 rounded-md transition-colors`}
            >
              <Eye className="w-3.5 h-3.5" />
              View all {plan.features.length} features
            </button>
          )}
        </div>

        {/* Owned add-ons summary — shown on current plan card even when not expanded */}
        {isCurrentActive && !plan.trial && (currentSubscription?.activeAddons || []).length > 0 && (
          <div className={`mb-3 rounded-lg px-3 py-2 ${styles.addonBg} border ${styles.addonBorder}`}>
            <p className={`text-xs font-semibold mb-1.5 ${styles.addonSubtext}`}>Your Add-ons</p>
            <div className="flex flex-wrap gap-1.5">
              {currentSubscription.activeAddons.map((addon) => {
                const displayName = addon.addonKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                const pendingRemovals = currentSubscription?.pendingAddonRemovals || [];
                const removal = pendingRemovals.find((r) => r.addonKey === addon.addonKey);
                const pendingQty = removal?.quantity || 0;
                const allPending = addon.quantity - pendingQty <= 0;
                const removalDate = removal?.effectiveAt
                  ? new Date(removal.effectiveAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  : null;
                return (
                  <span
                    key={addon.addonKey}
                    title={allPending ? `Removing on ${removalDate || 'cycle end'} — access until then` : undefined}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      allPending
                        ? (plan.popular ? "bg-white/10 text-white/60 line-through decoration-white/40" : "bg-gray-100 text-gray-400 line-through")
                        : (plan.popular ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700")
                    }`}
                  >
                    {displayName}
                    {addon.quantity > 1 && <span className="font-bold ml-0.5">×{addon.quantity}</span>}
                    {allPending ? (
                      <span className={`no-underline ml-1 text-[10px] font-normal ${plan.popular ? "text-white/70" : "text-amber-600"}`}>
                        removing {removalDate || 'soon'}
                      </span>
                    ) : onRemoveAddon ? (
                      <button
                        onClick={() => onRemoveAddon(addon.addonKey, displayName)}
                        title={`Remove 1 × ${displayName}`}
                        className={`ml-0.5 rounded-full p-0.5 transition-colors ${plan.popular ? "hover:bg-white/30 text-white/70 hover:text-white" : "hover:bg-red-100 text-blue-400 hover:text-red-600"}`}
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Scheduled-target cards are informational only — purchasing or
            configuring add-ons on the not-yet-active plan is ambiguous (which
            subscription would it apply to?). Any future "edit the scheduled
            plan" support should be its own flow, not this add-on UI. */}
        {isScheduledTarget ? (
          <div className={`mb-3 rounded-lg px-3 py-2 text-xs text-center ${plan.popular ? "bg-white/10 text-white/70" : "bg-gray-50 text-gray-500"}`}>
            Add-ons for this plan can be set once it becomes active.
          </div>
        ) : (
          <>
            {/* Add-ons expander — only for paid plans */}
            {!plan.trial && onExpand && (
              <button
                onClick={onExpand}
                className={`w-full flex items-center justify-between text-xs font-medium mb-3 px-2 py-1.5 rounded-lg transition-colors ${styles.expandBtn}`}
              >
                <span>Customize with Add-ons</span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </>
        )}

        {/* Expanded add-on section */}
        {isExpanded && !plan.trial && !isScheduledTarget && (
          <div className={`mb-4 rounded-lg p-3 ${styles.addonBg} border ${styles.addonBorder}`}>
            {addons === undefined ? (
              <div className="flex items-center justify-center py-3">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span className={`ml-2 text-xs ${styles.addonSubtext}`}>Loading add-ons...</span>
              </div>
            ) : addons.length === 0 ? (
              <p className={`text-xs text-center py-2 ${styles.addonSubtext}`}>
                No add-ons available for this plan.
              </p>
            ) : (
              <div className="space-y-3">
                {addons.map((addon) => {
                  const unitPrice = billingCycle === "yearly" ? addon.price?.yearly : addon.price?.monthly;
                  const qty = selectedAddons?.[addon.key] ?? 1;
                  const max = addon.maxQuantityPerOrg ?? 99;
                  const addonRule = couponRules ? ruleForProduct(couponRules, "addon", addon.key) : null;
                  return (
                    <div key={addon.key} className={`flex items-center justify-between gap-2 pb-2 border-b ${styles.addonBorder} last:border-0 last:pb-0`}>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${styles.addonText} truncate`}>
                          {addon.displayName}
                          {addonRule && (
                            <span className="ml-1.5 text-[10px] font-semibold text-green-600">
                              {addonRule.discountType === "percentage" ? `${addonRule.discountValue}% off` : `₹${addonRule.discountValue} off`}
                            </span>
                          )}
                        </p>
                        <p className={`text-xs ${styles.addonSubtext}`}>
                          Add: {formatPrice(unitPrice)}/{billingCycle === "monthly" ? "mo" : "yr"} each
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {addon.pricingType === "boolean" ? (
                          <button
                            onClick={() => onAddonChange(addon.key, qty > 0 ? 0 : 1)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${qty > 0 ? "bg-blue-600" : plan.popular ? "bg-white/30" : "bg-gray-300"}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${qty > 0 ? "translate-x-4" : "translate-x-0.5"}`} />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => onAddonChange(addon.key, Math.max(0, qty - 1))}
                              disabled={qty === 0}
                              className={`w-6 h-6 flex items-center justify-center rounded border text-xs font-bold disabled:opacity-40 ${plan.popular ? "border-white/40 text-white hover:bg-white/10" : "border-gray-300 text-gray-600 hover:bg-gray-100"}`}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className={`w-5 text-center text-xs font-semibold ${styles.addonText}`}>{qty}</span>
                            <button
                              onClick={() => onAddonChange(addon.key, Math.min(max, qty + 1))}
                              disabled={qty >= max}
                              className={`w-6 h-6 flex items-center justify-center rounded text-xs disabled:opacity-40 ${plan.popular ? "bg-white/20 text-white hover:bg-white/30" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={() => !isDisabled && onSelectPlan(plan)}
          disabled={isDisabled}
          className={`w-full py-2.5 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center text-sm ${
            isDisabled
              ? plan.popular
                ? "bg-white/20 text-white/50 cursor-not-allowed"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
              : processing
              ? plan.popular
                ? "bg-white/30 text-white cursor-not-allowed"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
              : styles.button
          } shadow-md hover:shadow-lg`}
        >
          {processing ? (
            <div className="flex items-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Processing...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {getActionIcon()}
              <span>
                {isScheduledTarget
                  ? "Scheduled"
                  : action === "Cycle Change Not Available"
                  ? "Available at Renewal"
                  : displayAction}
              </span>
            </div>
          )}
        </button>
      </div>

      {/* Features Modal */}
      <FeaturesModal isOpen={showFeaturesModal} onClose={() => setShowFeaturesModal(false)} plan={plan} />
    </>
  );
};

export default PlanCard;
