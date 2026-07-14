// controllers/subscriptionController.js
const Subscription = require("../models/Subscription");
const SubscriptionPayment = require("../models/SubscriptionPayment.js"); // Updated import
const PlanConfig = require("../models/PlanConfig");
const PlanAddon = require("../models/PlanAddon");
const Organization = require("../models/Organization");
const razorpay = require("../config/razorpay");
const crypto = require("crypto");
const { sendTrialStartedEmail } = require('../utils/trialEmails');
const {
  findOrCreateRazorpayPlan,
  classifyAddonsForPlanChange,
  calculateAddonProration,
  calculatePlanUpgradeProration,
  scheduleAddonRemoval: scheduleAddonRemovalUtil,
  applyScheduledAddonRemovals,
} = require('../utils/addonManagement');
const { validateAndPriceCoupon, recordRedemption } = require('../utils/discountEngine');
const { computeGST, buildPricingSnapshot, applyModifiers } = require('../utils/pricingEngine');
const Coupon = require('../models/Coupon');
const { emitBillingEvent } = require('../utils/billingEvents');
const Invited = require('../models/Invited');
const sendGridMail = require('../utils/sendGridMail.js');
const { generateInviteEmailHTML, generateReferralEmailHTML } = require('../controllers/authController');
const Referral = require('../models/Referral');
const Reward = require('../models/Reward');
const RewardUsage = require('../models/RewardUsage');
const { rewardToModifier } = require('../utils/modifierResolver');
const { reserveNextAvailableReward, consumeReservation, releaseReservation } = require('../utils/referralRewards');

// Redemption must only be counted once payment actually clears, and must be
// idempotent — both the client-side verifyPayment call AND the Razorpay
// webhook can race to confirm the same subscription. Guarded by
// appliedCoupon.redeemed so whichever path runs first "wins" and the second
// is a no-op.
async function maybeRecordCouponRedemption(subscription) {
  if (!subscription.appliedCoupon?.couponId || subscription.appliedCoupon.redeemed) return;
  const coupon = await Coupon.findById(subscription.appliedCoupon.couponId);
  if (!coupon) return;
  await recordRedemption({
    coupon,
    organizationId: subscription.organization,
    subscriptionId: subscription._id,
    context: { planId: subscription.planName, billingCycle: subscription.billingCycle, checkoutType: 'new_subscription' },
    baseAmount: subscription.totalAmount + subscription.appliedCoupon.discountAmount,
    discountAmount: subscription.appliedCoupon.discountAmount,
  });
  subscription.appliedCoupon.redeemed = true;
  await subscription.save();
}

// Qualifies a pending Referral into TWO immutable Rewards the moment the
// REFERRED organization's first payment is confirmed — one for the
// referrer (Alice, the one who shared the code) and one for the referred
// org itself (Bob, the one who entered it). Both sides use the same
// program config/value — this is the ONLY place a Reward may be created
// for source: 'REFERRAL' (settlement owns this, never the signup
// code-entry step — see backend/docs/REFERRAL_SYSTEM_DESIGN.md §3/§16).
//
// Bob's reward can't apply to the signup payment that just happened (new
// subscriptions are a fixed recurring Razorpay Plan, not a discountable
// one-time Order — see PROJECT_STATE.md §11) but IS usable on Bob's own
// next add-on purchase or upgrade, same as any referrer's reward.
//
// Mirrors maybeRecordCouponRedemption's idempotency: called from all three
// racing payment-confirmation paths (verifyPayment, subscription.authenticated,
// payment.captured), guarded so only the first one to run does anything.
async function maybeQualifyReferral(subscription) {
  const referral = await Referral.findOne({
    referredOrganization: subscription.organization,
    status: 'pending',
  });
  if (!referral) return;

  referral.status = 'qualified';
  referral.qualifiedAt = new Date();
  await referral.save();

  const { getOrCreateReferralProgram } = require('../utils/referralUtils');
  const program = await getOrCreateReferralProgram(referral.referrerOrganization);
  if (!program.enabled) return; // disabled after the referral was entered — referral still recorded, no reward

  const expiresAt = program.expiryDurationDays
    ? new Date(Date.now() + program.expiryDurationDays * 24 * 60 * 60 * 1000)
    : null; // null = never expires, the deliberate default

  const rewardRecipients = [
    { organization: referral.referrerOrganization, role: 'referrer' },
    { organization: referral.referredOrganization, role: 'referee' },
  ];

  for (const recipient of rewardRecipients) {
    const reward = await Reward.create({
      organization: recipient.organization,
      referral: referral._id,
      source: 'REFERRAL',
      rewardType: program.rewardType,
      rewardValue: program.rewardValue,
      maxRewardAmount: program.maxRewardAmount,
      expiresAt,
    });

    await emitBillingEvent({
      organization: recipient.organization,
      eventType: 'REFERRAL_REWARD_EARNED',
      status: 'completed',
      metadata: {
        referralId: referral._id,
        rewardId: reward._id,
        rewardType: reward.rewardType,
        rewardValue: reward.rewardValue,
        role: recipient.role, // 'referrer' or 'referee' — which side of the referral this reward belongs to
      },
    });
  }
}

// Single settlement hook for the FIRST successful payment of a subscription.
// Every payment-confirmation path (verifyPayment + the four webhook handlers:
// payment.captured, subscription.authenticated, subscription.activated,
// subscription.charged) MUST funnel through this, so post-payment side
// effects happen exactly once regardless of which path Razorpay's async
// events take. Razorpay does NOT guarantee ordering — for UPI AutoPay the
// confirming event is usually `subscription.charged`, for card it's often
// `payment.captured`/`verifyPayment` — so wiring these into only some paths
// silently drops them for the others (this is exactly how referral
// qualification was missed for UPI orgs; see PROJECT_STATE.md §11).
//
// Every callee here is idempotent (maybeQualifyReferral only acts on a
// `pending` referral; maybeRecordCouponRedemption only on an unredeemed
// coupon), so calling this from multiple racing paths — including the
// "already confirmed" early-return branches — is safe by design. Add future
// post-first-payment effects (loyalty credits, welcome gifts, affiliate
// payouts) HERE, in one place, not scattered across five handlers.
async function runFirstPaymentSettlement(subscription) {
  try {
    await maybeRecordCouponRedemption(subscription);
  } catch (err) {
    console.error(`runFirstPaymentSettlement: coupon redemption failed for ${subscription._id}:`, err.message);
  }
  try {
    await maybeQualifyReferral(subscription);
  } catch (err) {
    console.error(`runFirstPaymentSettlement: referral qualification failed for ${subscription._id}:`, err.message);
  }
}
// ============================================================
// 1. Add this helper near the top of subscriptionController.js
// ============================================================

// Exported for the one-time backfill script (scripts/backfillQualify.js),
// which qualifies referrals stranded by the pre-fix settlement race. Not a
// route handler — kept internal to the settlement flow otherwise.
exports.maybeQualifyReferral = maybeQualifyReferral;

/**
 * Single source of truth for app-level subscription status.
 * Call this instead of setting subscription.status directly anywhere
 * lifecycle-meaningful changes happen.
 */
function setAppStatus(subscription, newStatus, reason = "") {
  const validStatuses = [
    "trial",
    "active",
    "past_due",
    "cancelled",
    "expired",
    "suspended",
  ];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid appStatus: ${newStatus}`);
  }

  const previous = subscription.appStatus;
  if (previous === newStatus) return; // no-op, avoid noisy logs/emails

  subscription.appStatus = newStatus;
  subscription.appStatusHistory = subscription.appStatusHistory || [];
  subscription.appStatusHistory.push({
    from: previous,
    to: newStatus,
    reason,
    at: new Date(),
  });

  console.log(
    `[Subscription ${subscription._id}] appStatus: ${previous} -> ${newStatus} (${reason})`
  );

  // Hook point for Step 4 (emails) later — leave as a TODO marker for now:
  // await triggerLifecycleEmail(subscription, newStatus);
}

// ============================================================
// 2. Add to your Mongoose Subscription schema (models/Subscription.js)
// ============================================================
/*
appStatus: {
  type: String,
  enum: ["trial", "active", "past_due", "cancelled", "expired", "suspended"],
  default: "trial",
},
appStatusHistory: [
  {
    from: String,
    to: String,
    reason: String,
    at: Date,
  },
],
*/

// ============================================================
// 3. Wire it into existing functions — minimal diffs shown below
// ============================================================

// --- startFreeTrial ---
// after creating `subscription` and before/after .save():
//   setAppStatus(subscription, "trial", "trial started");

// --- handlePaymentCaptured (pendingUpgrade branch) ---
//   setAppStatus(subscription, "active", "upgrade payment captured");

// --- handleSubscriptionAuthenticated ---
//   setAppStatus(subscription, "active", "razorpay subscription authenticated");

// --- handleSubscriptionActivated ---
//   setAppStatus(subscription, "active", "razorpay subscription activated");

// --- handlePaymentFailed --- (this is the important new one)
async function handlePaymentFailed(razorpayPayment) {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpayPayment.notes?.subscription_id,
  });

  if (subscription) {
    subscription.paymentStatus = "payment_failed";
    subscription.isPaymentConfirmed = false;
    subscription.lastPaymentAttempt = {
      razorpayPaymentId: razorpayPayment.id,
      amount: razorpayPayment.amount,
      attemptedAt: new Date(),
      status: "failed",
    };

    // NEW: move to past_due instead of leaving status untouched.
    // past_due != suspended — user still has access during grace period.
    setAppStatus(subscription, "past_due", "payment failed");

    await subscription.save();
    console.log(`Payment failed for subscription ${subscription._id}`);
  }
}

// --- handleSubscriptionCharged --- (recovery path: past_due -> active)
//   setAppStatus(subscription, "active", "subscription charged successfully");

// --- handleSubscriptionCancelled ---
//   if (now < periodEnd) {
//     subscription.cancelAtPeriodEnd = true;
//     // stays "active" until period actually ends — don't change appStatus yet
//   } else {
//     setAppStatus(subscription, "cancelled", "period ended after cancellation");
//   }

// --- handleSubscriptionHalted --- (Razorpay gives up after its own retries)
async function handleSubscriptionHalted(razorpaySubscription) {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (subscription) {
    subscription.status = "halted";
    setAppStatus(subscription, "suspended", "razorpay halted subscription after retries");
    await subscription.save();
  }
}

// Get available plans
exports.getPlans = async (req, res) => {
  try {
    const plans = await PlanConfig.find({ isActive: true }).sort({ monthlyPrice: 1 });

    const formatted = plans.map((plan) => {
      const f = plan.features || {};
      const modules = f.modules || {};

      const features = [];
      if (f.emailTemplates) features.push({ name: `${f.emailTemplates} Email Template${f.emailTemplates > 1 ? 's' : ''}` });
      if (f.salesPipelines) features.push({ name: `${f.salesPipelines} Sales Pipeline${f.salesPipelines > 1 ? 's' : ''}` });
      if (f.customFields)   features.push({ name: `${f.customFields} Custom Fields` });
      if (f.recordTags)     features.push({ name: `${f.recordTags} Record Tags` });
      if (f.websiteForms)   features.push({ name: `${f.websiteForms} Website Form${f.websiteForms > 1 ? 's' : ''}` });
      if (f.fileStorage) {
        const gb = Math.round(f.fileStorage / (1024 * 1024 * 1024));
        features.push({ name: `${gb} GB File Storage` });
      }
      Object.entries(modules).forEach(([mod, cfg]) => {
        if (!cfg || (!cfg.read && !cfg.write)) return;
        if (cfg.limit !== undefined) {
          const label = mod.replace(/-/g, ' ');
          const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);
          const limitStr = cfg.limit === 'unlimited' ? 'Unlimited' : Number(cfg.limit).toLocaleString('en-IN');
          features.push({ name: `${limitStr} ${displayLabel}` });
        }
      });
      if (f.rottenDeals)     features.push({ name: 'Rotten Deals tracking' });
      if (f.advancedReports) features.push({ name: 'Advanced Reports' });
      features.push({ name: '24x7 Support' });

      return {
        id: plan.planId,
        planId: plan.planId,
        name: plan.planId.charAt(0).toUpperCase() + plan.planId.slice(1),
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        yearlyPerMonth: Math.round(plan.yearlyPrice / 12),
        discount: plan.discount,
        isActive: plan.isActive,
        features,
        modules,
        limits: {
          emailTemplates:  f.emailTemplates  || 0,
          salesPipelines:  f.salesPipelines  || 0,
          customFields:    f.customFields    || 0,
          recordTags:      f.recordTags      || 0,
          websiteForms:    f.websiteForms    || 0,
          fileStorage:     f.fileStorage     || 0,
          rottenDeals:     !!f.rottenDeals,
          advancedReports: !!f.advancedReports,
        },
      };
    });

    res.json({ plans: formatted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get current subscription
exports.getCurrentSubscription = async (req, res) => {
  try {
    if (!req.user) {
      return res.json({
        hasSubscription: false,
        trialEligible: true,
      });
    }

    const subscription = await Subscription.findOne({
      organization: req.user.organization,
    }).populate("organization");

    if (!subscription) {
      return res.json({
        hasSubscription: false,
        trialEligible: true,
      });
    }

    // One-shot dashboard notice for super-admin-initiated changes — read it
    // once, then clear it in the DB so it never shows again on a later load.
    const adminNotice = subscription.adminNotice?.message
      ? subscription.adminNotice
      : null;
    if (adminNotice) {
      subscription.adminNotice = undefined;
      await subscription.save();
    }

    // Only return subscription as active if payment is confirmed
    if (!subscription.isPaymentConfirmed) {
      return res.json({
        hasSubscription: true,
        subscription: {
          ...subscription.toObject(),
          isActive: false,
          pendingPayment: true,
          adminNotice,
        },
        trialEligible: !subscription.trialUsed,
      });
    }

    res.json({
      hasSubscription: true,
      subscription: {
        ...subscription.toObject(),
        isActive: true,
        adminNotice,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Start free trial
exports.startFreeTrial = async (req, res) => {
  try {
    const existingSubscription = await Subscription.findOne({
      organization: req.user.organization,
    });

    if (existingSubscription && existingSubscription.trialUsed) {
      return res.status(400).json({
        error: "Free trial already used for this organization",
      });
    }

    const trialStart = new Date();
    const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // const growthPlan = await PlanConfig.findOne({ planId: "growth" });

    const subscription = new Subscription({
      organization: req.user.organization,
      razorpayPlanId: "plan_trial",
      planName: "growth",
      status: "active",
      billingCycle: "monthly",
      pricePerUser: 0,
      userCount: 1,
      totalAmount: 0,
      trialStart,
      trialEnd,
      isTrialActive: true,
      trialUsed: true,
      currentPeriodStart: trialStart,
      currentPeriodEnd: trialEnd,
    });

    setAppStatus(subscription, "trial", "trial started");

    await subscription.save();

    await emitBillingEvent({
      organization: subscription.organization,
      subscription: subscription._id,
      eventType: 'TRIAL_STARTED',
      status: 'completed',
      effectiveAt: trialEnd,
      after: subscription,
    });

    // Send trial-started confirmation email. Wrapped so an email failure
    // never blocks the actual trial from starting — it's already saved above.
    try {
      const organization = await Organization.findById(req.user.organization);
      await sendTrialStartedEmail(req.user, organization, trialEnd);
    } catch (emailError) {
      console.error('Failed to send trial-started email:', emailError);
    }

    res.json({
      success: true,
      message: "Free trial started successfully",
      subscription,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create subscription
exports.createSubscription = async (req, res) => {
  try {
    const { planId, billingCycle, addons = [], couponCode } = req.body;
    console.log(req.body);
    // Check if organization already has a subscription
    const existingSubscription = await Subscription.findOne({
      organization: req.user.organization,
    });

    if (existingSubscription) {
      // Update existing subscription instead of creating new one
      return exports.updateSubscription(req, res);
    }

    if (!planId || !billingCycle) {
      return res.status(400).json({
        error: "Plan ID and billing cycle are required",
      });
    }

    const plan = await PlanConfig.findOne({ planId, isActive: true });
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const basePrice = billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;

    // Validate and price add-ons selected at signup
    let addonEntries = [];
    let activeAddons = [];

    if (addons.length > 0) {
      const addonKeys = addons.map((a) => a.addonKey);
      addonEntries = await PlanAddon.find({ key: { $in: addonKeys }, isActive: true });

      for (const requested of addons) {
        const entry = addonEntries.find((e) => e.key === requested.addonKey);
        if (!entry) {
          return res.status(400).json({ error: `Add-on "${requested.addonKey}" does not exist or is not available.` });
        }
        const planAllowed = entry.availableOnPlans.length === 0 || entry.availableOnPlans.includes(planId);
        if (!planAllowed) {
          return res.status(400).json({ error: `Add-on "${entry.displayName}" is not available on the ${planId} plan.` });
        }
        const unitPrice = entry.price[billingCycle];
        if (!unitPrice) {
          return res.status(400).json({ error: `Add-on "${entry.displayName}" has no price configured for the ${billingCycle} cycle.` });
        }
        const qty = Number(requested.quantity) || 1;
        activeAddons.push({ addonKey: requested.addonKey, quantity: qty, pricePerUnit: unitPrice, addedAt: new Date() });
      }
    }

    // Coupon is applied per line item — a coupon scoped to specific add-ons
    // must only discount those add-ons, not the whole order. Eligibility
    // (a DB usage-limit check) happens here, before the pricing engine —
    // the engine itself only prices an already-resolved discount, it never
    // does I/O (see utils/pricingEngine.js).
    let appliedCoupon = null;
    let couponResult = null;
    if (couponCode) {
      const lineItems = [
        { key: planId, type: 'plan', amount: basePrice },
        ...activeAddons.map((a) => ({ key: a.addonKey, type: 'addon', amount: a.quantity * a.pricePerUnit })),
      ];
      couponResult = await validateAndPriceCoupon(couponCode, {
        organizationId: req.user.organization,
        planId,
        billingCycle,
        lineItems,
      });
      if (!couponResult.valid) {
        return res.status(400).json({ error: couponResult.reason });
      }
    }

    // NOTE: referral intent is NOT recorded here. A code entered via a
    // shared link is recorded at organization REGISTRATION (authController
    // completeRegistration) — the business event "we know this org was
    // referred," independent of whether it ever reaches checkout. A code
    // typed in manually on this page is applied immediately via its own
    // Apply button (exports.applyReferralCode below), not folded into
    // checkout submission — trial/payment must never gate Pending
    // visibility. See backend/docs/REFERRAL_SYSTEM_DESIGN.md §3/§24.

    const snapshot = buildPricingSnapshot({
      plan,
      billingCycle,
      activeAddons,
      couponDiscount: couponResult ? { totalDiscount: couponResult.discountAmount } : null,
    });
    const totalAmount = snapshot.totalAmount;

    if (couponResult) {
      appliedCoupon = {
        couponId: couponResult.coupon._id,
        code: couponResult.coupon.code,
        name: couponResult.coupon.name,
        duration: {
          type: couponResult.coupon.duration?.type || 'lifetime',
          cycles: couponResult.coupon.duration?.cycles ?? null,
        },
        discountAmount: couponResult.discountAmount,
        baseSubtotal: snapshot.subtotal,
        recurringSubtotal: totalAmount,
        rulesApplied: couponResult.lineItems
          .filter((li) => li.discount > 0)
          .map((li) => ({
            productType: li.type,
            productKey: li.key,
            discountType: li.discountType,
            discountValue: li.discountValue,
            discountAmount: li.discount,
          })),
      };
    }

    // Always create/find a GST-inclusive Razorpay plan for the total amount
    const razorpayPlanId = await findOrCreateRazorpayPlan(totalAmount, billingCycle, planId);

    // Create Razorpay subscription
    const razorpaySubscription = await razorpay.subscriptions.create({
      plan_id: razorpayPlanId,
      customer_notify: 1,
      quantity: 1,
      total_count: billingCycle === "monthly" ? 12 : 1,
      notes: {
        organization_id: req.user.organization.toString(),
        plan_name: planId,
        billing_cycle: billingCycle,
      },
    });

    // Create subscription with PENDING payment status
    const subscription = new Subscription({
      organization: req.user.organization,
      razorpaySubscriptionId: razorpaySubscription.id,
      razorpayPlanId,
      planName: planId,
      status: "created",
      paymentStatus: "pending_payment",
      isPaymentConfirmed: false,
      billingCycle,
      pricePerUser: basePrice,
      userCount: 1,
      totalAmount,
      activeAddons,
      appliedCoupon,
      currentPeriodStart: new Date(razorpaySubscription.current_start * 1000),
      currentPeriodEnd: new Date(razorpaySubscription.current_end * 1000),
      nextBillingDate: new Date(razorpaySubscription.charge_at * 1000),
    });

    await subscription.save();

    // Timeline: subscription created (pending payment). The PAYMENT_SUCCESS
    // event is emitted separately when the charge actually clears.
    await emitBillingEvent({
      organization: subscription.organization,
      subscription: subscription._id,
      eventType: 'SUBSCRIPTION_CREATED',
      status: 'completed',
      after: subscription,
      amounts: {
        base: snapshot.subtotal,
        discount: appliedCoupon?.discountAmount || 0,
        recurringAfter: totalAmount,
      },
      razorpay: { subscriptionId: razorpaySubscription.id },
      metadata: { planId, billingCycle, couponCode: appliedCoupon?.code || null },
    });

    res.json({
      success: true,
      subscription,
      paymentDetails: {
        key: process.env.RAZORPAY_KEY_ID,
        subscription_id: razorpaySubscription.id,
        name: req.user.name,
        description: `${plan.name} Plan - ${billingCycle}`,
        prefill: {
          name: req.user.name,
          email: req.user.email,
          contact: req.user.phone || "",
        },
        theme: { color: "#3399cc" },
        callback_url: `${process.env.FRONTEND_URL}/subscription/payment-success`,
      },
    });
  } catch (error) {
    console.error("Subscription creation error:", error);
    const razorpayError = error.error?.description || error.error?.reason;
    res.status(500).json({
      error: razorpayError || error.message,
      code: 'RAZORPAY_ERROR',
      hint: razorpayError ? 'Razorpay rejected the request. Run scripts/createRazorpayPlans.js to create valid plan IDs.' : undefined,
    });
  }
};

// Enhanced updateSubscription method
exports.updateSubscription = async (req, res) => {
  try {
    const { planId, billingCycle, addons = [], couponCode } = req.body;
    const subscription = await Subscription.findOne({
      organization: req.user.organization,
    });
    
    if (!subscription) {
      return res.status(404).json({ error: "No active subscription found" });
    }

    if (subscription.cancelAtPeriodEnd) {
      return res.status(400).json({
        error: 'Your subscription is scheduled to cancel at the end of the billing period. Reactivate your subscription before making changes.',
      });
    }

    // Fetch current subscription details from Razorpay to check payment mode
    let razorpaySubscription = null;
    if (subscription.razorpaySubscriptionId) {
      razorpaySubscription = await razorpay.subscriptions.fetch(subscription.razorpaySubscriptionId);
    }

    // Determine payment mode - adapt according to Razorpay API response structure
    const paymentMode = razorpaySubscription?.payment_method ||
      (razorpaySubscription?.mandate?.type) ||
      null;

    // ────────────────────────────────────────────────────────────────
    // UPGRADE PATH — prorated Order, no cancel-and-recreate, UPI-compatible.
    // Detected here (before the UPI cancel-and-recreate fallback) so that
    // upgrades NEVER take that path. Downgrades and billing-cycle changes
    // fall through unchanged.
    // ────────────────────────────────────────────────────────────────
    if (subscription.isPaymentConfirmed) {
      const currentPlanUpg = await PlanConfig.findOne({ planId: subscription.planName, isActive: true });
      const newPlanUpg = await PlanConfig.findOne({ planId, isActive: true });
      if (!newPlanUpg) return res.status(404).json({ error: "Plan not found" });

      const planPriorityUpg = { starter: 1, growth: 2, business: 3 };
      const isBillingCycleChangeUpg = subscription.billingCycle !== billingCycle;
      const isTierUpgrade =
        (planPriorityUpg[planId] || 0) > (planPriorityUpg[subscription.planName] || 0);

      // Only intercept true tier upgrades on the SAME billing cycle. Billing-cycle
      // changes and downgrades continue to the existing (unchanged) logic below.
      if (isTierUpgrade && !isBillingCycleChangeUpg) {
        // oldTotal = what the org currently pays in full (base + existing add-ons)
        const oldTotal = subscription.totalAmount || (subscription.billingCycle === 'monthly'
          ? (currentPlanUpg?.monthlyPrice ?? subscription.pricePerUser)
          : (currentPlanUpg?.yearlyPrice ?? subscription.pricePerUser));
        const newBasePrice = billingCycle === 'monthly'
          ? newPlanUpg.monthlyPrice
          : newPlanUpg.yearlyPrice;

        // Exclude add-ons the org has already scheduled for full removal — they
        // shouldn't carry forward to the new plan (user already cancelled them).
        const pendingRemovals = subscription.pendingAddonRemovals || [];
        const addonsToClassify = (subscription.activeAddons || []).filter((a) => {
          const removal = pendingRemovals.find((r) => r.addonKey === a.addonKey);
          return !(removal && removal.quantity >= a.quantity);
        });

        // Classify remaining add-ons against the NEW plan
        const { compatible, incompatible } = await classifyAddonsForPlanChange(
          addonsToClassify, planId, billingCycle
        );

        // Resolve prices for any NEW add-ons the user selected on the plan card
        const requestedNewAddons = (req.body.addons || []).filter((a) => a.quantity > 0);
        let newAddonPurchases = [];
        if (requestedNewAddons.length > 0) {
          const newAddonKeys = requestedNewAddons.map((a) => a.key);
          const newAddonCatalog = await PlanAddon.find({ key: { $in: newAddonKeys }, isActive: true });
          newAddonPurchases = requestedNewAddons
            .map(({ key, quantity }) => {
              const entry = newAddonCatalog.find((e) => e.key === key);
              const price = billingCycle === 'monthly' ? entry?.price?.monthly : entry?.price?.yearly;
              return { addonKey: key, quantity, pricePerUnit: price || 0 };
            })
            .filter((a) => a.pricePerUnit > 0);
        }

        // newTotal = new plan base + carried-forward add-ons + newly purchased add-ons
        const carriedTotal = compatible.reduce((sum, a) => sum + a.quantity * a.pricePerUnit, 0);
        const newAddonsTotal = newAddonPurchases.reduce((sum, a) => sum + a.quantity * a.pricePerUnit, 0);
        const newTotal = newBasePrice + carriedTotal + newAddonsTotal;

        // Prorated charge = (newTotal − oldTotal) × remaining fraction of cycle
        const proratedDiff = calculatePlanUpgradeProration(
          oldTotal, newTotal,
          subscription.currentPeriodStart, subscription.currentPeriodEnd
        );

        // SAME-FLOW RECYCLE: if a PREVIOUS upgrade checkout for this org left a
        // reward reserved (opened but never paid), release it before reserving
        // again. Safe because we overwrite subscription.pendingPlanChange below,
        // which makes that old order unsettleable — its reservation would
        // otherwise sit locked until its 30-min TTL, blocking the reward from
        // this new checkout. Idempotent + guarded on status:'reserved' inside
        // releaseReservation, so a since-consumed reservation is left untouched.
        // Only touches THIS flow's own prior reservation — never an add-on's
        // (separate pendingAddonAddition), so no cross-flow double-spend.
        if (subscription.pendingPlanChange?.referralRewardUsageId) {
          try {
            await releaseReservation(subscription.pendingPlanChange.referralRewardUsageId);
          } catch (relErr) {
            console.error('Failed to release prior upgrade reservation:', relErr.message);
          }
        }

        // RESERVE-FIRST (same concurrency-safe pattern as initiateAddonPurchase —
        // see utils/referralRewards.js). Reserve before creating the order so the
        // discount is only ever applied to an order backed by a reward we hold.
        let upgradeReservation = null;
        try {
          upgradeReservation = await reserveNextAvailableReward(req.user.organization, {
            subscription: subscription._id,
          });
        } catch (reserveErr) {
          console.error('Referral reservation failed (proceeding at full price):', reserveErr.message);
        }

        let discountedProratedDiff = proratedDiff;
        let upgradeReferralRewardUsageId = null;
        if (upgradeReservation) {
          const referralModifier = rewardToModifier(upgradeReservation.reward);
          const applied = applyModifiers(proratedDiff, [referralModifier]);
          discountedProratedDiff = applied.totalAmount;
          upgradeReferralRewardUsageId = upgradeReservation.usage._id;
        }

        // GST is collected on the prorated charge; Razorpay order carries the inclusive amount
        const proratedDiffWithGST = discountedProratedDiff + computeGST(discountedProratedDiff);

        // Create a one-time Order for the prorated difference + GST (UPI-compatible)
        let razorpayOrder;
        try {
          razorpayOrder = await razorpay.orders.create({
            amount: proratedDiffWithGST * 100,
            currency: 'INR',
            receipt: `upg_${Date.now().toString().slice(-10)}`,
            notes: {
              organization_id: req.user.organization.toString(),
              subscription_id: subscription._id.toString(),
              new_plan: planId,
              type: 'plan_upgrade',
            },
          });
        } catch (orderErr) {
          // Order backing the reservation was never created — release
          // immediately rather than waiting for it to expire.
          if (upgradeReferralRewardUsageId) await releaseReservation(upgradeReferralRewardUsageId);
          throw orderErr;
        }

        if (upgradeReferralRewardUsageId) {
          await RewardUsage.updateOne({ _id: upgradeReferralRewardUsageId }, { $set: { invoiceId: razorpayOrder.id } });
        }

        // Store pending change — everything below is applied on webhook confirmation
        // (payment success). We do NOT schedule removals or change planName here, so
        // an abandoned checkout leaves the current plan/add-ons fully intact.
        subscription.pendingPlanChange = {
          newPlanName: planId,
          newBasePrice,
          proratedDiffCharged: proratedDiffWithGST, // GST-inclusive — matches actual order amount
          orderId: razorpayOrder.id,
          compatibleAddons: compatible.map((a) => ({
            addonKey: a.addonKey, quantity: a.quantity, pricePerUnit: a.pricePerUnit,
          })),
          incompatibleAddons: incompatible.map((a) => ({
            addonKey: a.addonKey,
            displayName: a.displayName || a.addonKey,
            quantity: a.quantity,
            pricePerUnit: a.pricePerUnit,
          })),
          newAddonPurchases: newAddonPurchases.map((a) => ({
            addonKey: a.addonKey, quantity: a.quantity, pricePerUnit: a.pricePerUnit,
          })),
          createdAt: new Date(),
          referralRewardUsageId: upgradeReferralRewardUsageId,
        };

        await subscription.save();

        return res.json({
          success: true,
          proratedAmount: discountedProratedDiff,
          referralDiscountApplied: proratedDiff - discountedProratedDiff || undefined,
          newRecurringTotal: newTotal,
          newBasePrice,
          carriedForwardAddons: compatible.map((a) => ({
            addonKey: a.addonKey,
            quantity: a.quantity,
            pricePerUnit: a.pricePerUnit,
            remappedFrom: a.remappedFrom || null,
          })),
          newAddonsList: newAddonPurchases.map((a) => ({
            addonKey: a.addonKey,
            quantity: a.quantity,
            pricePerUnit: a.pricePerUnit,
          })),
          incompatibleAddons: incompatible.map((a) => ({
            addonKey: a.addonKey,
            displayName: a.displayName || a.addonKey,
            quantity: a.quantity,
            pricePerUnit: a.pricePerUnit,
          })),
          message: `Upgrade to ${planId} initiated. Complete payment of ₹${proratedDiff} (pro-rated for the remaining cycle).`,
          paymentDetails: {
            key: process.env.RAZORPAY_KEY_ID,
            order_id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: 'INR',
            name: req.user.name,
            description: `Upgrade to ${newPlanUpg.name || planId} — prorated for remaining cycle`,
            prefill: { name: req.user.name, email: req.user.email, contact: req.user.phone || '' },
            theme: { color: '#3399cc' },
          },
        });
      }
    }

    // UPI cancel-and-recreate: only for upgrades/billing-cycle changes, never downgrades.
    // Downgrades must fall through to the schedule-at-cycle-end logic below.
    const _planPri = { starter: 1, growth: 2, business: 3 };
    const _isDowngrade = (_planPri[planId] || 0) < (_planPri[subscription.planName] || 0);
    if (paymentMode === 'upi' && subscription.isPaymentConfirmed && !_isDowngrade) {
      // Cancel existing Razorpay subscription immediately
      await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId, { cancel_at_cycle_end: false });

      // Find new plan config
      const newPlan = await PlanConfig.findOne({ planId, isActive: true });
      if (!newPlan) return res.status(404).json({ error: "Plan not found" });

      const newPricePerUser = billingCycle === "monthly" ? newPlan.monthlyPrice : newPlan.yearlyPrice;
      const newTotalAmount = newPricePerUser;
      const newRazorpayPlanId = newPlan.razorpayPlanIds[billingCycle];

      // Create new Razorpay subscription with updated details
      const newRazorpaySubscription = await razorpay.subscriptions.create({
        plan_id: newRazorpayPlanId,
        customer_notify: 1,
        quantity: 1,
        total_count: billingCycle === "monthly" ? 12 : 1,
        notes: {
          organization_id: req.user.organization.toString(),
          plan_name: planId,
          billing_cycle: billingCycle,
        },
      });

      // Update DB subscription document with new Razorpay subscription info
      subscription.razorpaySubscriptionId = newRazorpaySubscription.id;
      subscription.razorpayPlanId = newRazorpayPlanId;
      subscription.planName = planId;
      subscription.status = "created";
      subscription.paymentStatus = "pending_payment";
      subscription.isPaymentConfirmed = false;
      subscription.billingCycle = billingCycle;
      subscription.pricePerUser = newPricePerUser;
      subscription.userCount = 1;
      subscription.totalAmount = newTotalAmount;
      subscription.currentPeriodStart = new Date(newRazorpaySubscription.current_start * 1000);
      subscription.currentPeriodEnd = new Date(newRazorpaySubscription.current_end * 1000);
      subscription.nextBillingDate = new Date(newRazorpaySubscription.charge_at * 1000);
      subscription.pendingUpdate = null;
      subscription.pendingUpgrade = null;
      await subscription.save();

      return res.json({
        success: true,
        message: "UPI subscription upgraded by cancelling old subscription and creating a new one.",
        subscription,
        paymentDetails: {
          key: process.env.RAZORPAY_KEY_ID,
          subscription_id: newRazorpaySubscription.id,
          name: req.user.name,
          description: `${newPlan.name} Plan - ${billingCycle}`,
          prefill: {
            name: req.user.name,
            email: req.user.email,
            contact: req.user.phone || "",
          },
          theme: { color: "#3399cc" },
          callback_url: `${process.env.FRONTEND_URL}/subscription/payment-success`,
        },
      });
    }

    // If not payment confirmed (pending payment), treat as create - allow any change without upgrade/downgrade logic
    if (!subscription.isPaymentConfirmed) {
      const plan = await PlanConfig.findOne({ planId, isActive: true });
      if (!plan) return res.status(404).json({ error: "Plan not found" });

      const pricePerUser =
        billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;

      // Validate and price add-ons (same logic as createSubscription)
      let addonEntries = [];
      let activeAddons = [];

      if (addons.length > 0) {
        const addonKeys = addons.map((a) => a.addonKey);
        addonEntries = await PlanAddon.find({ key: { $in: addonKeys }, isActive: true });

        for (const requested of addons) {
          const entry = addonEntries.find((e) => e.key === requested.addonKey);
          if (!entry) {
            return res.status(400).json({ error: `Add-on "${requested.addonKey}" does not exist or is not available.` });
          }
          const planAllowed = entry.availableOnPlans.length === 0 || entry.availableOnPlans.includes(planId);
          if (!planAllowed) {
            return res.status(400).json({ error: `Add-on "${entry.displayName}" is not available on the ${planId} plan.` });
          }
          const unitPrice = entry.price[billingCycle];
          if (!unitPrice) {
            return res.status(400).json({ error: `Add-on "${entry.displayName}" has no price configured for the ${billingCycle} cycle.` });
          }
          const qty = Number(requested.quantity) || 1;
          activeAddons.push({ addonKey: requested.addonKey, quantity: qty, pricePerUnit: unitPrice, addedAt: new Date() });
        }
      }

      // Same coupon handling as createSubscription — this branch is what
      // actually runs the first time a trial org converts to paid (createSubscription
      // detects the existing trial doc and forwards here), so it must not silently
      // drop a coupon the user entered at checkout.
      let appliedCoupon = null;
      let couponResult = null;
      if (couponCode) {
        const lineItems = [
          { key: planId, type: 'plan', amount: pricePerUser },
          ...activeAddons.map((a) => ({ key: a.addonKey, type: 'addon', amount: a.quantity * a.pricePerUnit })),
        ];
        couponResult = await validateAndPriceCoupon(couponCode, {
          organizationId: req.user.organization,
          planId,
          billingCycle,
          lineItems,
        });
        if (!couponResult.valid) {
          return res.status(400).json({ error: couponResult.reason });
        }
      }

      // NOTE: referral intent is NOT recorded here — see the identical
      // note in createSubscription above. Registration (link-based) and
      // the checkout page's own Apply button (manual entry) are the only
      // two creation points now.

      const snapshot = buildPricingSnapshot({
        plan,
        billingCycle,
        activeAddons,
        couponDiscount: couponResult ? { totalDiscount: couponResult.discountAmount } : null,
      });
      const totalAmount = snapshot.totalAmount;

      if (couponResult) {
        appliedCoupon = {
          couponId: couponResult.coupon._id,
          code: couponResult.coupon.code,
          name: couponResult.coupon.name,
          duration: {
            type: couponResult.coupon.duration?.type || 'lifetime',
            cycles: couponResult.coupon.duration?.cycles ?? null,
          },
          discountAmount: couponResult.discountAmount,
          baseSubtotal: snapshot.subtotal,
          recurringSubtotal: totalAmount,
          rulesApplied: couponResult.lineItems
            .filter((li) => li.discount > 0)
            .map((li) => ({
              productType: li.type,
              productKey: li.key,
              discountType: li.discountType,
              discountValue: li.discountValue,
              discountAmount: li.discount,
            })),
        };
      }

      const razorpayPlanId = await findOrCreateRazorpayPlan(totalAmount, billingCycle, planId);

      // Cancel existing Razorpay subscription if exists (since pending)
      if (subscription.razorpaySubscriptionId) {
        try {
          await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId);
        } catch (cancelError) {
          console.warn("Failed to cancel pending Razorpay subscription:", cancelError);
        }
      }

      // Create new Razorpay subscription
      const razorpaySubscription = await razorpay.subscriptions.create({
        plan_id: razorpayPlanId,
        customer_notify: 1,
        quantity: 1,
        total_count: billingCycle === "monthly" ? 12 : 1,
        notes: {
          organization_id: req.user.organization.toString(),
          plan_name: planId,
          billing_cycle: billingCycle,
        },
      });

      // Update fields directly
      subscription.razorpaySubscriptionId = razorpaySubscription.id;
      subscription.razorpayPlanId = razorpayPlanId;
      subscription.planName = planId;
      subscription.status = "created";
      subscription.paymentStatus = "pending_payment";
      subscription.isPaymentConfirmed = false;
      subscription.billingCycle = billingCycle;
      subscription.pricePerUser = pricePerUser;
      subscription.userCount = 1;
      subscription.totalAmount = totalAmount;
      subscription.activeAddons = activeAddons;
      subscription.appliedCoupon = appliedCoupon;
      subscription.currentPeriodStart = new Date(razorpaySubscription.current_start * 1000);
      subscription.currentPeriodEnd = new Date(razorpaySubscription.current_end * 1000);
      subscription.nextBillingDate = new Date(razorpaySubscription.charge_at * 1000);
      subscription.pendingUpdate = null;
      subscription.pendingUpgrade = null;
      await subscription.save();

      // This is the code path that actually runs for the most common
      // "new subscriber" moment — every org starts on a trial, so converting
      // to paid goes through here, not exports.createSubscription. No prior
      // BillingEvent existed for it. Pure org-initiated action (not the
      // renewal webhook), so safe to instrument.
      await emitBillingEvent({
        organization: subscription.organization,
        subscription: subscription._id,
        eventType: 'SUBSCRIPTION_CREATED',
        status: 'completed',
        after: subscription,
        amounts: {
          base: snapshot.subtotal,
          discount: appliedCoupon?.discountAmount || 0,
          recurringAfter: totalAmount,
        },
        razorpay: { subscriptionId: razorpaySubscription.id },
        metadata: { planId, billingCycle, couponCode: appliedCoupon?.code || null },
      });

      return res.json({
        success: true,
        subscription,
        paymentDetails: {
          key: process.env.RAZORPAY_KEY_ID,
          subscription_id: razorpaySubscription.id,
          name: req.user.name,
          description: `${plan.name} Plan - ${billingCycle}`,
          prefill: {
            name: req.user.name,
            email: req.user.email,
            contact: req.user.phone || "",
          },
          theme: { color: "#3399cc" },
          callback_url: `${process.env.FRONTEND_URL}/subscription/payment-success`,
        },
      });
    }

    // If in trial, end trial
    if (subscription.isTrialActive && !subscription.razorpaySubscriptionId) {
      subscription.isTrialActive = false;
      subscription.trialEnd = new Date();
    }

    const currentPlan = await PlanConfig.findOne({
      planId: subscription.planName,
      isActive: true,
    });
    const newPlan = await PlanConfig.findOne({ planId, isActive: true });
    if (!newPlan) return res.status(404).json({ error: "Plan not found" });

    const newPricePerUser =
      billingCycle === "monthly" ? newPlan.monthlyPrice : newPlan.yearlyPrice;

    // Classify active add-ons against the target plan for compatibility.
    // Exclude add-ons already scheduled for removal — they shouldn't be
    // resurrected into the new plan's carry-forward snapshot.
    const pendingRemovalsForClassify = subscription.pendingAddonRemovals || [];
    const addonsForClassify = (subscription.activeAddons || []).filter((a) => {
      const removal = pendingRemovalsForClassify.find((r) => r.addonKey === a.addonKey);
      return !(removal && removal.quantity >= a.quantity);
    });
    const { compatible: compatibleAddons, incompatible: droppedAddons, newAddonsTotal } =
      addonsForClassify.length > 0
        ? await classifyAddonsForPlanChange(addonsForClassify, planId, billingCycle)
        : { compatible: [], incompatible: [], newAddonsTotal: 0 };

    const newTotalAmount = newPricePerUser + newAddonsTotal;
    const newRazorpayPlanId = newPlan.razorpayPlanIds[billingCycle];

    const isBillingCycleChange = subscription.billingCycle !== billingCycle;
    const oldTotalAmount = subscription.totalAmount;
    const planPriority = { starter: 1, growth: 2, business: 3 };
    const currentPlanPriority = planPriority[subscription.planName] || 0;
    const newPlanPriority = planPriority[planId] || 0;
    const isUpgrade =
      newPlanPriority > currentPlanPriority ||
      (newPlanPriority === currentPlanPriority &&
        newTotalAmount > oldTotalAmount);

    let message = "Subscription updated successfully!";
    let paymentDetails = null;
    let scheduled = false;

    // Downgrades and billing-cycle changes are always scheduled at cycle end.
    // We update the Razorpay subscription plan (no cancellation) so the lower
    // recurring amount kicks in automatically at the next billing date.
    if (isBillingCycleChange || !isUpgrade) {
      // Guard against writing a half-formed pendingUpdate (e.g. the target
      // plan has no price configured for the requested billing cycle) — that
      // previously saved a truthy-but-garbage object that downstream UI
      // treated as a real scheduled downgrade (₹NaN, blank plan name).
      if (!planId || typeof newPricePerUser !== 'number' || Number.isNaN(newPricePerUser) || !billingCycle) {
        return res.status(400).json({ error: 'Could not schedule this change — the target plan has no valid price for the selected billing cycle.' });
      }
      subscription.pendingUpdate = {
        planName: planId,
        pricePerUser: newPricePerUser,
        userCount: 1,
        totalAmount: newTotalAmount,
        billingCycle: billingCycle,
        scheduledAt: new Date(subscription.currentPeriodEnd),
        // Frozen snapshot of which add-ons carry into the new plan, taken at the
        // moment the change is scheduled. Add-ons purchased on the CURRENT
        // subscription afterwards must NOT retroactively appear here — the
        // scheduled subscription is an explicit future state the user chose,
        // not something that silently tracks the active plan's add-ons.
        carriedAddons: compatibleAddons.map((a) => ({
          addonKey: a.addonKey,
          quantity: a.quantity,
          pricePerUnit: a.pricePerUnit,
        })),
        removedAddons: droppedAddons.map((a) => ({
          addonKey: a.addonKey,
          quantity: a.quantity,
          pricePerUnit: a.pricePerUnit,
        })),
      };
      // Do NOT set cancelAtPeriodEnd — the subscription continues; only the amount changes.

      if (subscription.razorpaySubscriptionId) {
        try {
          // Create/find a GST-inclusive Razorpay plan for the new amount, then
          // schedule the plan switch at the end of the current billing cycle.
          const downgradePlanId = await findOrCreateRazorpayPlan(newTotalAmount, billingCycle, planId);
          await razorpay.subscriptions.update(subscription.razorpaySubscriptionId, {
            plan_id: downgradePlanId,
            schedule_change_at: 'cycle_end',
          });
        } catch (rzpErr) {
          // UPI subscriptions can't be updated mid-cycle — that's fine; pendingUpdate
          // in our DB is the source of truth and applyScheduledAddonRemovals handles
          // the actual plan switch at renewal via the webhook.
          console.warn('Razorpay subscription plan update skipped (likely UPI):', rzpErr?.error?.description || rzpErr.message);
        }
      }

      message = isBillingCycleChange
        ? "Billing cycle change scheduled."
        : "Downgrade scheduled.";
      scheduled = true;

      await subscription.save();

      // Timeline: scheduled, not yet in effect — top-level subscription
      // fields are still the CURRENT plan until cycle end, so `subscription`
      // itself is the correct "before" snapshot here.
      await emitBillingEvent({
        organization: subscription.organization,
        subscription: subscription._id,
        eventType: isBillingCycleChange ? 'BILLING_CYCLE_CHANGE_SCHEDULED' : 'DOWNGRADE_SCHEDULED',
        status: 'scheduled',
        effectiveAt: subscription.currentPeriodEnd,
        before: subscription,
        after: {
          planName: planId,
          billingCycle,
          pricePerUser: newPricePerUser,
          userCount: subscription.userCount,
          totalAmount: newTotalAmount,
          activeAddons: compatibleAddons,
          appliedCoupon: subscription.appliedCoupon,
        },
        amounts: { recurringBefore: oldTotalAmount, recurringAfter: newTotalAmount },
        metadata: { targetPlanId: planId, billingCycle },
      });

      // For plan downgrades, schedule any add-ons that aren't available on the
      // new plan for removal at the same period end — org keeps access until then.
      let incompatibleAddons = [];
      if (!isBillingCycleChange && !isUpgrade) {
        try {
          const pendingRemovals = subscription.pendingAddonRemovals || [];
          const addonsToCheck = (subscription.activeAddons || []).filter((a) => {
            const removal = pendingRemovals.find((r) => r.addonKey === a.addonKey);
            return !(removal && removal.quantity >= a.quantity);
          });
          const { incompatible } = await classifyAddonsForPlanChange(
            addonsToCheck, planId, billingCycle
          );
          incompatibleAddons = incompatible;
          if (incompatible.length > 0) {
            for (const inc of incompatible) {
              if (!pendingRemovals.find((r) => r.addonKey === inc.addonKey)) {
                pendingRemovals.push({
                  addonKey: inc.addonKey,
                  displayName: inc.displayName || inc.addonKey,
                  quantity: inc.quantity,
                  pricePerUnit: inc.pricePerUnit,
                  scheduledAt: new Date(),
                  effectiveAt: subscription.currentPeriodEnd,
                });
              }
            }
            subscription.pendingAddonRemovals = pendingRemovals;
            await subscription.save();
          }
        } catch (err) {
          console.warn('Could not schedule incompatible add-on removals on downgrade:', err.message);
        }
      }

      return res.json({
        success: true,
        message,
        subscription,
        scheduled,
        paymentDetails,
        incompatibleAddons: incompatibleAddons.map((a) => ({
          addonKey: a.addonKey,
          displayName: a.displayName || a.addonKey,
          quantity: a.quantity,
          pricePerUnit: a.pricePerUnit,
        })),
      });
    }

    // NOTE: Tier upgrades are intercepted earlier by the Order-based
    // pendingPlanChange flow (UPI-compatible, no cancel-and-recreate).
    // Reaching here means an unhandled state — fail safe rather than
    // falling back to the removed cancel-and-recreate upgrade path.
    return res.status(400).json({
      error: "Unable to process this subscription change. Please contact support.",
    });
  } catch (error) {
    console.error("Subscription update error:", error);
    const razorpayError = error.error?.description || error.error?.reason;
    res.status(500).json({
      error: razorpayError || error.message,
      code: 'RAZORPAY_ERROR',
      hint: razorpayError ? 'Razorpay rejected the request. Run scripts/createRazorpayPlans.js to create valid plan IDs.' : undefined,
    });
  }
};

// Cancel subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const { cancelAtPeriodEnd = true } = req.body;

    const subscription = await Subscription.findOne({
      organization: req.user.organization,
    });

    if (!subscription) {
      return res.status(404).json({ error: "No active subscription found" });
    }

    // Trial cancellation — no Razorpay subscription exists to cancel
    if (subscription.isTrialActive) {
      subscription.isTrialActive = false;
      subscription.trialEnd = new Date();
      setAppStatus(subscription, "cancelled", "user cancelled during trial");
      await subscription.save();
      return res.json({
        success: true,
        message: "Trial cancelled successfully",
      });
    }

    // Existing Razorpay path for paid subscriptions — unchanged
    await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId, {
      cancel_at_cycle_end: true,
    });

    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    await emitBillingEvent({
      organization: subscription.organization,
      subscription: subscription._id,
      eventType: 'SUBSCRIPTION_CANCELLED',
      status: 'scheduled',
      effectiveAt: subscription.currentPeriodEnd,
      after: subscription,
    });

    res.json({
      success: true,
      message: "Subscription will be cancelled at the end of current billing period",
    });
  } catch (error) {
    console.error("Subscription cancellation error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Webhook handler
exports.handleWebhook = async (req, res) => {
  try {
    const webhookSignature = req.headers["x-razorpay-signature"];
    const webhookBody = req.rawBody || '';

    console.log('Webhook received:', {
      event: req.body?.event,
      paymentId: req.body?.payload?.payment?.entity?.id,
      orderId: req.body?.payload?.payment?.entity?.order_id,
      subscriptionId: req.body?.payload?.subscription?.entity?.id,
      rawBodyLength: webhookBody.length,
      headers: req.headers,
    });

    // Verify webhook signature
    if (!webhookSignature || !webhookBody) {
      console.error('Webhook error: Missing signature or body', {
        webhookSignature,
        rawBodyLength: webhookBody.length,
      });
      return res.status(400).json({ error: "Missing webhook signature or body" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(webhookBody)
      .digest("hex");

    console.log('Signature verification:', {
      event: req.body?.event,
      webhookSignature,
      expectedSignature,
      isMatch: webhookSignature === expectedSignature,
    });

    if (webhookSignature !== expectedSignature) {
      console.error('Webhook signature mismatch:', {
        event: req.body?.event,
        webhookSignature,
        expectedSignature,
        rawBody: webhookBody.slice(0, 500),
      });
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const event = req.body;
    switch (event.event) {
      case "payment.captured":
        await handlePaymentCaptured(event.payload.payment.entity);
        break;
      case "subscription.authenticated":
        await handleSubscriptionAuthenticated(event.payload.subscription.entity);
        break;
      case "subscription.activated":
        await handleSubscriptionActivated(event.payload.subscription.entity);
        break;
      case "subscription.charged":
        await handleSubscriptionCharged(
          event.payload.payment.entity,
          event.payload.subscription.entity
        );
        break;
      case "payment.failed":
        await handlePaymentFailed(event.payload.payment.entity);
        break;
      case "subscription.cancelled":
        await handleSubscriptionCancelled(event.payload.subscription.entity);
        break;
      case "subscription.halted":
        await handleSubscriptionHalted(event.payload.subscription.entity);
        break;
      default:
        console.log("Unhandled webhook event:", event.event);
    }

    res.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Webhook helper functions

async function handlePaymentCaptured(razorpayPayment) {
  console.log("Processing payment.captured:", {
    paymentId: razorpayPayment.id,
    orderId: razorpayPayment.order_id,
    amount: razorpayPayment.amount / 100,
    status: razorpayPayment.status,
    notes: razorpayPayment.notes,
  });

  // Handle order-based payment (upgrades)
  const subscription = await Subscription.findOne({
    "pendingUpgrade.orderId": razorpayPayment.order_id,
  });

  if (subscription && subscription.pendingUpgrade) {
    try {
      const pending = subscription.pendingUpgrade;

      // Verify payment amount
      if (razorpayPayment.amount / 100 !== pending.prorationAmount) {
        console.error(`Payment amount mismatch for order ${razorpayPayment.order_id}`, {
          expected: pending.prorationAmount,
          received: razorpayPayment.amount / 100,
        });
        return;
      }

      // Preserve original billing cycle dates
      const originalPeriodStart = subscription.currentPeriodStart;
      const originalPeriodEnd = subscription.currentPeriodEnd;
      const originalNextBillingDate = subscription.nextBillingDate;

      // Fetch new plan_id
      const newPlan = await PlanConfig.findOne({ planId: pending.planName });
      if (!newPlan || !newPlan.razorpayPlanIds[pending.billingCycle]) {
        console.error(`Invalid plan or razorpayPlanId for ${pending.planName}, billingCycle: ${pending.billingCycle}`);
        throw new Error('Invalid plan configuration');
      }

      // Carry forward add-ons at their grandfathered pricePerUnit
      const carryForwardAddons = pending.activeAddons && pending.activeAddons.length > 0
        ? pending.activeAddons
        : (subscription.activeAddons || []);

      const newBasePlanPrice = pending.billingCycle === 'monthly'
        ? newPlan.monthlyPrice
        : newPlan.yearlyPrice;

      const combinedTotal = carryForwardAddons.reduce(
        (sum, addon) => sum + addon.quantity * addon.pricePerUnit,
        newBasePlanPrice
      );

      // Use a combined Razorpay Plan when add-ons are present, otherwise use the base plan directly
      const newRazorpayPlanId = carryForwardAddons.length > 0
        ? await findOrCreateRazorpayPlan(combinedTotal, pending.billingCycle, pending.planName)
        : newPlan.razorpayPlanIds[pending.billingCycle];

      // Update existing Razorpay subscription to the new plan
      const updatedRazorpaySubscription = await razorpay.subscriptions.update(subscription.razorpaySubscriptionId, {
        plan_id: newRazorpayPlanId,
        quantity: 1,
        schedule_change_at: 'now',
      });

      // Update local subscription (preserve original dates, carry forward add-ons)
      subscription.razorpaySubscriptionId = updatedRazorpaySubscription.id;
      subscription.razorpayPlanId = newRazorpayPlanId;
      subscription.planName = pending.planName;
      subscription.pricePerUser = newBasePlanPrice;
      subscription.userCount = 1;
      subscription.totalAmount = combinedTotal;
      subscription.activeAddons = carryForwardAddons;
      subscription.billingCycle = pending.billingCycle;
      subscription.status = updatedRazorpaySubscription.status;
      subscription.currentPeriodStart = originalPeriodStart; // Preserve original
      subscription.currentPeriodEnd = originalPeriodEnd; // Preserve original
      subscription.nextBillingDate = originalNextBillingDate; // Preserve original
      subscription.pendingUpgrade = null;
      subscription.isPaymentConfirmed = true;
      subscription.paymentStatus = "payment_completed";
      setAppStatus(subscription, "active", "upgrade payment captured");

      await subscription.save();

      // Record payment
      try {
        const payment = new SubscriptionPayment({
          organization: subscription.organization,
          subscription: subscription._id,
          razorpayPaymentId: razorpayPayment.id,
          amount: razorpayPayment.amount / 100,
          status: razorpayPayment.status,
          method: razorpayPayment.method,
          paymentFor: "upgrade_proration",
        });

        await payment.save();
        console.log(`Payment recorded for order ${razorpayPayment.order_id}`);
      } catch (paymentError) {
        console.error(`Failed to record payment for order ${razorpayPayment.order_id}:`, paymentError.message);
        // Continue even if payment recording fails
      }

      console.log(`Subscription ${subscription._id} upgraded to ${pending.planName} after payment ${razorpayPayment.id}, retained billing cycle: ${originalNextBillingDate}`);
    } catch (error) {
      console.error(`Failed to process payment.captured for order ${razorpayPayment.order_id}:`, error);
      throw error;
    }
    return;
  }

  // Handle add-on purchase payment (Order-based)
  const addonSubscription = await Subscription.findOne({
    'pendingAddonAddition.orderId': razorpayPayment.order_id,
  });

  if (addonSubscription && addonSubscription.pendingAddonAddition) {
    try {
      const pending = addonSubscription.pendingAddonAddition;
      const addonBeforeSnapshot = {
        planName: addonSubscription.planName,
        billingCycle: addonSubscription.billingCycle,
        pricePerUser: addonSubscription.pricePerUser,
        userCount: addonSubscription.userCount,
        totalAmount: addonSubscription.totalAmount,
        activeAddons: addonSubscription.activeAddons,
        appliedCoupon: addonSubscription.appliedCoupon,
      };

      // Verify amount (allow ₹1 rounding tolerance)
      const expectedPaise = pending.prorationAmount * 100;
      if (Math.abs(razorpayPayment.amount - expectedPaise) > 100) {
        console.error(`Add-on payment amount mismatch for order ${razorpayPayment.order_id}`, {
          expected: expectedPaise,
          received: razorpayPayment.amount,
        });
        return;
      }

      const plan = await PlanConfig.findOne({ planId: addonSubscription.planName, isActive: true });
      if (!plan) {
        console.error(`Plan not found for subscription ${addonSubscription._id}`);
        return;
      }

      // Apply add-on to activeAddons
      const activeAddons = (addonSubscription.activeAddons || []).map((a) => ({
        addonKey: a.addonKey,
        quantity: a.quantity,
        pricePerUnit: a.pricePerUnit,
        addedAt: a.addedAt,
      }));
      const existingIdx = activeAddons.findIndex((a) => a.addonKey === pending.addonKey);
      if (existingIdx >= 0) {
        activeAddons[existingIdx] = {
          ...activeAddons[existingIdx],
          quantity: activeAddons[existingIdx].quantity + pending.quantity,
        };
      } else {
        activeAddons.push({
          addonKey: pending.addonKey,
          quantity: pending.quantity,
          pricePerUnit: pending.pricePerUnit,
          addedAt: new Date(),
        });
      }

      // Compute new combined recurring total (base + all addons)
      const newTotal = buildPricingSnapshot({
        plan,
        billingCycle: addonSubscription.billingCycle,
        activeAddons,
      }).totalAmount;

      // Update Razorpay subscription plan — takes effect NEXT billing cycle
      const newPlanId = await findOrCreateRazorpayPlan(newTotal, addonSubscription.billingCycle, plan.planId);
      try {
        await razorpay.subscriptions.update(addonSubscription.razorpaySubscriptionId, {
          plan_id: newPlanId,
          schedule_change_at: 'cycle_end',
        });
        console.log(`Razorpay subscription updated to new plan ${newPlanId}`);
      } catch (razorpayUpdateError) {
        console.warn(
          `Could not update Razorpay subscription plan (likely UPI — will sync at next renewal): ${razorpayUpdateError?.error?.description || razorpayUpdateError.message}`
        );
        // Do NOT re-throw — payment succeeded, addon must be activated regardless.
      }

      const referralRewardUsageId = pending.referralRewardUsageId;

      addonSubscription.activeAddons = activeAddons;
      addonSubscription.razorpayPlanId = newPlanId;
      addonSubscription.totalAmount = newTotal;
      addonSubscription.pendingAddonAddition = undefined;
      await addonSubscription.save();

      // Consume the reserved referral reward, if this checkout used one —
      // settlement is the only place a RewardUsage moves to 'consumed'
      // (REFERRAL_SYSTEM_DESIGN.md §9/§16). consumeReservation is an atomic
      // conditional update: a duplicate webhook delivery finds the row no
      // longer 'reserved' and is a no-op, so the reward can't be consumed —
      // or its event double-emitted — twice.
      if (referralRewardUsageId) {
        try {
          await consumeReservation(referralRewardUsageId);
        } catch (rewardErr) {
          console.error('Failed to consume referral reward usage:', rewardErr.message);
        }
      }

      // Record payment
      let addonPayment = null;
      try {
        addonPayment = new SubscriptionPayment({
          organization: addonSubscription.organization,
          subscription: addonSubscription._id,
          razorpayPaymentId: razorpayPayment.id,
          amount: razorpayPayment.amount / 100,
          status: razorpayPayment.status,
          method: razorpayPayment.method,
          paymentFor: 'addon_purchase',
        });
        await addonPayment.save();
      } catch (paymentError) {
        console.error('Failed to record add-on payment:', paymentError.message);
      }

      await emitBillingEvent({
        organization: addonSubscription.organization,
        subscription: addonSubscription._id,
        eventType: 'ADDON_ADDED',
        status: 'completed',
        before: addonBeforeSnapshot,
        after: addonSubscription,
        amounts: {
          prorated: pending.prorationAmount,
          paid: razorpayPayment.amount / 100,
          recurringBefore: addonBeforeSnapshot.totalAmount,
          recurringAfter: newTotal,
        },
        payment: addonPayment?._id,
        razorpay: { orderId: pending.orderId, paymentId: razorpayPayment.id, subscriptionId: addonSubscription.razorpaySubscriptionId },
        metadata: { addonKey: pending.addonKey, quantity: pending.quantity },
      });

      // If this add-on purchase was the seat needed to complete a pending
      // invite, finalize it now — settlement is the single place allowed to
      // turn "intent" (Invited.pendingPayment) into canonical state.
      if (pending.addonKey === 'extra_seat') {
        try {
          const pendingInvite = await Invited.findOne({
            organization: addonSubscription.organization,
            pendingSeatOrderId: razorpayPayment.order_id,
            pendingPayment: true,
          });
          if (pendingInvite) {
            pendingInvite.pendingPayment = false;
            pendingInvite.pendingSeatOrderId = undefined;
            await pendingInvite.save();

            const org = await Organization.findById(addonSubscription.organization);
            const html = generateInviteEmailHTML(process.env.FRONTEND_URL, org.name, pendingInvite.invitedByName || '');
            sendGridMail({ to: pendingInvite.email, subject: "Invitation to DataCircles CRM", html });
            console.log(`Pending invite for ${pendingInvite.email} finalized after seat purchase (order ${razorpayPayment.order_id})`);
          }
        } catch (inviteErr) {
          console.error(`Failed to finalize pending invite for order ${razorpayPayment.order_id}:`, inviteErr.message);
        }
      }

      console.log(`Add-on ${razorpayPayment.notes?.addon_key} ×${razorpayPayment.notes?.quantity} activated for subscription ${addonSubscription._id}. New recurring total: ₹${newTotal}`);
    } catch (error) {
      console.error(`Failed to process add-on payment for order ${razorpayPayment.order_id}:`, error);
      throw error;
    }
    return;
  }

  // Handle plan upgrade payment confirmation (Order-based, UPI-compatible)
  const upgradeSubscription = await Subscription.findOne({
    'pendingPlanChange.orderId': razorpayPayment.order_id,
  });

  if (upgradeSubscription && upgradeSubscription.pendingPlanChange) {
    try {
      const pending = upgradeSubscription.pendingPlanChange;
      const upgradeReferralRewardUsageId = pending.referralRewardUsageId;
      // Snapshot BEFORE any mutation below overwrites planName/totalAmount/etc.
      const beforeSnapshot = {
        planName: upgradeSubscription.planName,
        billingCycle: upgradeSubscription.billingCycle,
        pricePerUser: upgradeSubscription.pricePerUser,
        userCount: upgradeSubscription.userCount,
        totalAmount: upgradeSubscription.totalAmount,
        activeAddons: upgradeSubscription.activeAddons,
        appliedCoupon: upgradeSubscription.appliedCoupon,
      };

      // Verify amount (allow ₹1 rounding tolerance)
      const expected = pending.proratedDiffCharged * 100;
      if (Math.abs(razorpayPayment.amount - expected) > 100) {
        console.error(`Upgrade payment amount mismatch for order ${razorpayPayment.order_id}`, {
          expected, received: razorpayPayment.amount,
        });
        return;
      }

      const newPlan = await PlanConfig.findOne({ planId: pending.newPlanName, isActive: true });
      if (!newPlan) { console.error(`New plan ${pending.newPlanName} not found`); return; }

      // ENTITLEMENTS CHANGE NOW — planName drives restrictByPlan limits/modules
      upgradeSubscription.planName = pending.newPlanName;
      upgradeSubscription.pricePerUser = pending.newBasePrice;

      const compatibleAddons = pending.compatibleAddons || [];
      const incompatibleAddons = pending.incompatibleAddons || [];
      const newAddonPurchases = pending.newAddonPurchases || [];

      // New combined recurring total: base + carried-forward + newly purchased
      // add-ons. incompatibleAddons are deliberately excluded from billing —
      // they're kept in activeAddons below only until pendingAddonRemovals
      // removes them at cycle end, not billed again this cycle.
      const snapshot = buildPricingSnapshot({
        plan: newPlan,
        billingCycle: upgradeSubscription.billingCycle,
        activeAddons: [...compatibleAddons, ...newAddonPurchases],
        basePriceOverride: pending.newBasePrice,
      });
      const newRecurringTotal = snapshot.totalAmount;
      upgradeSubscription.totalAmount = newRecurringTotal;

      // Rebuild activeAddons: compatible (possibly remapped), incompatible kept
      // until cycle end, and newly purchased add-ons from this upgrade order.
      upgradeSubscription.activeAddons = [
        ...compatibleAddons.map((a) => ({
          addonKey: a.addonKey,
          quantity: a.quantity,
          pricePerUnit: a.pricePerUnit,
          addedAt: new Date(),
        })),
        ...incompatibleAddons.map((a) => ({
          addonKey: a.addonKey,
          quantity: a.quantity,
          pricePerUnit: a.pricePerUnit,
          addedAt: new Date(),
        })),
        ...newAddonPurchases.map((a) => ({
          addonKey: a.addonKey,
          quantity: a.quantity,
          pricePerUnit: a.pricePerUnit,
          addedAt: new Date(),
        })),
      ];

      // Restore addons that were already pending removal before the upgrade —
      // the user paid for them this cycle and keeps access until effectiveAt.
      // They stay in pendingAddonRemovals and will be removed at cycle end.
      const pendingRemovals = upgradeSubscription.pendingAddonRemovals || [];
      for (const removal of pendingRemovals) {
        const alreadyPresent = upgradeSubscription.activeAddons.find(
          (a) => a.addonKey === removal.addonKey
        );
        if (!alreadyPresent) {
          upgradeSubscription.activeAddons.push({
            addonKey: removal.addonKey,
            quantity: removal.quantity,
            pricePerUnit: removal.pricePerUnit,
            addedAt: new Date(),
          });
        }
      }

      // Now that payment is confirmed, schedule incompatible add-ons for
      // removal at cycle end (org keeps access & keeps paying for them this
      // cycle; they drop at the next renewal via applyScheduledAddonRemovals).
      if (incompatibleAddons.length > 0) {
        const pendingRemovals = upgradeSubscription.pendingAddonRemovals || [];
        for (const inc of incompatibleAddons) {
          if (!pendingRemovals.find((r) => r.addonKey === inc.addonKey)) {
            pendingRemovals.push({
              addonKey: inc.addonKey,
              displayName: inc.displayName || inc.addonKey,
              quantity: inc.quantity,
              pricePerUnit: inc.pricePerUnit,
              scheduledAt: new Date(),
              effectiveAt: upgradeSubscription.currentPeriodEnd,
            });
          }
        }
        upgradeSubscription.pendingAddonRemovals = pendingRemovals;
      }

      // Try to update the Razorpay recurring plan (works on card, fails on UPI)
      let syncedToRazorpay = false;
      try {
        const newPlanId = compatibleAddons.length > 0
          ? await findOrCreateRazorpayPlan(newRecurringTotal, upgradeSubscription.billingCycle, pending.newPlanName)
          : newPlan.razorpayPlanIds[upgradeSubscription.billingCycle];

        await razorpay.subscriptions.update(upgradeSubscription.razorpaySubscriptionId, {
          plan_id: newPlanId,
          schedule_change_at: 'cycle_end',
        });
        upgradeSubscription.razorpayPlanId = newPlanId;
        syncedToRazorpay = true;
        console.log(`Razorpay subscription updated to ${newPlanId} at cycle_end`);
      } catch (err) {
        console.warn(`Could not update Razorpay recurring plan (likely UPI — syncs at renewal): ${err?.error?.description || err.message}`);
      }

      // Clear pending if synced; otherwise flag it for renewal-time reconciliation
      if (syncedToRazorpay) {
        upgradeSubscription.pendingPlanChange = undefined;
      } else {
        upgradeSubscription.pendingPlanChange = {
          newPlanName: pending.newPlanName,
          newBasePrice: pending.newBasePrice,
          proratedDiffCharged: pending.proratedDiffCharged,
          orderId: pending.orderId,
          compatibleAddons: compatibleAddons,
          newAddonPurchases: newAddonPurchases,
          createdAt: pending.createdAt,
          needsRazorpaySync: true,
        };
      }

      await upgradeSubscription.save();

      // Consume the reserved referral reward, if this upgrade used one —
      // atomic conditional update, idempotent against duplicate webhooks
      // (see utils/referralRewards.js).
      if (upgradeReferralRewardUsageId) {
        try {
          await consumeReservation(upgradeReferralRewardUsageId);
        } catch (rewardErr) {
          console.error('Failed to consume referral reward usage:', rewardErr.message);
        }
      }

      // Record payment
      let upgradePayment = null;
      try {
        upgradePayment = new SubscriptionPayment({
          organization: upgradeSubscription.organization,
          subscription: upgradeSubscription._id,
          razorpayPaymentId: razorpayPayment.id,
          amount: razorpayPayment.amount / 100,
          status: razorpayPayment.status,
          method: razorpayPayment.method,
          paymentFor: 'plan_upgrade',
        });
        await upgradePayment.save();
      } catch (e) {
        console.error('Failed to record upgrade payment:', e.message);
      }

      await emitBillingEvent({
        organization: upgradeSubscription.organization,
        subscription: upgradeSubscription._id,
        eventType: 'PLAN_UPGRADE',
        status: 'completed',
        before: beforeSnapshot,
        after: upgradeSubscription,
        amounts: {
          prorated: pending.proratedDiffCharged,
          paid: razorpayPayment.amount / 100,
          recurringBefore: beforeSnapshot.totalAmount,
          recurringAfter: newRecurringTotal,
        },
        payment: upgradePayment?._id,
        razorpay: { orderId: pending.orderId, paymentId: razorpayPayment.id, subscriptionId: upgradeSubscription.razorpaySubscriptionId },
        metadata: { newPlanName: pending.newPlanName },
      });

      console.log(`Plan upgraded to ${pending.newPlanName} for subscription ${upgradeSubscription._id}. New recurring total: ₹${newRecurringTotal} (applies at renewal)`);
    } catch (error) {
      console.error(`Failed to process plan upgrade payment for order ${razorpayPayment.order_id}:`, error);
      throw error;
    }
    return;
  }

  // Handle subscription-based payment (createSubscription)
  const subSubscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpayPayment.notes?.subscription_id,
  });
  if (subSubscription) {
    // Skip if already confirmed via client-side verification — but the
    // SubscriptionPayment row client-verify created may still be sitting at
    // status 'authorized' (Razorpay's own auto-capture is async, so that was
    // the true status at that instant). This webhook event IS the capture
    // confirmation, so reconcile that row's status even when we skip the
    // subscription mutation. Fixes "Total Spent" undercounting: the stats
    // tile counts authorized+captured as "successful" but the total-spent
    // sum only counts 'captured', so an unreconciled row shows as a
    // successful payment that contributed ₹0.
    if (subSubscription.isPaymentConfirmed) {
      try {
        await SubscriptionPayment.updateOne(
          { razorpayPaymentId: razorpayPayment.id, status: { $ne: 'captured' } },
          { $set: { status: 'captured' } }
        );
      } catch (reconcileErr) {
        console.error(`Failed to reconcile payment status for ${razorpayPayment.id}:`, reconcileErr.message);
      }
      // Another path already confirmed; ensure settlement side effects ran
      // (idempotent no-op if they already did).
      await runFirstPaymentSettlement(subSubscription);
      console.log(`Payment already confirmed for subscription ${subSubscription._id}, skipping webhook update`);
      return;
    }
    subSubscription.paymentStatus = "payment_completed";
    subSubscription.isPaymentConfirmed = true;
    await subSubscription.save();

    // This webhook can legitimately fire BEFORE the client's verifyPayment
    // call — in that race, verifyPayment later sees isPaymentConfirmed:true
    // and returns early without ever creating a SubscriptionPayment row (it
    // only creates one on the path where IT does the confirming). Without
    // this, that race means no payment record is created at all. Record it
    // here instead, guarded against the reverse race (verifyPayment already
    // created it first) via the unique razorpayPaymentId index.
    try {
      const existing = await SubscriptionPayment.findOne({ razorpayPaymentId: razorpayPayment.id });
      if (!existing) {
        await SubscriptionPayment.create({
          organization: subSubscription.organization,
          subscription: subSubscription._id,
          razorpayPaymentId: razorpayPayment.id,
          amount: razorpayPayment.amount / 100,
          status: razorpayPayment.status,
          method: razorpayPayment.method,
          paymentFor: 'subscription',
        });
      }
    } catch (paymentRecordErr) {
      console.error(`Failed to record payment ${razorpayPayment.id} from webhook:`, paymentRecordErr.message);
    }

    await runFirstPaymentSettlement(subSubscription);
    console.log(`Subscription ${subSubscription._id} confirmed via webhook payment ${razorpayPayment.id}`);
  } else {
    console.warn(`No subscription found for payment ${razorpayPayment.id}`);
  }
}

async function handleSubscriptionAuthenticated(razorpaySubscription) {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (subscription) {
    // Skip if already confirmed via client-side verification
    if (subscription.isPaymentConfirmed) {
      // Ensure settlement side effects ran regardless of which path confirmed
      // first (idempotent no-op if they already did).
      await runFirstPaymentSettlement(subscription);
      console.log(`Payment already confirmed for subscription ${subscription._id}, skipping webhook update`);
      return;
    }

    subscription.status = "authenticated";
    subscription.isTrialActive = false;
    subscription.paymentStatus = "payment_completed";
    subscription.isPaymentConfirmed = true;
    setAppStatus(subscription, "active", "razorpay subscription authenticated");
    await subscription.save();
    await runFirstPaymentSettlement(subscription);

    console.log(`Subscription ${subscription._id} payment confirmed via webhook`);
  }
}

async function handleSubscriptionActivated(razorpaySubscription) {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (subscription) {
    // Skip if already confirmed via client-side verification (only update dates)
    const alreadyConfirmed = subscription.isPaymentConfirmed;

    subscription.status = "active";
    subscription.isTrialActive = false;
    subscription.paymentStatus = "payment_completed";
    subscription.isPaymentConfirmed = true;
    subscription.currentPeriodStart = new Date(
      razorpaySubscription.current_start * 1000
    );
    subscription.currentPeriodEnd = new Date(
      razorpaySubscription.current_end * 1000
    );
    subscription.nextBillingDate = new Date(
      razorpaySubscription.charge_at * 1000
    );
    setAppStatus(subscription, "active", "razorpay subscription activated");
    await subscription.save();

    // Runs the first-payment settlement side effects (referral qualification,
    // coupon redemption). Idempotent, so calling it here even when another
    // path already confirmed is a safe no-op — this closes the race where
    // subscription.activated is the event that wins for this subscription.
    await runFirstPaymentSettlement(subscription);

    if (alreadyConfirmed) {
      console.log(`Subscription ${subscription._id} already confirmed, updated dates via webhook`);
    } else {
      console.log(`Subscription ${subscription._id} activated via webhook`);
    }
  }
}

async function handlePaymentFailed(razorpayPayment) {
  // Find subscription by looking up the payment
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpayPayment.notes?.subscription_id,
  });

  if (subscription) {
    subscription.paymentStatus = "payment_failed";
    subscription.isPaymentConfirmed = false;
    subscription.lastPaymentAttempt = {
      razorpayPaymentId: razorpayPayment.id,
      amount: razorpayPayment.amount,
      attemptedAt: new Date(),
      status: "failed",
    };
    setAppStatus(subscription, "past_due", "payment failed");
    await subscription.save();

    await emitBillingEvent({
      organization: subscription.organization,
      subscription: subscription._id,
      eventType: 'PAYMENT_FAILED',
      status: 'failed',
      after: subscription,
      amounts: { paid: 0 },
      razorpay: { paymentId: razorpayPayment.id, subscriptionId: subscription.razorpaySubscriptionId },
      metadata: { reason: razorpayPayment.error_description || null },
    });

    console.log(`Payment failed for subscription ${subscription._id}`);
  }
}

async function handleSubscriptionCharged(
  razorpayPayment,
  razorpaySubscription
) {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (subscription) {
    // Check if payment already recorded
    const existingPayment = await SubscriptionPayment.findOne({
      razorpayPaymentId: razorpayPayment.id
    });
    
    // Record payment if not already recorded
    let chargedPayment = existingPayment;
    const isFirstRecord = !existingPayment;
    if (!existingPayment) {
      chargedPayment = new SubscriptionPayment({
        organization: subscription.organization,
        subscription: subscription._id,
        razorpayPaymentId: razorpayPayment.id,
        amount: razorpayPayment.amount / 100, // paise to INR
        status: razorpayPayment.status,
        method: razorpayPayment.method,
        paymentFor: "subscription",
      });
      await chargedPayment.save();
      console.log(`Payment ${razorpayPayment.id} recorded via webhook`);
    } else {
      console.log(`Payment ${razorpayPayment.id} already recorded, skipping`);
    }

    // Only emit once per actual charge, and only for a RENEWAL (a cycle
    // charge on an already-confirmed subscription) — the very first charge
    // is already covered by SUBSCRIPTION_CREATED elsewhere.
    if (isFirstRecord && subscription.isPaymentConfirmed) {
      await emitBillingEvent({
        organization: subscription.organization,
        subscription: subscription._id,
        eventType: 'RENEWAL',
        status: 'completed',
        after: subscription,
        amounts: { paid: razorpayPayment.amount / 100, recurringAfter: subscription.totalAmount },
        payment: chargedPayment?._id,
        razorpay: { paymentId: razorpayPayment.id, subscriptionId: subscription.razorpaySubscriptionId },
      });
    }

    // Update subscription (skip if already confirmed via client-side)
    const alreadyConfirmed = subscription.isPaymentConfirmed;
    
    subscription.status = "active";
    subscription.paymentStatus = "payment_completed";
    subscription.isTrialActive = false;
    subscription.isPaymentConfirmed = true;
    subscription.currentPeriodStart = new Date(
      razorpaySubscription.current_start * 1000
    );
    subscription.currentPeriodEnd = new Date(
      razorpaySubscription.current_end * 1000
    );
    subscription.nextBillingDate = new Date(
      razorpaySubscription.charge_at * 1000
    );
    setAppStatus(subscription, "active", "subscription charged successfully");
    await subscription.save();

    // First-payment settlement side effects (referral qualification, coupon
    // redemption). For UPI AutoPay, `subscription.charged` is typically THE
    // confirming event — this is the path that was silently missing
    // qualification (org "neww": active + confirmed but referral stuck
    // pending; see PROJECT_STATE.md §11). Idempotent + gated on a pending
    // referral / unredeemed coupon, so it's a safe no-op on renewal charges,
    // which also hit this handler.
    await runFirstPaymentSettlement(subscription);

    // KNOWN GAP (see backend/docs/KNOWN_BILLING_GAPS.md): a scheduled
    // downgrade's `subscription.pendingUpdate` is never reconciled here.
    // Razorpay charges the correct new amount (its own plan was switched at
    // schedule time), but planName/pricePerUser/totalAmount/activeAddons in
    // our DB keep showing the pre-downgrade plan forever, and pendingUpdate
    // never clears. Deliberately NOT fixed yet — on hold pending Razorpay's
    // Charge at Will response (support ticket #19691335), since that would
    // likely redesign this whole reconciliation model. Do not add downgrade
    // reconciliation logic here without re-reading that doc first.

    if (alreadyConfirmed) {
      console.log(`Subscription ${subscription._id} already confirmed, updated via webhook`);
    } else {
      console.log(`Subscription ${subscription._id} charged and confirmed via webhook`);
    }

    // Apply any scheduled add-on removals now that a new billing cycle has started
    try {
      const removalsApplied = await applyScheduledAddonRemovals(subscription);
      if (removalsApplied) {
        console.log(`Applied scheduled add-on removals for subscription ${subscription._id}`);
      }
    } catch (removalError) {
      console.error(`Failed to apply scheduled add-on removals for subscription ${subscription._id}:`, removalError.message);
    }

    // Reconcile a UPI plan upgrade that couldn't sync to Razorpay at payment time.
    // The entitlements (planName) already changed when the upgrade payment was
    // captured; our DB totalAmount is the source of truth for display/limits.
    // NOTE: on UPI/NACH mandates, increasing the actual recurring charge requires
    // the customer to re-authorize — a known Razorpay constraint (see report).
    if (subscription.pendingPlanChange?.needsRazorpaySync) {
      console.log(`Subscription ${subscription._id} had a pending UPI plan sync. DB totalAmount (₹${subscription.totalAmount}) is source of truth. Razorpay mandate may need re-auth for the full amount.`);
      subscription.pendingPlanChange = undefined;
      await subscription.save();
    }
  }
}

async function handleSubscriptionCancelled(razorpaySubscription) {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (subscription) {
    const now = new Date();
    const periodEnd = new Date(razorpaySubscription.current_end * 1000);

    if (now < periodEnd) {
      // Mid-cycle cancellation: keep access until period ends, don't change appStatus yet
      subscription.cancelAtPeriodEnd = true;
      subscription.cancelledAt = periodEnd;
      subscription.status = 'active';
      console.log(`Subscription ${subscription._id} scheduled for cancellation at period end: ${periodEnd}`);
    } else {
      // Period has ended — access should stop now
      subscription.status = "cancelled";
      subscription.cancelledAt = new Date();
      setAppStatus(subscription, "cancelled", "period ended after cancellation");
      console.log(`Subscription ${subscription._id} fully cancelled`);
    }

    await subscription.save();

    if (subscription.pendingUpdate) {
      const pending = subscription.pendingUpdate;
      const newPlan = await PlanConfig.findOne({ planId: pending.planName });

      if (!newPlan) {
        console.error(`Plan ${pending.planName} not found for pending update`);
        return;
      }

      const newPricePerUser =
        pending.billingCycle === "monthly"
          ? newPlan.monthlyPrice
          : newPlan.yearlyPrice;
      const newTotalAmount = newPricePerUser * pending.userCount;
      const newRazorpayPlanId = newPlan.razorpayPlanIds[pending.billingCycle];

      const newRazorpaySubscription = await razorpay.subscriptions.create({
        plan_id: newRazorpayPlanId,
        customer_notify: 1,
        quantity: pending.userCount,
        total_count: pending.billingCycle === "monthly" ? 12 : 1,
        start_at: Math.floor(pending.scheduledAt / 1000),
        notes: {
          organization_id: subscription.organization.toString(),
          plan_name: pending.planName,
          billing_cycle: pending.billingCycle,
        },
      });

      // Create new local subscription
      const newSubscription = new Subscription({
        organization: subscription.organization,
        razorpaySubscriptionId: newRazorpaySubscription.id,
        razorpayPlanId: newRazorpayPlanId,
        planName: pending.planName,
        status: newRazorpaySubscription.status,
        billingCycle: pending.billingCycle,
        pricePerUser: newPricePerUser,
        userCount: pending.userCount,
        totalAmount: newTotalAmount,
        currentPeriodStart: new Date(
          newRazorpaySubscription.current_start * 1000
        ),
        currentPeriodEnd: new Date(newRazorpaySubscription.current_end * 1000),
        nextBillingDate: new Date(newRazorpaySubscription.charge_at * 1000),
        isPaymentConfirmed: false,
        paymentStatus: "pending_payment",
      });

      await newSubscription.save();
      console.log(
        `New subscription ${newSubscription._id} created for organization ${subscription.organization}`
      );
    }
  }
}

async function handleSubscriptionHalted(razorpaySubscription) {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (subscription) {
    subscription.status = "halted";
    // Razorpay has exhausted its own retry schedule — this is the
    // "grace period exhausted" moment. Without this line, appStatus never
    // moved past "past_due", meaning subscriptionGate would have kept
    // granting full write access indefinitely even after Razorpay gave up.
    setAppStatus(subscription, "suspended", "razorpay halted subscription after retries");
    await subscription.save();
    console.log(`Subscription ${subscription._id} suspended after Razorpay halted it`);
  }
}

exports.getPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const payments = await SubscriptionPayment.find({
      organization: req.user.organization,
    })
      .populate("subscription", "planName billingCycle")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SubscriptionPayment.countDocuments({
      organization: req.user.organization,
    });

    res.json({
      payments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Payment history error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Billing Center timeline — reads BillingEvent, never reconstructs history
// from Subscription/SubscriptionPayment/CouponRedemption.
exports.getBillingTimeline = async (req, res) => {
  try {
    const { page = 1, limit = 25 } = req.query;
    const BillingEvent = require('../models/BillingEvent');

    const events = await BillingEvent.find({ organization: req.user.organization })
      .populate('payment')
      .sort({ occurredAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await BillingEvent.countDocuments({ organization: req.user.organization });

    res.json({
      events,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      total,
    });
  } catch (error) {
    console.error('Billing timeline error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Add function to get payment details
exports.getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await SubscriptionPayment.findOne({
      _id: paymentId,
      organization: req.user.organization,
    }).populate("subscription", "planName billingCycle userCount");

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.json({ payment });
  } catch (error) {
    console.error("Payment details error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Client-side payment verification endpoint
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;

    console.log('Client-side payment verification request:', {
      payment_id: razorpay_payment_id,
      subscription_id: razorpay_subscription_id,
      has_signature: !!razorpay_signature,
      organization: req.user.organization
    });

    // Validate required fields
    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return res.status(400).json({ 
        error: "Missing payment verification parameters",
        success: false
      });
    }

    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      console.error('Payment signature verification failed:', {
        payment_id: razorpay_payment_id,
        subscription_id: razorpay_subscription_id
      });
      return res.status(400).json({ 
        error: "Invalid payment signature",
        success: false
      });
    }

    // Find subscription by razorpay subscription ID
    const subscription = await Subscription.findOne({
      razorpaySubscriptionId: razorpay_subscription_id,
      organization: req.user.organization
    });

    if (!subscription) {
      return res.status(404).json({ 
        error: "Subscription not found",
        success: false
      });
    }

    // Check if already confirmed — the webhook may have won this race. Make
    // sure a SubscriptionPayment row exists for this payment regardless of
    // which side confirmed first (mirrors the reconciliation added to
    // handlePaymentCaptured), rather than assuming the webhook already
    // recorded one.
    if (subscription.isPaymentConfirmed) {
      console.log('Payment already confirmed for subscription:', subscription._id);
      try {
        const existing = await SubscriptionPayment.findOne({ razorpayPaymentId: razorpay_payment_id });
        if (!existing) {
          const razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);
          await SubscriptionPayment.create({
            organization: subscription.organization,
            subscription: subscription._id,
            razorpayPaymentId: razorpay_payment_id,
            amount: razorpayPayment.amount / 100,
            status: razorpayPayment.status,
            method: razorpayPayment.method,
            paymentFor: 'subscription',
          });
        }
      } catch (reconcileErr) {
        console.error(`Failed to reconcile payment record for ${razorpay_payment_id}:`, reconcileErr.message);
      }
      // A webhook won the confirmation race. Ensure settlement side effects
      // ran even if the winning path was one that historically skipped them
      // (idempotent — no-op if already qualified/redeemed).
      await runFirstPaymentSettlement(subscription);
      return res.json({
        success: true,
        message: "Payment already confirmed",
        subscription: {
          _id: subscription._id,
          planName: subscription.planName,
          status: subscription.status,
          isPaymentConfirmed: subscription.isPaymentConfirmed
        }
      });
    }

    // Fetch payment details from Razorpay to verify
    try {
      const razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);
      const razorpaySubscription = await razorpay.subscriptions.fetch(razorpay_subscription_id);

      console.log('Fetched Razorpay details:', {
        payment_status: razorpayPayment.status,
        subscription_status: razorpaySubscription.status,
        amount: razorpayPayment.amount / 100
      });

      // Verify payment is captured/authorized
      if (razorpayPayment.status !== 'captured' && razorpayPayment.status !== 'authorized') {
        return res.status(400).json({ 
          error: `Payment not successful. Status: ${razorpayPayment.status}`,
          success: false
        });
      }

      // Update subscription with payment confirmation
      subscription.status = razorpaySubscription.status;
      subscription.isPaymentConfirmed = true;
      subscription.isTrialActive = false;
      subscription.paymentStatus = 'payment_completed';
      
      // Update billing dates if available
      if (razorpaySubscription.current_start) {
        subscription.currentPeriodStart = new Date(razorpaySubscription.current_start * 1000);
      }
      if (razorpaySubscription.current_end) {
        subscription.currentPeriodEnd = new Date(razorpaySubscription.current_end * 1000);
      }
      if (razorpaySubscription.charge_at) {
        subscription.nextBillingDate = new Date(razorpaySubscription.charge_at * 1000);
      }

      // Record payment
      const payment = new SubscriptionPayment({
        organization: subscription.organization,
        subscription: subscription._id,
        razorpayPaymentId: razorpay_payment_id,
        amount: razorpayPayment.amount / 100,
        status: razorpayPayment.status,
        method: razorpayPayment.method,
        paymentFor: 'subscription',
      });

      await payment.save();
      await subscription.save();
      await runFirstPaymentSettlement(subscription);

      console.log('Payment verified and subscription updated:', {
        subscription_id: subscription._id,
        payment_id: razorpay_payment_id
      });

      return res.json({
        success: true,
        message: "Payment verified successfully",
        subscription: {
          _id: subscription._id,
          planName: subscription.planName,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          userCount: subscription.userCount,
          totalAmount: subscription.totalAmount,
          isPaymentConfirmed: subscription.isPaymentConfirmed,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          nextBillingDate: subscription.nextBillingDate
        }
      });

    } catch (razorpayError) {
      console.error('Razorpay API error during verification:', razorpayError);
      return res.status(500).json({ 
        error: "Failed to verify payment with Razorpay",
        details: razorpayError.message,
        success: false
      });
    }

  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ 
      error: "Payment verification failed",
      details: error.message,
      success: false
    });
  }
};

exports.retryPayment = async (req, res) => {
  try {
    const { id } = req.params; // subscription ID

    const subscription = await Subscription.findOne({
      _id: id,
      organization: req.user.organization,
    });

    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    if (
      subscription.lastPaymentAttempt &&
      new Date() - new Date(subscription.lastPaymentAttempt.attemptedAt) <
        120000
    ) {
      return res
        .status(429)
        .json({
          error: "Payment processing in progress. Please wait before retrying.",
        });
    }

    // Check if subscription needs payment retry
    if (subscription.isPaymentConfirmed) {
      return res.status(400).json({
        error: "Subscription payment is already confirmed",
      });
    }

    // Get plan details for payment
    const plan = await PlanConfig.findOne({
      planId: subscription.planName,
      isActive: true,
    });

    if (!plan) {
      return res.status(404).json({ error: "Plan configuration not found" });
    }

    // Option 1: Use existing Razorpay subscription (if it exists)
    if (subscription.razorpaySubscriptionId) {
      try {
        // Fetch current Razorpay subscription status
        const razorpaySubscription = await razorpay.subscriptions.fetch(
          subscription.razorpaySubscriptionId
        );

        // If subscription exists in Razorpay and is in created/authenticated state
        if (
          ["created", "authenticated"].includes(razorpaySubscription.status)
        ) {
          return res.json({
            success: true,
            message: "Use existing subscription for retry",
            paymentDetails: {
              key: process.env.RAZORPAY_KEY_ID,
              subscription_id: razorpaySubscription.id,
              name: req.user.name,
              description: `Retry Payment - ${plan.name} Plan`,
              prefill: {
                name: req.user.name,
                email: req.user.email,
                contact: req.user.phone || "",
              },
              theme: { color: "#3399cc" },
              callback_url: `${process.env.FRONTEND_URL}/subscription/payment-success`,
            },
          });
        }
      } catch (razorpayError) {
        console.log(
          "Existing subscription not found in Razorpay, creating new one"
        );
      }
    }

    // Option 2: Create new Razorpay subscription for retry
    const razorpaySubscription = await razorpay.subscriptions.create({
      plan_id: subscription.razorpayPlanId,
      customer_notify: 1,
      quantity: subscription.userCount,
      total_count: subscription.billingCycle === "monthly" ? 12 : 1,
      notes: {
        organization_id: req.user.organization.toString(),
        plan_name: subscription.planName,
        billing_cycle: subscription.billingCycle,
        retry: "true",
      },
    });

    // Update subscription with new Razorpay subscription ID
    subscription.razorpaySubscriptionId = razorpaySubscription.id;
    subscription.paymentStatus = "pending_payment";
    subscription.isPaymentConfirmed = false;
    subscription.lastPaymentAttempt = {
      attemptedAt: new Date(),
      status: "retry_initiated",
    };

    await subscription.save();

    res.json({
      success: true,
      message: "Retry payment session created",
      paymentDetails: {
        key: process.env.RAZORPAY_KEY_ID,
        subscription_id: razorpaySubscription.id,
        name: req.user.name,
        description: `Retry Payment - ${plan.name} Plan`,
        prefill: {
          name: req.user.name,
          email: req.user.email,
          contact: req.user.phone || "",
        },
        theme: { color: "#3399cc" },
        callback_url: `${process.env.FRONTEND_URL}/subscription/payment-success`,
      },
    });
  } catch (error) {
    console.error("Retry payment error:", error);
    res.status(500).json({
      error: "Failed to create retry payment session",
      details: error.message,
    });
  }
};
exports.setAppStatus = setAppStatus;

exports.getSeatStatusEndpoint = async (req, res) => {
  try {
    const { getSeatStatus } = require('../utils/addonManagement');
    const status = await getSeatStatus(req.user.organization);
    res.json({
      includedSeats: status.includedSeats,
      extraSeatsOwned: status.extraSeatsOwned,
      totalSeats: status.totalSeats,
      occupiedSeats: status.occupiedSeats,
      hasFreeSeat: status.hasFreeSeat,
    });
  } catch (error) {
    console.error('getSeatStatus error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Deprecated — seats are just the "extra_seat" add-on. Use POST
// /subscription/addons/purchase (quantity of extra_seat) to add seats, or
// POST /subscription/addons/remove to schedule removal. This endpoint used
// to write activeAddons synchronously (no Order, no proration, no
// BillingEvent) — a second, uncoordinated writer to the same field the
// generic add-on engine owns. Nothing in the product calls it anymore
// (invite-time seat purchase now goes through the generic engine too).
exports.adjustSeats = async (req, res) => {
  return res.status(410).json({
    error: 'This endpoint is deprecated. Use POST /subscription/addons/purchase with { addonKey: "extra_seat", quantity } to add seats, or POST /subscription/addons/remove to schedule removal.',
  });
};

// Returns the calling org's referral code, issuing an active one if it
// doesn't have one yet. Org-facing — see REFERRAL_SYSTEM_DESIGN.md §22 for
// the fuller dashboard this is a minimal first piece of (not built yet).
exports.getOrgReferralCode = async (req, res) => {
  try {
    const ReferralCode = require('../models/ReferralCode');
    const { issueReferralCode } = require('../utils/referralUtils');

    let referralCode = await ReferralCode.findOne({ organization: req.user.organization, isActive: true }).sort({ createdAt: -1 });
    if (!referralCode) {
      referralCode = await issueReferralCode(req.user.organization);
    }
    res.json({ code: referralCode.code });
  } catch (error) {
    console.error('getOrgReferralCode error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Org-facing "my referrals" — code(s), referrals sent, whether this org was
// itself referred, every reward it holds (as referrer or referee) with a
// derived status, and summary counts. Read-only; shares its query shape
// with the Super Admin per-org overview (utils/referralUtils.js
// buildReferralOverview) rather than duplicating the logic. See
// REFERRAL_SYSTEM_DESIGN.md §22 (dashboard) — this is the data endpoint a
// future dashboard UI would call; no UI built yet.
exports.getMyReferralOverview = async (req, res) => {
  try {
    const { buildReferralOverview } = require('../utils/referralUtils');
    const overview = await buildReferralOverview(req.user.organization);
    res.json(overview);
  } catch (error) {
    console.error('getMyReferralOverview error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Applies a referral code typed in manually on the checkout page — acts
// immediately (mirrors the coupon field's own Apply button), not folded
// into a later Subscribe/Start Trial submission. Creates the Referral in
// 'pending' status right away, same business event and same shared
// helper (recordReferralIntent) as a link-based code applies at
// registration. Trial/payment status has no bearing on whether this
// succeeds. See backend/docs/REFERRAL_SYSTEM_DESIGN.md §3/§24.
exports.applyReferralCode = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'A referral code is required.' });
    }
    const { recordReferralIntent } = require('../utils/referralUtils');
    const result = await recordReferralIntent(req.user.organization, code.trim());
    if (!result.created) {
      return res.status(400).json({ error: result.reason });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('applyReferralCode error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Sends a "come try DataCircles" email carrying the org's referral link.
// Reuses the existing invite-email infrastructure (sendGridMail +
// authController's HTML-template pattern) rather than a separate mailing
// system, per REFERRAL_SYSTEM_DESIGN.md. IMPORTANT: this must never create
// a Referral — sending an email is not a referral event. A Referral is
// only ever created via recordReferralIntent, at registration (link-based)
// or via applyReferralCode (manual entry). This handler only issues/looks
// up the code and sends mail.
exports.sendReferralEmail = async (req, res) => {
  try {
    const { email, message } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'A recipient email is required.' });
    }

    const ReferralCode = require('../models/ReferralCode');
    const { issueReferralCode } = require('../utils/referralUtils');
    const Organization = require('../models/Organization');

    let referralCode = await ReferralCode.findOne({ organization: req.user.organization, isActive: true }).sort({ createdAt: -1 });
    if (!referralCode) {
      referralCode = await issueReferralCode(req.user.organization);
    }

    const org = await Organization.findById(req.user.organization);
    const referralLink = `${process.env.FRONTEND_URL}?ref=${referralCode.code}`;
    const senderName = req.user.name || req.user.email || 'A DataCircles user';

    const html = generateReferralEmailHTML(referralLink, org?.name || '', senderName, message?.trim() || '');
    await sendGridMail({ to: email.trim(), subject: `${senderName} invited you to try DataCircles`, html });

    res.json({ success: true });
  } catch (error) {
    console.error('sendReferralEmail error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Public endpoint — no auth required. Returns catalog add-ons for a plan before signup.
exports.getAddonsForPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const { billingCycle = 'monthly' } = req.query;

    const plan = await PlanConfig.findOne({ planId, isActive: true });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const addons = await PlanAddon.find({
      isActive: true,
      $or: [{ availableOnPlans: { $size: 0 } }, { availableOnPlans: planId }],
    }).sort({ sortOrder: 1 });

    res.json({
      addons: addons.map((a) => ({
        key: a.key,
        displayName: a.displayName,
        description: a.description,
        pricingType: a.pricingType,
        effectType: a.effectType,
        targetKey: a.targetKey,
        incrementPerUnit: a.incrementPerUnit,
        price: a.price,
        maxQuantityPerOrg: a.maxQuantityPerOrg,
      })),
    });
  } catch (error) {
    console.error('getAddonsForPlan error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getAvailableAddons = async (req, res) => {
  try {
    const { getAvailableAddonsForOrg } = require('../utils/addonManagement');
    const addons = await getAvailableAddonsForOrg(req.user.organization);
    res.json({ addons });
  } catch (error) {
    console.error('getAvailableAddons error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.checkAddonCompatibility = async (req, res) => {
  try {
    const { targetPlanId, billingCycle } = req.query;
    if (!targetPlanId || !billingCycle) {
      return res.status(400).json({ error: 'targetPlanId and billingCycle are required.' });
    }
    const subscription = await Subscription.findOne({ organization: req.user.organization });
    if (!subscription) return res.status(404).json({ error: 'No subscription found.' });

    const activeAddons = subscription.activeAddons || [];
    if (activeAddons.length === 0) {
      return res.json({ compatibleCarryForward: [], incompatibleDropped: [] });
    }

    const { compatible, incompatible } = await classifyAddonsForPlanChange(activeAddons, targetPlanId, billingCycle);
    res.json({ compatibleCarryForward: compatible, incompatibleDropped: incompatible });
  } catch (error) {
    console.error('checkAddonCompatibility error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.initiateAddonPurchase = async (req, res) => {
  try {
    const { addonKey, quantity } = req.body;

    if (!addonKey || typeof addonKey !== 'string') {
      return res.status(400).json({ error: 'addonKey is required.' });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive integer.' });
    }

    const subscription = await Subscription.findOne({ organization: req.user.organization });
    if (!subscription || !subscription.isPaymentConfirmed) {
      return res.status(400).json({ error: 'No active paid subscription found.' });
    }
    if (subscription.cancelAtPeriodEnd) {
      return res.status(400).json({ error: 'Cannot purchase add-ons when subscription is pending cancellation.' });
    }
    if (subscription.pendingAddonAddition?.orderId) {
      return res.status(400).json({ error: 'A previous add-on purchase is still pending payment. Complete or cancel it first.' });
    }

    const plan = await PlanConfig.findOne({ planId: subscription.planName, isActive: true });
    if (!plan) return res.status(404).json({ error: 'Plan configuration not found.' });

    const catalogEntry = await PlanAddon.findOne({ key: addonKey, isActive: true });
    if (!catalogEntry) return res.status(404).json({ error: `Add-on "${addonKey}" not found.` });

    const planAllowed =
      catalogEntry.availableOnPlans.length === 0 ||
      catalogEntry.availableOnPlans.includes(plan.planId);
    if (!planAllowed) {
      return res.status(400).json({ error: `Add-on "${catalogEntry.displayName}" is not available on the "${plan.planId}" plan.` });
    }

    const pricePerUnit = catalogEntry.price[subscription.billingCycle];
    if (!pricePerUnit) {
      return res.status(400).json({ error: `No price configured for "${catalogEntry.displayName}" on the ${subscription.billingCycle} billing cycle.` });
    }

    const prorationAmount = calculateAddonProration(
      quantity,
      pricePerUnit,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd
    );

    // RESERVE-FIRST: atomically reserve an available referral reward BEFORE
    // creating the discounted order. This ordering is deliberate and load-
    // bearing — if we created the order first and reserved after, a reward
    // consumed by a concurrent checkout in between would leave us charging a
    // discounted amount with no reward actually spent (a free discount). By
    // reserving first, the discount is only ever applied to an order backed
    // by a reward we hold. reserveNextAvailableReward is race-safe via the
    // partial unique index (see utils/referralRewards.js). Referral
    // resolution must never break add-on purchase, so it's best-effort.
    // Coupons don't apply to add-on purchases yet (known gap, §4.E).
    //
    // SAME-FLOW RECYCLE: release any reward reserved by a PREVIOUS, unpaid
    // add-on checkout for this org before reserving again — we overwrite
    // subscription.pendingAddonAddition below, making that old order
    // unsettleable, so its reservation would otherwise stay locked for its
    // 30-min TTL. Idempotent + guarded on status:'reserved', so a
    // since-consumed reservation is untouched. Only this flow's own prior
    // reservation, never an upgrade's — no cross-flow double-spend.
    if (subscription.pendingAddonAddition?.referralRewardUsageId) {
      try {
        await releaseReservation(subscription.pendingAddonAddition.referralRewardUsageId);
      } catch (relErr) {
        console.error('Failed to release prior add-on reservation:', relErr.message);
      }
    }

    let reservation = null;
    try {
      reservation = await reserveNextAvailableReward(req.user.organization, {
        subscription: subscription._id,
      });
    } catch (reserveErr) {
      console.error('Referral reservation failed (proceeding at full price):', reserveErr.message);
    }

    let discountedProrationAmount = prorationAmount;
    let referralDiscountAmount = 0;
    let referralRewardUsageId = null;
    if (reservation) {
      const referralModifier = rewardToModifier(reservation.reward);
      const applied = applyModifiers(prorationAmount, [referralModifier]);
      referralDiscountAmount = applied.discount;
      discountedProrationAmount = applied.totalAmount;
      referralRewardUsageId = reservation.usage._id;
    }

    // GST-inclusive amount for the actual Razorpay charge
    const prorationAmountWithGST = discountedProrationAmount + computeGST(discountedProrationAmount);

    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: prorationAmountWithGST * 100,
        currency: 'INR',
        receipt: `adn_${subscription._id.toString().slice(-8)}_${Date.now().toString().slice(-6)}`,
        notes: {
          organization_id: req.user.organization.toString(),
          subscription_id: subscription._id.toString(),
          addon_key: addonKey,
          quantity: quantity.toString(),
          price_per_unit: pricePerUnit.toString(),
          type: 'addon_purchase',
        },
      });
    } catch (orderErr) {
      // The order we reserved the reward for was never created — release the
      // reservation immediately so the reward is usable again, rather than
      // waiting for it to expire.
      if (referralRewardUsageId) await releaseReservation(referralRewardUsageId);
      throw orderErr;
    }

    // Backfill the order id onto the reservation for traceability (reserved
    // before the order existed, so invoiceId was null at reserve time).
    if (referralRewardUsageId) {
      await RewardUsage.updateOne({ _id: referralRewardUsageId }, { $set: { invoiceId: razorpayOrder.id } });
    }

    subscription.pendingAddonAddition = {
      addonKey,
      quantity,
      pricePerUnit,
      prorationAmount: prorationAmountWithGST, // GST-inclusive — matches actual order amount
      orderId: razorpayOrder.id,
      createdAt: new Date(),
      referralRewardUsageId,
    };
    await subscription.save();

    res.json({
      success: true,
      prorationAmount: discountedProrationAmount,
      referralDiscountApplied: referralDiscountAmount || undefined,
      paymentDetails: {
        key: process.env.RAZORPAY_KEY_ID,
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: 'INR',
        name: req.user.name,
        description: `${catalogEntry.displayName} ×${quantity} — pro-rated for remaining cycle`,
        prefill: {
          name: req.user.name,
          email: req.user.email,
          contact: req.user.phone || '',
        },
        theme: { color: '#3399cc' },
      },
    });
  } catch (error) {
    console.error('initiateAddonPurchase error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.scheduleAddonRemovalEndpoint = async (req, res) => {
  try {
    const { addonKey, quantity } = req.body;

    if (!addonKey) return res.status(400).json({ error: 'addonKey is required.' });
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive integer.' });
    }

    const subscription = await Subscription.findOne({ organization: req.user.organization });
    if (!subscription || !subscription.isPaymentConfirmed) {
      return res.status(400).json({ error: 'No active paid subscription found.' });
    }

    const result = await scheduleAddonRemovalUtil(req.user.organization, addonKey, quantity);

    await emitBillingEvent({
      organization: req.user.organization,
      subscription: subscription._id,
      eventType: 'ADDON_REMOVAL_SCHEDULED',
      status: 'scheduled',
      effectiveAt: result.effectiveAt,
      before: subscription,
      after: result.subscription,
      metadata: { addonKey, quantity, displayName: result.displayName },
    });

    res.json({
      success: true,
      message: `${result.displayName} ×${quantity} will be removed at the end of your current billing period (${new Date(result.effectiveAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}).`,
      effectiveAt: result.effectiveAt,
    });
  } catch (error) {
    console.error('scheduleAddonRemoval error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Deprecated — use POST /addons/purchase or POST /addons/remove
exports.adjustAddon = async (req, res) => {
  return res.status(410).json({
    error: 'This endpoint is deprecated. Use POST /subscription/addons/purchase to add add-ons or POST /subscription/addons/remove to schedule removal.',
  });
};
