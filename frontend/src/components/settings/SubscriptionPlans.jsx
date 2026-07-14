// components/settings/SubscriptionPlans.jsx
import React, { useState, useEffect, useRef } from "react";
import { Gift, Building2, Star, Crown, CheckCircle, AlertCircle, X, Users } from "lucide-react";
import { useSubscription } from "../../contexts/SubscriptionContext";
import PlanCard from "../subscription/PlanCard";
import CurrentSubscriptionInfo from "../subscription/CurrentSubscriptionInfo";
import TrialModal from "../subscription/TrialModal";
import CheckoutSummaryModal from "../subscription/CheckoutSummaryModal";
import FeatureComparisonTable from "../subscription/FeatureComparisonTable";
import FAQ from "../subscription/FAQ";
import useRazorpay from "../../hooks/useRazorpay";
import PaymentStatusAlert from "../subscription/PaymentStatusAlert";
import { subscriptionAPI } from "../../services/subscriptionApi";
import SuccessConfetti from "../subscription/SuccessConfetti";
import { hasValidPendingUpdate } from "../../utils/subscriptionHelpers";
import { formatPrice } from "../../utils/pricingSnapshot";
import { waitForSettlement } from "../../utils/waitForSettlement";
import { Tag, CheckCircle2 } from "lucide-react";

// Icon map — keyed by planId
const PLAN_ICONS = {
  trial:    <Gift className="w-6 h-6" />,
  starter:  <Building2 className="w-6 h-6" />,
  growth:   <Star className="w-6 h-6" />,
  business: <Crown className="w-6 h-6" />,
};

const PLAN_COLORS = {
  trial:    "green",
  starter:  "blue",
  growth:   "purple",
  business: "amber",
};

const PLAN_TAGLINES = {
  trial:    "7 Days Free — All Growth Features",
  starter:  "Perfect for small teams",
  growth:   "Best for growing businesses",
  business: "For established businesses",
};

const PLAN_POPULAR = {
  growth: true,
};

const SubscriptionPlans = () => {
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = currentUser?.role === "admin";

  const [billingCycle, setBillingCycle] = useState("monthly");
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [showTrialModal, setShowTrialModal] = useState(false);
  const { razorpayLoaded, openCheckout } = useRazorpay();
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const pollCancelledRef = useRef(false);
  useEffect(() => {
    return () => { pollCancelledRef.current = true; };
  }, []);

  // Add-on state
  const [planAddons, setPlanAddons] = useState({}); // { [planId]: addon[] }
  const [expandedPlan, setExpandedPlan] = useState(null); // planId of expanded card
  const [selectedAddons, setSelectedAddons] = useState({}); // { [addonKey]: quantity }
  const [checkoutData, setCheckoutData] = useState(null); // modal data, null = closed

  // Coupon applied on this page (before checkout). Holds { code, name, rules }.
  // Discounts ripple onto every plan/add-on card via the coupon's per-product
  // rules, and carry into the checkout modal for its inline breakdown.
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Referral code — manual entry only. A code captured from a shared link
  // is already applied and cleared from localStorage during registration
  // (see Login.jsx/App.jsx) by the time an org reaches this page, so this
  // field is for someone who wasn't referred via link. Applies immediately
  // via its own Apply button (mirrors the coupon field), not folded into
  // Subscribe/Start Trial — the backend never uses it to discount THIS
  // purchase either way (see REFERRAL_SYSTEM_DESIGN.md §3/§24 and
  // PROJECT_STATE.md §11).
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [referralApplied, setReferralApplied] = useState(false);
  const [referredByName, setReferredByName] = useState(null);
  const [referralError, setReferralError] = useState("");
  const [applyingReferral, setApplyingReferral] = useState(false);

  // A referral recorded from a shared link happens at registration, so by the
  // time this page loads the Referral already exists in the DB — reflect that
  // real state instead of re-asking. If the org already has a referrer, show
  // "applied"; only orgs with no referrer see the manual-entry fallback box.
  useEffect(() => {
    let cancelled = false;
    subscriptionAPI.getReferralOverview()
      .then((res) => {
        if (cancelled) return;
        if (res.data?.referredBy) {
          setReferralApplied(true);
          setReferredByName(res.data.referredBy.referrerOrganization?.name || null);
        }
      })
      .catch(() => {}); // non-fatal — falls back to showing the manual entry box
    return () => { cancelled = true; };
  }, []);

  const {
    subscription,
    plans,
    loading,
    error,
    startTrial,
    createSubscription,
    updateSubscription,
    fetchSubscription,
  } = useSubscription();
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelFeedback, setCancelFeedback] = useState("");

  // Plan catalog comes from SubscriptionContext (fetchPlans) — one fetch
  // path, shared with everything else that needs the plan list, instead of
  // an independent copy fetched here too.

  // Build planStructure from API data, enriched with UI metadata
  const planStructure = plans.map((p) => ({
    ...p,
    icon: PLAN_ICONS[p.planId] || <Building2 className="w-6 h-6" />,
    tagline: PLAN_TAGLINES[p.planId] || "",
    color: PLAN_COLORS[p.planId] || "blue",
    popular: !!PLAN_POPULAR[p.planId],
    trial: p.planId === "trial",
    trialDays: 7,
  }));

  const handleCancelSubscription = async () => {
    setProcessing(true);
    try {
      const response = await subscriptionAPI.cancelSubscription({
        reason: cancelReason,
        feedback: cancelFeedback,
      });
      setMessage({
        type: "success",
        text:
          response.data.message ||
          "Subscription cancelled successfully. You can continue using the service until the end of your billing period.",
      });
      setShowCancelModal(false);
      setCancelReason("");
      setCancelFeedback("");
      await fetchSubscription();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Failed to cancel subscription",
      });
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (subscription?.subscription) {
      setBillingCycle(subscription.subscription.billingCycle || "monthly");
    }
  }, [subscription]);

  // Two distinct gates, deliberately separated:
  //  - couponAppliesAtCheckout: the coupon is actually WIRED to discount the
  //    charge. Only the new-subscription flow (new signup / trial conversion)
  //    passes couponCode to the backend and gets a discounted Razorpay plan.
  //    Upgrade + add-on-purchase flows do NOT read a coupon yet, so we must
  //    not show discounted prices on those cards or we'd promise a discount
  //    the backend won't honour.
  //  - showCouponWidget: whether the apply/remove widget is visible at all.
  //    Paid subscribers can see + control an applied coupon (per request), but
  //    for them it's informational until the upgrade/add-on flows are wired.
  const isPaidSub = subscription?.subscription?.isPaymentConfirmed;
  const couponAppliesAtCheckout = !subscription?.subscription || !isPaidSub;
  const showCouponWidget = isAdmin;

  const applyCoupon = async (codeArg) => {
    const code = (codeArg ?? couponInput).trim();
    if (!code) return;
    setValidatingCoupon(true);
    setCouponError("");
    try {
      const res = await subscriptionAPI.previewCoupon({ code, billingCycle });
      setAppliedCoupon(res.data); // { valid, code, name, rules }
      setCouponInput("");
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.response?.data?.error || "Invalid coupon code");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  // Applies a manually-typed referral code immediately — creates
  // Referral(pending) right away (business event: "we know this org used
  // this code"), independent of whether the org ever starts a trial or
  // pays. Never discounts this checkout; see the field's own copy for why.
  const handleApplyReferral = async () => {
    const code = referralCodeInput.trim();
    if (!code) return;
    setApplyingReferral(true);
    setReferralError("");
    try {
      await subscriptionAPI.applyReferralCode(code);
      setReferralApplied(true);
    } catch (err) {
      setReferralApplied(false);
      setReferralError(err.response?.data?.error || "Invalid referral code");
    } finally {
      setApplyingReferral(false);
    }
  };

  // If the billing cycle changes while a coupon is applied, re-check it — the
  // coupon may be restricted to monthly/yearly, so it can silently become
  // invalid. Re-preview and drop it (with a notice) if it no longer applies.
  useEffect(() => {
    if (!appliedCoupon?.code) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await subscriptionAPI.previewCoupon({ code: appliedCoupon.code, billingCycle });
        if (!cancelled) setAppliedCoupon(res.data);
      } catch (err) {
        if (!cancelled) {
          setAppliedCoupon(null);
          setMessage({ type: "warning", text: err.response?.data?.error || "Coupon no longer applies to the selected billing cycle." });
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingCycle]);

  const handleTrialStart = async () => {
    setProcessing(true);
    try {
      await startTrial();
      setMessage({
        type: "success",
        text: "Free trial activated! Enjoy all Growth features for 7 days.",
      });
      setShowTrialModal(false);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Failed to start trial",
      });
    } finally {
      setProcessing(false);
    }
  };

  // Toggle expansion of a plan card and lazily load its add-ons
  const handleRemoveAddon = (addonKey, displayName) => {
    const sub = subscription?.subscription;
    const activeAddon = (sub?.activeAddons || []).find((a) => a.addonKey === addonKey);
    if (!activeAddon) return;
    setCheckoutData({
      type: 'addon_removal',
      addonKey,
      displayName,
      quantity: 1,
      pricePerUnit: activeAddon.pricePerUnit,
      currentTotal: sub.totalAmount,
      newRecurringTotal: sub.totalAmount - activeAddon.pricePerUnit,
      effectiveAt: sub.currentPeriodEnd,
      billingCycle: sub.billingCycle,
    });
  };

  const handleExpandPlan = async (planId) => {
    if (expandedPlan === planId) {
      setExpandedPlan(null);
      return;
    }
    setExpandedPlan(planId);

    // Pre-fill picker with owned quantities when expanding the current active plan
    const isCurrentActivePlan =
      subscription?.subscription?.isPaymentConfirmed &&
      !subscription?.subscription?.isTrialActive &&
      subscription?.subscription?.planName === planId;

    setSelectedAddons({});
    if (!planAddons[planId]) {
      try {
        const res = await subscriptionAPI.getAddonsForPlan(planId, billingCycle);
        setPlanAddons((prev) => ({ ...prev, [planId]: res.data.addons || [] }));
      } catch (err) {
        console.error("Failed to fetch addons for plan:", err);
        setPlanAddons((prev) => ({ ...prev, [planId]: [] }));
      }
    }
  };

  // Open the checkout summary modal instead of going straight to Razorpay
  const handlePlanSelection = async (plan) => {
    if (!isAdmin) {
      setMessage({
        type: "error",
        text: "Only organization admins can manage subscriptions. Please contact your admin.",
      });
      return;
    }
    if (processing || paymentInProgress) return;

    if (plan.trial) {
      setShowTrialModal(true);
      return;
    }

    const addons = planAddons[plan.id] || [];
    const selectedAddonsList = addons
      .filter((a) => (selectedAddons[a.key] || 0) > 0)
      .map((a) => ({
        ...a,
        quantity: selectedAddons[a.key],
        subtotal: selectedAddons[a.key] * (billingCycle === "yearly" ? a.price?.yearly : a.price?.monthly),
      }));

    const basePrice = billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
    const addonsTotal = selectedAddonsList.reduce((sum, a) => sum + a.subtotal, 0);
    const total = basePrice + addonsTotal;

    const isExistingActiveSub =
      subscription?.subscription?.isPaymentConfirmed &&
      !subscription?.subscription?.isTrialActive;

    const isSamePlan =
      subscription?.subscription?.planName === plan.id &&
      subscription?.subscription?.billingCycle === billingCycle;

    // Existing active subscriber changing only add-ons on their current plan
    if (isExistingActiveSub && isSamePlan) {
      const currentAddons = subscription.subscription.activeAddons || [];
      const allPlanAddons = planAddons[plan.id] || [];

      // selectedAddons[key] now represents HOW MANY MORE to add (delta), not total
      const addonChanges = allPlanAddons
        .map((a) => {
          const currentQty = currentAddons.find((c) => c.addonKey === a.key)?.quantity || 0;
          const delta = selectedAddons[a.key] || 0;
          const newQty = currentQty + delta;
          return {
            addonKey: a.key,
            displayName: a.displayName,
            delta,
            currentQty,
            newQty,
            pricePerUnit: billingCycle === "yearly" ? a.price?.yearly : a.price?.monthly,
          };
        })
        .filter((c) => c.delta > 0); // removals go through the × button, not this path

      if (addonChanges.length === 0) {
        setMessage({ type: "warning", text: "Select at least one add-on to purchase." });
        return;
      }

      const currentTotal = subscription.subscription.totalAmount || basePrice;
      const deltaTotal = addonChanges.reduce((sum, c) => sum + c.delta * c.pricePerUnit, 0);

      setCheckoutData({
        type: "addon_change",
        plan,
        addonChanges,
        currentTotal,
        newTotal: currentTotal + deltaTotal,
        billingCycle,
        selectedAddonsList: addonChanges.map((c) => ({
          key: c.addonKey,
          displayName: c.displayName,
          quantity: c.delta,
          subtotal: c.delta * c.pricePerUnit,
          price: { [billingCycle]: c.pricePerUnit },
        })),
      });
      return;
    }

    const planPriority = { starter: 1, growth: 2, business: 3 };

    // Tier DOWNGRADE — show confirmation modal; no payment required
    const isTierDowngrade =
      isExistingActiveSub && !isSamePlan &&
      (planPriority[plan.id] || 0) < (planPriority[subscription?.subscription?.planName] || 0);

    if (isTierDowngrade) {
      try {
        setProcessing(true);
        const compat = await subscriptionAPI.checkAddonCompatibility(plan.id, billingCycle);
        setProcessing(false);
        const newBasePrice = billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;

        // Filter out addons already pending removal from carry-forward
        const pendingRemovals = subscription?.subscription?.pendingAddonRemovals || [];
        const carryForwardAddons = (compat.data.compatibleCarryForward || []).filter((a) => {
          const removal = pendingRemovals.find((r) => r.addonKey === a.addonKey);
          return !(removal && removal.quantity >= a.quantity);
        });

        // New addons the user selected on the target plan card
        const targetPlanAddons = planAddons[plan.id] || [];
        const newSelectedAddons = Object.entries(selectedAddons)
          .filter(([key, qty]) => qty > 0 && targetPlanAddons.some((a) => a.key === key))
          .map(([key, qty]) => {
            const addonDef = targetPlanAddons.find((a) => a.key === key);
            const price = addonDef?.price?.[billingCycle] || 0;
            return { addonKey: key, quantity: qty, pricePerUnit: price };
          });

        const carryForwardTotal = carryForwardAddons.reduce((s, a) => s + a.quantity * a.pricePerUnit, 0);
        const newAddonsTotal = newSelectedAddons.reduce((s, a) => s + a.quantity * a.pricePerUnit, 0);
        const newRecurringTotal = newBasePrice + carryForwardTotal + newAddonsTotal;

        setCheckoutData({
          type: "plan_downgrade",
          plan,
          billingCycle,
          newBasePrice,
          newRecurringTotal,
          periodEnd: subscription?.subscription?.currentPeriodEnd,
          incompatibleAddons: compat.data.incompatibleDropped || [],
          carriedForwardAddons: carryForwardAddons,
          newAddonsList: newSelectedAddons,
          userCount: subscription?.subscription?.userCount || 1,
        });
      } catch (err) {
        setProcessing(false);
        setMessage({ type: "error", text: err.response?.data?.error || "Could not check plan compatibility." });
      }
      return;
    }

    // Tier UPGRADE (same billing cycle) — fetch the real prorated amount from the
    // backend so the checkout modal shows exactly what will be charged NOW, plus
    // the new recurring total. Nothing is committed until the user pays.
    const isTierUpgrade =
      isExistingActiveSub && !isSamePlan &&
      billingCycle === subscription?.subscription?.billingCycle &&
      (planPriority[plan.id] || 0) > (planPriority[subscription?.subscription?.planName] || 0);

    if (isTierUpgrade) {
      try {
        setProcessing(true);
        // Pass add-ons the user selected on this plan card as NEW purchases
        const newAddons = Object.entries(selectedAddons)
          .filter(([, qty]) => qty > 0)
          .map(([key, qty]) => ({ key, quantity: qty }));
        const resp = await updateSubscription({ planId: plan.id, billingCycle, addons: newAddons });
        setProcessing(false);
        if (resp?.paymentDetails) {
          setCheckoutData({
            type: "plan_upgrade",
            plan,
            billingCycle,
            proratedAmount: resp.proratedAmount,
            referralDiscountApplied: resp.referralDiscountApplied, // already-computed by backend; only surfaced in the UI
            newRecurringTotal: resp.newRecurringTotal,
            carriedForwardAddons: resp.carriedForwardAddons || [],
            newAddonsList: resp.newAddonsList || [],
            incompatibleAddons: resp.incompatibleAddons || [],
            paymentDetails: resp.paymentDetails,
          });
        } else {
          setMessage({ type: "error", text: resp?.message || "Could not initiate upgrade." });
        }
      } catch (err) {
        setProcessing(false);
        setMessage({ type: "error", text: err.response?.data?.error || "Upgrade failed to initiate." });
      }
      return;
    }

    // For plan changes by existing active subscribers, pre-flight compatibility check
    let compatibleCarryForward = [];
    let incompatibleDropped = [];
    let carryForwardTotal = 0;
    if (isExistingActiveSub && !isSamePlan && (subscription?.subscription?.activeAddons || []).length > 0) {
      try {
        const compat = await subscriptionAPI.checkAddonCompatibility(plan.id, billingCycle);
        compatibleCarryForward = compat.data.compatibleCarryForward || [];
        incompatibleDropped = compat.data.incompatibleDropped || [];
        carryForwardTotal = compatibleCarryForward.reduce((sum, a) => sum + a.quantity * a.pricePerUnit, 0);
      } catch (err) {
        console.error('Compatibility check failed:', err);
      }
    }

    // If a coupon was already applied on the plans page, re-price it against
    // this exact plan + add-on selection so checkout's inline breakdown shows
    // the precise per-line discount — applying happened outside, this just
    // carries the already-applied coupon's effect into checkout.
    let checkoutCoupon = null;
    if (appliedCoupon?.code && couponAppliesAtCheckout) {
      try {
        const lineItems = [
          { key: plan.id, type: "plan", amount: basePrice },
          ...selectedAddonsList.map((a) => ({ key: a.key, type: "addon", amount: a.subtotal })),
        ];
        const res = await subscriptionAPI.validateCoupon({
          code: appliedCoupon.code,
          planId: plan.id,
          billingCycle,
          lineItems,
        });
        checkoutCoupon = res.data;
      } catch (err) {
        checkoutCoupon = null;
      }
    }

    setCheckoutData({
      plan,
      selectedAddonsList,
      basePrice,
      addonsTotal,
      total: total + carryForwardTotal,
      billingCycle,
      compatibleCarryForward,
      incompatibleDropped,
      appliedCoupon: checkoutCoupon,
    });
  };

  const openRazorpay = (paymentDetails) => {
    const checkoutOptions = {
      ...paymentDetails,
      handler: async function (paymentResponse) {
        setShowConfetti(true);
        setMessage({ type: "success", text: "Payment successful! Verifying..." });
        setPaymentInProgress(true);
        setTimeout(() => setShowConfetti(false), 3500);
        try {
          const verificationResult = await subscriptionAPI.verifyPayment({
            razorpay_payment_id: paymentResponse.razorpay_payment_id,
            razorpay_subscription_id: paymentResponse.razorpay_subscription_id,
            razorpay_signature: paymentResponse.razorpay_signature,
          });
          if (verificationResult.data.success) {
            setMessage({ type: "success", text: "Payment confirmed! Subscription updated successfully." });
            setPaymentInProgress(false);
            await fetchSubscription();
            setTimeout(() => { window.location.href = "/"; }, 1500);
          } else {
            setMessage({ type: "warning", text: "Payment received. Verification in progress..." });
            startPolling();
          }
        } catch (verificationError) {
          console.error("Client verification failed:", verificationError);
          setMessage({ type: "warning", text: "Payment received. Waiting for confirmation..." });
          startPolling();
        }
      },
      modal: {
        ondismiss: function () {
          setMessage({ type: "warning", text: "Payment cancelled. Your subscription remains unchanged." });
          setPaymentInProgress(false);
        },
      },
      onPaymentFailed: function (error) {
        setMessage({ type: "error", text: `Payment failed: ${error.description}` });
        setPaymentInProgress(false);
      },
    };
    openCheckout(checkoutOptions);
  };

  // Called by the checkout modal's Confirm & Pay button
  const handleConfirmCheckout = async () => {
    if (!checkoutData) return;
    setProcessing(true);
    setMessage("");

    try {
      // Plan upgrade — Order already created at preview; just open Razorpay
      if (checkoutData.type === "plan_upgrade") {
        const details = checkoutData.paymentDetails;
        setCheckoutData(null);
        setProcessing(false);
        if (details && razorpayLoaded) {
          openRazorpay(details);
        } else {
          setMessage({ type: "error", text: "Payment could not be started. Please try again." });
        }
        return;
      }

      // Plan downgrade — schedule at cycle end, no payment
      if (checkoutData.type === "plan_downgrade") {
        await updateSubscription({
          planId: checkoutData.plan.id,
          billingCycle: checkoutData.billingCycle,
          userCount: checkoutData.userCount,
        });
        setCheckoutData(null);
        await fetchSubscription();
        const _pd = checkoutData.periodEnd ? new Date(checkoutData.periodEnd) : null;
        const dateStr = (_pd && _pd.getFullYear() >= 2020)
          ? _pd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : "end of billing period";
        setMessage({
          type: "success",
          text: `Downgrade to ${checkoutData.plan.name || checkoutData.plan.id} scheduled for ${dateStr}.`,
        });
        return;
      }

      // Addon removal — scheduled for cycle end, no payment
      if (checkoutData.type === "addon_removal") {
        const result = await subscriptionAPI.scheduleAddonRemoval({
          addonKey: checkoutData.addonKey,
          quantity: 1,
        });
        const effectiveDate = new Date(result.data.effectiveAt).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
        });
        setCheckoutData(null);
        await fetchSubscription();
        setMessage({ type: 'success', text: `Removal scheduled for ${effectiveDate}. You'll keep access until then.` });
        return;
      }

      // Addon-only change on an already-active subscription
      if (checkoutData.type === "addon_change") {
        const isExistingActiveSub = subscription?.subscription?.isPaymentConfirmed;
        const isSamePlan = checkoutData?.plan?.id === subscription?.subscription?.planName;
        if (isExistingActiveSub && isSamePlan) {
          const additions = checkoutData.addonChanges.filter((c) => c.delta > 0);
          const removals = checkoutData.addonChanges.filter((c) => c.delta < 0);

          // Don't allow mixed adds and removes in one checkout action
          if (additions.length > 0 && removals.length > 0) {
            setMessage({ type: "error", text: "Please add and remove add-ons separately." });
            setProcessing(false);
            return;
          }

          // Handle removals — scheduled for cycle end, no payment needed
          if (removals.length > 0) {
            for (const change of removals) {
              await subscriptionAPI.scheduleAddonRemoval({
                addonKey: change.addonKey,
                quantity: Math.abs(change.delta),
              });
            }
            setCheckoutData(null);
            setSelectedAddons({});
            await fetchSubscription();
            setMessage({
              type: "success",
              text: `Add-on removal scheduled. You'll keep access until the end of your current billing period.`,
            });
            return;
          }

          // Handle additions — prorated Order-based checkout
          if (additions.length > 1) {
            setMessage({ type: "error", text: "Please purchase one add-on at a time." });
            setProcessing(false);
            return;
          }

          const change = additions[0];
          const result = await subscriptionAPI.initiateAddonPurchase({
            addonKey: change.addonKey,
            quantity: change.delta,
          });

          const { paymentDetails } = result.data;
          setCheckoutData(null);
          setSelectedAddons({});
          setProcessing(false);
          setPaymentInProgress(true);

          openCheckout({
            ...paymentDetails,
            handler: async function () {
              setMessage({ type: "success", text: "Payment received! Add-on is being activated..." });
              // Wait for the webhook to clear pendingAddonAddition (settlement).
              const result = await waitForSettlement({
                fetchLatest: fetchSubscription,
                isSettled: (data) => !!data && !data.subscription?.pendingAddonAddition?.orderId,
                intervalMs: 3000,
                timeoutMs: 30000,
              });
              if (pollCancelledRef.current) return;
              setPaymentInProgress(false);
              if (result.settled) {
                setMessage({ type: "success", text: "Add-on activated successfully!" });
              } else {
                setMessage({ type: "warning", text: "Payment confirmed. Add-on will be activated shortly — refresh if it doesn't appear." });
              }
            },
            modal: {
              ondismiss: function () {
                setMessage({ type: "warning", text: "Payment cancelled. Add-on not added." });
                setPaymentInProgress(false);
              },
            },
          });
          return;
        }
      }

      const addonsPayload = checkoutData.selectedAddonsList.map((a) => ({
        addonKey: a.key,
        quantity: a.quantity,
      }));

      const planData = {
        planId: checkoutData.plan.id,
        billingCycle: checkoutData.billingCycle,
        addons: addonsPayload,
        ...(checkoutData.appliedCoupon ? { couponCode: checkoutData.appliedCoupon.code } : {}),
        // Referral code is NOT sent here — it's applied immediately via its
        // own Apply button (handleApplyReferral), not folded into checkout
        // submission. See the state declaration above for why.
      };

      const response = subscription?.subscription
        ? await updateSubscription(planData)
        : await createSubscription(planData);

      setCheckoutData(null);

      if (response.paymentDetails && razorpayLoaded) {
        openRazorpay(response.paymentDetails);
      } else if (response.scheduled) {
        setMessage({ type: "success", text: response.message || "Change scheduled successfully!" });
      } else {
        setMessage({ type: "success", text: response.message || "Subscription updated successfully!" });
      }
    } catch (error) {
      const data = error.response?.data;
      let text = "Failed to update subscription";
      if (error.response?.status === 403) {
        text = "Only organization admins can manage subscriptions.";
      } else if (data?.code === "RAZORPAY_ERROR") {
        text = `Payment gateway error: ${data.error}. Please contact support.`;
      } else if (data?.error) {
        text = data.error;
      }
      setMessage({ type: "error", text });
    } finally {
      setProcessing(false);
    }
  };

  // Waits for the backend to settle the payment (see waitForSettlement.js —
  // never trusts local state, only the freshly-fetched value each time).
  const startPolling = async () => {
    const result = await waitForSettlement({
      fetchLatest: fetchSubscription,
      isSettled: (data) => !!data?.subscription?.isPaymentConfirmed,
      intervalMs: 5000,
      timeoutMs: 60000,
    });
    if (pollCancelledRef.current) return;
    setPaymentInProgress(false);
    if (result.settled) {
      setMessage({ type: "success", text: "Payment confirmed! Subscription updated successfully." });
      window.location.reload();
    } else {
      setMessage({
        type: "warning",
        text: "Payment confirmation taking longer than expected. Your subscription will be activated once the payment is processed. You can refresh the page to check status.",
      });
    }
  };

  const handleRetryPayment = async () => {
    if (!subscription?.subscription) return;
    setProcessing(true);
    setMessage("");
    try {
      const response = await subscriptionAPI.retryPayment(subscription.subscription._id);
      if (response.data.paymentDetails && razorpayLoaded) {
        openRazorpay(response.data.paymentDetails);
      } else {
        setMessage({ type: "error", text: "Unable to create retry payment session. Please try again." });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Failed to retry payment. Please try again.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const getVisiblePlans = () => {
    return planStructure.filter((plan) => {
      if (plan.trial) {
        if (!subscription?.subscription) return true;
        if (subscription.subscription.trialUsed) return false;
        if (subscription.subscription.isPaymentConfirmed) return false;
        return subscription.subscription.isTrialActive;
      }
      return true;
    });
  };

  if (loading || plans.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Loading plans...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-6 bg-white rounded-lg shadow-md">
          <div className="text-red-600 mb-2 font-semibold">Error loading plans</div>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <SuccessConfetti isExploding={showConfetti} />

      <CheckoutSummaryModal
        checkoutData={checkoutData}
        onConfirm={handleConfirmCheckout}
        onCancel={() => setCheckoutData(null)}
        processing={processing}
      />

      <div>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Choose Your Plan</h1>
          <p className="text-gray-600 text-sm max-w-2xl mx-auto mb-6">
            Flexible pricing for teams of all sizes. Start with a free trial or scale with annual savings.
          </p>

          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium transition-colors ${billingCycle === "monthly" ? "text-gray-900" : "text-gray-400"}`}>
                Monthly
              </span>
              <button
                onClick={() => {
                  const next = billingCycle === "monthly" ? "yearly" : "monthly";
                  setBillingCycle(next);
                  // Re-fetch add-ons at new cycle for any already-expanded plan
                  if (expandedPlan) {
                    subscriptionAPI.getAddonsForPlan(expandedPlan, next)
                      .then((res) => setPlanAddons((prev) => ({ ...prev, [expandedPlan]: res.data.addons || [] })))
                      .catch(() => {});
                  }
                }}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${billingCycle === "yearly" ? "bg-blue-600" : "bg-gray-300"}`}
                disabled={processing || paymentInProgress}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${billingCycle === "yearly" ? "translate-x-8" : "translate-x-1"}`} />
              </button>
              <span className={`text-sm font-medium transition-colors ${billingCycle === "yearly" ? "text-gray-900" : "text-gray-400"}`}>
                Annual<span className="ml-1 text-xs text-green-600 font-semibold">(Save 20%)</span>
              </span>
            </div>
          </div>

          {!subscription?.subscription?.trialUsed && !subscription?.subscription?.isPaymentConfirmed && (
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 px-4 py-2 rounded-lg border border-green-200 text-sm font-medium">
              <Gift className="w-4 h-4" />
              7-Day Free Trial Available
            </div>
          )}
        </div>

        {/* Coupon apply lives here, outside checkout, so the discount ripples
            across every plan/add-on card below BEFORE the customer commits to
            a plan — more enticing than only revealing it at checkout. */}
        {/* One consistent "coupon area" with three states, driven by the
            subscription's OWN snapshot as source of truth:
             1. Subscription already has a coupon attached → status banner
                (never show "Have a coupon code?" — that would contradict it).
             2. A coupon is being previewed for a new subscription → preview
                banner with card discounts.
             3. No coupon → the entry box.
            State 1 uses currentSubscription.appliedCoupon so it reflects the
            real subscription state everywhere, and extends naturally to the
            future "coupon attached + previewing upgrade/downgrade" case. */}
        {showCouponWidget && (
          <div className="max-w-md mx-auto mb-6">
            {subscription?.subscription?.appliedCoupon?.code ? (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-green-800 flex items-center gap-1">
                    Coupon Applied — {subscription.subscription.appliedCoupon.code}
                  </p>
                  <p className="text-xs text-green-700">
                    You save {formatPrice(subscription.subscription.appliedCoupon.discountAmount)} every billing cycle. This recurring discount is already attached to your subscription.
                  </p>
                </div>
              </div>
            ) : appliedCoupon?.valid ? (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-green-800">Coupon Applied — {appliedCoupon.code}</p>
                  {/* Honest copy: only the new-subscription flow actually
                      discounts the charge today, so paid subscribers get an
                      informational message rather than a promise of card
                      discounts that the upgrade/add-on flows don't yet honour. */}
                  <p className="text-xs text-green-700">
                    {couponAppliesAtCheckout
                      ? `${appliedCoupon.name}. Discounts are shown on eligible plans and add-ons below.`
                      : `${appliedCoupon.name}. Saved to your account — it won't change your current recurring bill, and discounting future upgrades/add-ons isn't enabled yet.`}
                  </p>
                </div>
                <button onClick={removeCoupon} className="text-green-600 hover:text-green-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                      placeholder="Have a coupon code?"
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => applyCoupon()}
                    disabled={validatingCoupon || !couponInput.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {validatingCoupon ? "..." : "Apply"}
                  </button>
                </div>
                {couponError && <p className="text-xs text-red-600 mt-1 text-center">{couponError}</p>}
              </div>
            )}
          </div>
        )}

        {/* Referral code — applies IMMEDIATELY on its own Apply button,
            exactly like the coupon field above, not folded into a later
            Subscribe/Start Trial submission. Recording the referral is
            independent of trial/payment status entirely — only relevant
            before this org already has a referrer, which is why it's
            hidden once payment is confirmed (an already-paying org's
            referrer, if any, was already settled at registration or an
            earlier Apply). Never promises a price change — this
            checkout's total is never discounted by a referral code today
            (see PROJECT_STATE.md §11: first-invoice discounts aren't
            possible until Razorpay's Charge-at-Will decision). */}
        {showCouponWidget && !subscription?.subscription?.isPaymentConfirmed && (
          <div className="max-w-md mx-auto mb-6">
            {referralApplied ? (
              <div className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-purple-800">
                    Referral applied{referredByName ? ` — referred by ${referredByName}` : (referralCodeInput.trim() ? ` — ${referralCodeInput.trim()}` : "")}
                  </p>
                  <p className="text-xs text-purple-700">
                    You won't see a discount on this invoice, but whoever referred you earns a reward toward their next purchase.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Gift className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      value={referralCodeInput}
                      onChange={(e) => { setReferralCodeInput(e.target.value.toUpperCase()); setReferralError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleApplyReferral()}
                      placeholder="Have a referral code?"
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <button
                    onClick={handleApplyReferral}
                    disabled={applyingReferral || !referralCodeInput.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {applyingReferral ? "..." : "Apply"}
                  </button>
                </div>
                {referralError && <p className="text-xs text-red-600 mt-1 text-center">{referralError}</p>}
              </div>
            )}
          </div>
        )}

        <PaymentStatusAlert
          subscription={subscription?.subscription}
          onRetryPayment={handleRetryPayment}
          processing={processing || paymentInProgress}
        />

        <CurrentSubscriptionInfo
          subscription={subscription.subscription}
          billingCycle={billingCycle}
        />

        {subscription?.subscription?.isPaymentConfirmed && !subscription?.subscription?.isTrialActive && (
          <div className="mb-6">
            {/* Show cancel button only when no cancellation and no pending downgrade */}
            {!subscription?.subscription?.cancelAtPeriodEnd && !hasValidPendingUpdate(subscription?.subscription) && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="inline-flex items-center px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-400 transition-all duration-200 font-medium text-sm"
                disabled={processing || paymentInProgress}
              >
                Cancel Subscription
              </button>
            )}
            {/* Show cancellation banner only for actual cancellations (no pendingUpdate means it's not a downgrade) */}
            {subscription?.subscription?.cancelAtPeriodEnd && !hasValidPendingUpdate(subscription?.subscription) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-yellow-900 mb-1">Cancellation Scheduled</h4>
                    <p className="text-sm text-yellow-800">
                      Your subscription will be cancelled on{" "}
                      <strong>
                        {(() => {
                          const d = subscription.subscription.currentPeriodEnd ? new Date(subscription.subscription.currentPeriodEnd) : null;
                          return d && d.getFullYear() >= 2020
                            ? d.toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })
                            : "the end of your billing period";
                        })()}
                      </strong>
                      . You will continue to have access to all features until then.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {message && (
          <div className={`mb-6 p-4 rounded-lg border-l-4 ${
            message.type === "success" ? "bg-green-50 text-green-800 border-green-500"
            : message.type === "warning" ? "bg-yellow-50 text-yellow-800 border-yellow-500"
            : "bg-red-50 text-red-800 border-red-500"
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{message.text}</span>
            </div>
          </div>
        )}

        <div className="my-12">
          <div className={`grid gap-4 ${
            getVisiblePlans().length === 3 ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"
          }`}>
            {getVisiblePlans().map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                currentSubscription={subscription?.subscription}
                billingCycle={billingCycle}
                onSelectPlan={handlePlanSelection}
                processing={processing || paymentInProgress || !!subscription?.subscription?.cancelAtPeriodEnd}
                locked={hasValidPendingUpdate(subscription?.subscription)}
                isScheduledTarget={hasValidPendingUpdate(subscription?.subscription) && subscription?.subscription?.pendingUpdate?.planName === plan.id}
                isExpanded={expandedPlan === plan.id}
                onExpand={() => handleExpandPlan(plan.id)}
                addons={planAddons[plan.id]}
                selectedAddons={selectedAddons}
                onAddonChange={(key, qty) =>
                  setSelectedAddons((prev) => ({ ...prev, [key]: qty }))
                }
                onRemoveAddon={handleRemoveAddon}
                couponRules={couponAppliesAtCheckout && appliedCoupon?.valid ? appliedCoupon.rules : null}
              />
            ))}
          </div>
        </div>

        <div className="overflow-hidden">
          <FeatureComparisonTable plans={planStructure} />
        </div>

        <div className="py-6">
          <FAQ />
        </div>

        <TrialModal
          showTrialModal={showTrialModal}
          onClose={() => setShowTrialModal(false)}
          onStartTrial={handleTrialStart}
          processing={processing}
        />

        {showCancelModal && (
          <div className="fixed inset-0 z-[100003] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">We are sorry to see you go</h3>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Your subscription will remain active until the end of your current billing period (
                  {subscription?.subscription?.currentPeriodEnd
                    ? new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "billing period end"}
                  ). You will continue to have access to all features until then.
                </p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={() => { setShowCancelModal(false); setCancelReason(""); setCancelFeedback(""); }}
                  className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  disabled={processing}
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleCancelSubscription}
                  className="flex-1 px-4 py-2.5 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={processing}
                >
                  {processing ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Canceling...
                    </span>
                  ) : "Confirm Cancellation"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPlans;
