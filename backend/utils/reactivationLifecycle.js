// utils/reactivationLifecycle.js
//
// Task 3 (Aug 2026): resuming a LAPSED subscription (cancelAtPeriodEnd took
// effect — cron finalized appStatus to 'cancelled' once the period actually
// ended). Mirrors cycleTransitionLifecycle.js's shape exactly — a one-time
// Razorpay Order charge, settled via the existing payment.captured webhook,
// NOT a CAW mandate charge (there's nothing currently active to charge a
// mandate against).
//
// Settled by BILLING_DOMAIN_SPECIFICATION.md's amendment (search "AMENDED
// (Aug 2026, Task D") — reuses the SAME Subscription document and its
// original, immutable billingAnchor. Never creates a new Subscription
// record, never writes billingAnchor.
//
// Explicit assumption, stated per the brief's own request rather than
// silently picked: lapsed time is NOT charged for and NOT owed. For an
// annual subscriber, the anchor-relative window keeps accruing on its own
// cadence regardless of whether they were actually subscribed during it —
// resuming mid-window charges only for the REMAINING portion of whichever
// window "now" falls into (same getEntitlementWindow/remaining-window-ms
// formula already used by calculateMonthlyToAnnualTransition, just without
// that formula's "unused monthly value" credit, since nothing is currently
// active to credit from here). For a monthly subscriber, there is no
// window concept at all (getAccessEntitlementEnd's own documented rule) —
// resuming simply starts a fresh single-month period from today at the
// full monthly price, exactly like any other new monthly period.

const { calculateInvoice, toPricingBreakdown } = require('./invoiceEngine');
const { getEntitlementWindow, addCalendarMonths } = require('./prorationMath');
const CommercialTransaction = require('../models/CommercialTransaction');
const razorpay = require('../config/razorpay');

async function assertReactivationAllowed(subscription, plan, billingCycle) {
  if (!subscription) {
    throw new Error('No subscription found.');
  }
  // The lapsed state this flow targets: cancelAtPeriodEnd is still true
  // (the cron finalizer never resets it) and appStatus has moved past
  // active/past_due to 'cancelled'. A subscription still WITHIN its
  // scheduled-cancellation window (appStatus still active/past_due) should
  // use Task B's reactivateAndProceed instead — that path is cheaper (no
  // charge needed, nothing has lapsed yet) and must not be superseded by
  // this one for that case.
  if (subscription.appStatus !== 'cancelled') {
    throw new Error('Subscription has not lapsed — use the standard plan-change flow instead.');
  }
  if (subscription.pendingReactivation?.orderId) {
    throw new Error('A previous reactivation purchase is still pending payment. Complete it first.');
  }
  if (!plan) {
    throw new Error('Plan configuration not found.');
  }
  if (billingCycle === 'yearly' && !subscription.billingAnchor) {
    // Same fail-loudly rule as cycleTransitionLifecycle.js's identical
    // guard — this prices a real charge; guessing a window without a real
    // anchor risks mispricing money.
    throw new Error('Subscription has no billingAnchor recorded — cannot compute an entitlement window. Contact support.');
  }
}

// Shared pricing computation — used by BOTH the read-only preview and the
// real transaction-creating flow, so a preview can never show a number the
// real commit wouldn't also produce. Pure computation only: no Order, no
// CommercialTransaction, no subscription mutation, no anchor write.
function computeReactivationPricing(subscription, plan, billingCycle, calculateInvoiceFn, now = new Date()) {
  const basePrice = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

  let windowStart = null;
  let windowEnd = null;
  let amount;

  if (billingCycle === 'yearly') {
    const window = getEntitlementWindow(subscription.billingAnchor, now);
    windowStart = window.windowStart;
    windowEnd = window.windowEnd;
    const totalWindowMs = windowEnd - windowStart;
    const remainingWindowMs = windowEnd - now;
    // No "unused value" credit to subtract — unlike calculateMonthlyToAnnualTransition,
    // nothing is currently active/being paid for to credit from. The
    // customer pays for exactly the remaining portion of the window they're
    // stepping back into, nothing for the lapsed portion behind them.
    amount = Math.max(1, Math.round(basePrice * (remainingWindowMs / totalWindowMs)));
  } else {
    // Monthly has no anchor-relative window concept (getAccessEntitlementEnd's
    // own documented rule) — a fresh full-price single-month period starting
    // today, same as any other new monthly period.
    windowStart = now;
    windowEnd = addCalendarMonths(now, 1);
    amount = basePrice;
  }

  // No adjustmentContext here — 'amount' is already the final precomputed
  // reactivation price (remaining-window proration or flat monthly), not a
  // delta calculateCommercialAdjustments() would know how to reprice
  // (its dispatcher has no "flat_amount" case, and inventing one would
  // duplicate math already done above). Passing it directly as pricePerUser
  // lets calculateInvoice() add GST/line-item shape generically on top,
  // exactly like the existing 'plan_upgrade' preview call sites that pass
  // pricePerUser: 0 plus a real adjustment — this just skips that seam
  // since there's nothing left for it to compute.
  const reactivationInvoice = calculateInvoiceFn({
    subscription: {
      planName: plan.planId,
      billingCycle,
      pricePerUser: amount,
      activeAddons: [],
    },
    // No resolvedModifiers — coupon/referral eligibility for a reactivation
    // is not specified anywhere in this codebase and must not be guessed,
    // same reasoning cycleTransitionLifecycle.js's own pricing states.
  });

  return { basePrice, windowStart, windowEnd, amount, reactivationInvoice };
}

async function previewReactivation({ subscription, plan, billingCycle, calculateInvoiceFn = calculateInvoice }) {
  await assertReactivationAllowed(subscription, plan, billingCycle);
  const pricing = computeReactivationPricing(subscription, plan, billingCycle, calculateInvoiceFn);
  const pricingBreakdown = toPricingBreakdown(pricing.reactivationInvoice);
  if (pricingBreakdown.pricingLineItems[0]) {
    pricingBreakdown.pricingLineItems[0].label =
      billingCycle === 'yearly'
        ? `${plan.planId} — Annual (resuming, remaining-window proration)`
        : `${plan.planId} — Monthly (resuming)`;
  }

  return {
    planId: plan.planId,
    billingCycle,
    basePrice: pricing.basePrice,
    amount: pricing.amount,
    windowStart: pricing.windowStart,
    windowEnd: pricing.windowEnd,
    billingAnchorUnchanged: subscription.billingAnchor || null,
    pricingBreakdown,
  };
}

async function startReactivation({
  user,
  organizationId,
  subscription,
  plan,
  billingCycle,
  calculateInvoiceFn = calculateInvoice,
  createRazorpayOrderFn = (params) => razorpay.orders.create(params),
  createCommercialTransactionFn = (data) => CommercialTransaction.create(data),
}) {
  await assertReactivationAllowed(subscription, plan, billingCycle);
  const pricing = computeReactivationPricing(subscription, plan, billingCycle, calculateInvoiceFn);
  const { windowStart, windowEnd, amount, reactivationInvoice } = pricing;

  let commercialTransaction = null;
  try {
    commercialTransaction = await createCommercialTransactionFn({
      organization: organizationId,
      subscription: subscription._id,
      type: 'RENEWAL', // closest existing semantic — a fresh charge that resumes recurring billing, not a base-plan cycle change
      status: 'PRICED',
      createdBy: user._id,
      target: {
        reactivation: true,
        targetPlanId: plan.planId,
        targetBillingCycle: billingCycle,
        amount,
        windowStart,
        windowEnd,
      },
    });
  } catch (ctErr) {
    console.error(
      `CommercialTransaction creation failed (non-fatal) — organization=${organizationId} subscription=${subscription._id}:`,
      ctErr.message
    );
  }

  const razorpayOrder = await createRazorpayOrderFn({
    amount: amount * 100,
    currency: 'INR',
    receipt: `react_${subscription._id.toString().slice(-12)}_${Date.now().toString(36)}`,
    notes: {
      organization_id: organizationId.toString(),
      subscription_id: subscription._id.toString(),
      type: 'reactivation',
    },
  });

  if (commercialTransaction) {
    try {
      commercialTransaction.status = 'AWAITING_PAYMENT';
      commercialTransaction.target = { ...commercialTransaction.target, orderId: razorpayOrder.id };
      commercialTransaction.attemptCount = 1;
      commercialTransaction.lastAttemptAt = new Date();
      await commercialTransaction.save();
    } catch (ctErr) {
      console.error(
        `CommercialTransaction AWAITING_PAYMENT update failed (non-fatal) — organization=${organizationId} subscription=${subscription._id} transaction=${commercialTransaction._id}:`,
        ctErr.message
      );
    }
  }

  subscription.pendingReactivation = {
    targetPlanId: plan.planId,
    targetBillingCycle: billingCycle,
    targetPricePerUser: pricing.basePrice,
    amount,
    windowStart,
    windowEnd,
    orderId: razorpayOrder.id,
    createdAt: new Date(),
  };
  await subscription.save();

  const pricingBreakdown = toPricingBreakdown(reactivationInvoice);

  return {
    subscription,
    amount,
    windowStart,
    windowEnd,
    pricingBreakdown,
    orderId: razorpayOrder.id,
    paymentDetails: {
      key: process.env.RAZORPAY_KEY_ID,
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: 'INR',
      name: user.name,
      description: `Reactivate subscription — ${plan.planId} (${billingCycle})`,
      prefill: {
        name: user.name,
        email: user.email,
        contact: user.phone || '',
      },
      theme: { color: '#3399cc' },
    },
  };
}

module.exports = {
  previewReactivation,
  startReactivation,
  computeReactivationPricing,
};
