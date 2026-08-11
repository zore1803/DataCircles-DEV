// utils/cycleTransitionLifecycle.js
//
// Phase 3 (docs/audit/PHASE3_MONTHLY_TO_ANNUAL_PRORATION.md): Monthly -> Annual
// base-plan cadence transition. Mirrors addonPurchaseLifecycle.js's shape
// exactly — a one-time Razorpay Order charge (NOT a CAW mandate charge),
// settled via the existing payment.captured webhook, not razorpay.subscriptions.
//
// Explicitly does NOT implement: Annual -> Monthly (separately settled as
// scheduled-at-term-end, no proration), any new mandate-capacity logic
// (reuses the existing guard), or any per-line-item coupon logic beyond what
// calculateInvoice() already does generically.

const { calculateInvoice, calculateCommercialAdjustments, toPricingBreakdown } = require('./invoiceEngine');
const { validateDowngrade } = require('./downgradeValidator');
const { classifyAddonsForPlanChange, getAddonRemovalEffectiveAt, addonIdentityKey } = require('./addonManagement');
const PlanAddon = require('../models/PlanAddon');
const CommercialTransaction = require('../models/CommercialTransaction');
const razorpay = require('../config/razorpay');

// Same inline tier-priority map used elsewhere in this codebase
// (subscriptionController.js:1384,2340) — duplicated rather than shared,
// matching the existing convention for this small constant.
const PLAN_PRIORITY = { starter: 1, growth: 2, business: 3 };

// Shared guard checks — both the real transition and its read-only preview
// must reject the exact same cases, so a preview never shows a price for a
// request the real endpoint would then refuse. Cross-tier eligibility
// (downgradeValidator) is checked here too, so a preview can surface
// DOWNGRADE_INELIGIBLE before the user ever reaches a payment step.
async function assertTransitionAllowed(subscription, plan, validateDowngradeFn) {
  if (!subscription || !subscription.isPaymentConfirmed) {
    throw new Error('No active paid subscription found.');
  }
  if (subscription.billingCycle !== 'monthly') {
    throw new Error('Only a monthly base plan can transition to annual through this flow.');
  }
  if (subscription.cancelAtPeriodEnd) {
    throw new Error('Cannot change billing cycle when subscription is pending cancellation.');
  }
  if (subscription.pendingCycleTransition?.orderId) {
    throw new Error('A previous cycle-transition purchase is still pending payment. Complete it first.');
  }
  if (!subscription.billingAnchor) {
    // No fallback here, unlike getAccessEntitlementEnd's read-only defensive
    // fallback — this prices a real charge (or a preview of one); guessing a
    // window without a real anchor would risk mispricing money. Fail loudly.
    throw new Error('Subscription has no billingAnchor recorded — cannot compute an entitlement window. Contact support.');
  }
  if (!plan) {
    throw new Error('Plan configuration not found.');
  }

  // Cross-tier support (this session's later decision): a transition to a
  // LOWER tier is simultaneously a downgrade. DEFAULT CHOICE, stated
  // explicitly for review — every other downgrade path in this codebase
  // gates through downgradeValidator.js before proceeding, so this reuses
  // the same gate here, even though every other downgrade is scheduled-at
  // -term-end and this one is immediate. Not separately confirmed as the
  // intended rule for this specific immediate-cross-tier case — flagged in
  // PHASE3_MONTHLY_TO_ANNUAL_PRORATION.md for explicit sign-off.
  const currentPriority = PLAN_PRIORITY[subscription.planName] || 0;
  const targetPriority = PLAN_PRIORITY[plan.planId] || 0;
  if (targetPriority < currentPriority) {
    const validation = await validateDowngradeFn(subscription, plan.planId, [], null);
    if (!validation.eligible) {
      const err = new Error(
        `Cannot switch to annual ${plan.planId}: current usage exceeds that plan's limits. ` +
        validation.blockers.map((b) => b.type).join(', ')
      );
      err.code = 'DOWNGRADE_INELIGIBLE';
      err.validation = validation;
      throw err;
    }
  }
}

// Shared pricing computation — used by BOTH the read-only preview and the
// real transaction-creating flow, so a preview can never show a number the
// real commit wouldn't also produce. Pure computation only: no Order, no
// CommercialTransaction, no subscription mutation.
function computeTransitionPricing(subscription, plan, calculateInvoiceFn, calculateCommercialAdjustmentsFn) {
  const monthlyBasePrice = subscription.pricePerUser;
  const annualBasePrice = plan.yearlyPrice;

  // Direct call to grab windowStart/windowEnd (+ the newAnnualValue/
  // unusedMonthlyValue breakdown, for display) — calculateInvoice() below
  // invokes calculateCommercialAdjustments() again internally with the
  // identical inputs, deterministically producing the same amount. Calling
  // the same pure function twice for two different purposes (raw adjustment
  // values vs. the full GST/discount-inclusive breakdown) is an existing
  // pattern in this codebase (subscriptionController.js's upgrade-preview
  // coupon-contribution display does the same thing), not a new one.
  const rawAdjustment = calculateCommercialAdjustmentsFn({
    type: 'cycle_transition_monthly_to_annual',
    monthlyBasePrice,
    annualBasePrice,
    anchor: subscription.billingAnchor,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
  });
  const { windowStart, windowEnd, newAnnualValue, unusedMonthlyValue, monthsCompleted, monthsIntoWindow } = rawAdjustment;

  const transitionInvoice = calculateInvoiceFn({
    subscription: {
      planName: subscription.planName,
      billingCycle: subscription.billingCycle,
      pricePerUser: 0,
      activeAddons: [],
    },
    changeset: { pricePerUser: 0 },
    adjustmentContext: {
      type: 'cycle_transition_monthly_to_annual',
      monthlyBasePrice,
      annualBasePrice,
      anchor: subscription.billingAnchor,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
    // No resolvedModifiers here deliberately — coupon/referral eligibility
    // for a cycle transition is not yet specified (ANNUAL_BILLING_SCOPE.md
    // item 7, still open) and this function must not guess. The full price
    // is quoted; discounting this specific transaction is future work.
  });

  return {
    monthlyBasePrice,
    annualBasePrice,
    windowStart,
    windowEnd,
    newAnnualValue,
    unusedMonthlyValue,
    monthsCompleted,
    monthsIntoWindow,
    transitionInvoice,
    amount: transitionInvoice.total,
  };
}

// Task 2 (Aug 2026): explicit per-add-on choice at transition checkout.
// Standing rule, restated per the brief that flagged this was violated: a
// monthly-cadence add-on is charged monthly, on its own independent cadence,
// and this NEVER changes automatically — only via the user's explicit
// per-add-on choice computed here.
//
// UPDATE (Aug 2026, Option A): the SU9 "no independent per-item renewal
// pipeline" policy this comment used to cite as the reason "keep Monthly"
// couldn't really mean monthly has been superseded — real per-add-on
// monthly billing now exists (utils/addonRenewalEngine.js). 'monthly'
// (default, no choice made) still leaves the existing add-on's
// billingCycle/pricePerUnit/periodEnd completely untouched here and at
// commit, but the commit branch (subscriptionController.js's cycle-
// transition webhook handler) now also starts that add-on's own independent
// renewal clock (nextRenewalAt) the moment the base plan becomes annual —
// this is the SAME undercharging bug Task 1 was written to close, just one
// more site it needed closing at (an existing "kept Monthly" add-on
// surviving a transition, not just a fresh purchase).
//
// 'yearly' (explicit choice) prices a REAL, itemized, separately-tracked
// conversion — reusing calculateCommercialAdjustments's existing
// 'addon_purchase' proration (calculateAddonProration), the SAME formula
// already used for a fresh annual add-on purchase, prorated against the
// NEW annual window (windowStart/windowEnd) this transition lands in — not
// a new formula.
async function computeAddonConversionPricing({
  subscription,
  targetPlanId,
  addonChoices = {},
  windowStart,
  windowEnd,
  calculateInvoiceFn = calculateInvoice,
  calculateCommercialAdjustmentsFn = calculateCommercialAdjustments,
  classifyAddonsForPlanChangeFn = classifyAddonsForPlanChange,
  getAddonRemovalEffectiveAtFn = getAddonRemovalEffectiveAt,
}) {
  const activeAddons = subscription.activeAddons || [];
  if (activeAddons.length === 0) {
    return { convertible: [], incompatible: [], choosable: [], totalAddonConversionAmount: 0 };
  }

  // Existing-plan-supports-target-plan compatibility — same classifier the
  // downgrade flow already uses, so "does the target plan support this
  // add-on at all" is answered identically everywhere in this codebase.
  const { compatible, incompatible: incompatibleRaw } = await classifyAddonsForPlanChangeFn(
    activeAddons, targetPlanId, subscription.billingCycle
  );
  const compatibleKeys = new Set(compatible.map((c) => c.addonKey));

  // Live-QA correctness fix (Aug 2026): must offer/price the choice against
  // the SURVIVING quantity, not the raw one — an addon with 2 units, 1
  // already scheduled for removal, must only offer "convert 1 to Annual,"
  // never silently re-quote the full 2 as if that removal didn't exist.
  // Same buildEffectiveSubscription() projection + addonIdentityKey lookup
  // this codebase's own upgrade-preview branch already uses for exactly
  // this reason (subscriptionController.js's isTierUpgrade branch).
  const { buildEffectiveSubscription } = require('./renewalEngine');
  const previewHorizon = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);
  const { effective } = await buildEffectiveSubscription(subscription, previewHorizon);
  const effectiveQuantityByKey = new Map(
    (effective.activeAddons || []).map((a) => [addonIdentityKey(a, subscription.billingCycle), a.quantity])
  );

  const incompatible = incompatibleRaw.map((a) => {
    const original = activeAddons.find((oa) => oa.addonKey === a.addonKey);
    return {
      addonKey: a.addonKey,
      quantity: a.quantity,
      pricePerUnit: a.pricePerUnit,
      // Access continues until the add-on's OWN natural term end — never
      // forced early just because the target plan doesn't support it.
      effectiveAt: getAddonRemovalEffectiveAtFn(original || a, subscription),
    };
  });

  const convertible = [];
  // Full list of every choosable (compatible) add-on, regardless of which
  // choice is currently in effect — this is what the checkout UI actually
  // renders a toggle for; `convertible` above stays the narrower "only the
  // ones actually being charged" list the commit path reads.
  const choosable = [];
  let totalAddonConversionAmount = 0;
  for (const addon of activeAddons) {
    if (!compatibleKeys.has(addon.addonKey)) continue; // incompatible — handled above, no choice offered
    if ((addon.billingCycle || 'monthly') === 'yearly') continue; // already annual — nothing to choose

    const survivingQuantity = effectiveQuantityByKey.get(addonIdentityKey(addon, subscription.billingCycle)) ?? 0;
    if (survivingQuantity <= 0) continue; // fully consumed by an already-scheduled removal — nothing left to offer a choice on

    // Live-QA visibility fix: a pending partial removal must be surfaced
    // in the same response the checkout UI renders the choice from — not
    // just correctly excluded from the price, but explicitly shown, so the
    // user sees "1 more unit still scheduled for removal" instead of
    // silently wondering why the quantity shown is lower than they expect.
    const pendingRemoval = (subscription.pendingAddonRemovals || []).find(
      (r) => r.addonKey === addon.addonKey && (r.billingCycle || subscription.billingCycle) === 'monthly'
    );

    const choice = addonChoices[addon.addonKey] || 'monthly';
    const catalogEntry = await PlanAddon.findOne({ key: addon.addonKey, isActive: true });
    const annualPricePerUnit = catalogEntry?.price?.yearly;

    if (choice !== 'yearly') {
      // 'monthly' (default): pure no-op, untouched — still reported so the
      // UI can render this add-on's toggle with its current (monthly) price.
      choosable.push({
        addonKey: addon.addonKey,
        pendingRemovalQuantity: pendingRemoval?.quantity || 0,
        pendingRemovalEffectiveAt: pendingRemoval?.effectiveAt || null,
        quantity: survivingQuantity,
        chosenCycle: 'monthly',
        monthlyPricePerUnit: addon.pricePerUnit,
        annualPricePerUnit: annualPricePerUnit || null,
        amount: null,
      });
      continue;
    }

    if (!annualPricePerUnit) {
      throw new Error(`Add-on "${addon.addonKey}" has no annual price configured — cannot convert to Annual.`);
    }

    // Same calculateCommercialAdjustments('addon_purchase') proration a
    // fresh annual add-on purchase already uses — prorated against the NEW
    // annual window, not the old monthly period.
    const conversionInvoice = calculateInvoiceFn({
      subscription: { planName: subscription.planName, billingCycle: 'yearly', pricePerUser: 0, activeAddons: [] },
      changeset: { pricePerUser: 0 },
      adjustmentContext: {
        type: 'addon_purchase',
        quantity: survivingQuantity,
        pricePerUnit: annualPricePerUnit,
        currentPeriodStart: windowStart,
        currentPeriodEnd: windowEnd,
      },
    });

    const item = {
      addonKey: addon.addonKey,
      quantity: survivingQuantity,
      fromPricePerUnit: addon.pricePerUnit,
      toPricePerUnit: annualPricePerUnit,
      amount: conversionInvoice.total,
      pricingBreakdown: toPricingBreakdown(conversionInvoice),
    };
    convertible.push(item);
    choosable.push({
      addonKey: addon.addonKey,
      quantity: survivingQuantity,
      chosenCycle: 'yearly',
      monthlyPricePerUnit: addon.pricePerUnit,
      annualPricePerUnit,
      amount: conversionInvoice.total,
      pendingRemovalQuantity: pendingRemoval?.quantity || 0,
      pendingRemovalEffectiveAt: pendingRemoval?.effectiveAt || null,
    });
    totalAddonConversionAmount += conversionInvoice.total;
  }

  return { convertible, incompatible, choosable, totalAddonConversionAmount };
}

// Read-only preview — no Order, no CommercialTransaction, no subscription
// mutation. Explains the calculation before the user commits to paying.
async function previewMonthlyToAnnualTransition({
  subscription,
  plan,
  addonChoices = {},
  calculateInvoiceFn = calculateInvoice,
  calculateCommercialAdjustmentsFn = calculateCommercialAdjustments,
  validateDowngradeFn = validateDowngrade,
}) {
  await assertTransitionAllowed(subscription, plan, validateDowngradeFn);
  const pricing = computeTransitionPricing(subscription, plan, calculateInvoiceFn, calculateCommercialAdjustmentsFn);

  const pricingBreakdown = toPricingBreakdown(pricing.transitionInvoice);
  if (pricingBreakdown.pricingLineItems[0]) {
    pricingBreakdown.pricingLineItems[0].label = plan.planId === subscription.planName
      ? `Annual plan (prorated transition from monthly)`
      : `Annual ${plan.planId} (prorated transition from monthly ${subscription.planName})`;
  }

  // Task 2 — itemized separately from the base plan amount above, never
  // folded into pricing.amount/pricingBreakdown.total. The base transition's
  // own charge is computed identically whether or not any add-on is
  // converted (see assertion in the fixture).
  const { convertible, incompatible, choosable, totalAddonConversionAmount } = await computeAddonConversionPricing({
    subscription, targetPlanId: plan.planId, addonChoices,
    windowStart: pricing.windowStart, windowEnd: pricing.windowEnd,
    calculateInvoiceFn,
  });

  return {
    fromPlanId: subscription.planName,
    fromBillingCycle: 'monthly',
    fromPricePerUser: pricing.monthlyBasePrice,
    toPlanId: plan.planId,
    toBillingCycle: 'yearly',
    toPricePerUser: pricing.annualBasePrice,
    newAnnualValue: Math.round(pricing.newAnnualValue),
    unusedMonthlyValue: Math.round(pricing.unusedMonthlyValue),
    monthsCompleted: pricing.monthsCompleted,
    monthsIntoWindow: pricing.monthsIntoWindow,
    amount: pricing.amount,
    windowStart: pricing.windowStart,
    windowEnd: pricing.windowEnd,
    pricingBreakdown,
    addonConversions: convertible,
    incompatibleAddons: incompatible,
    choosableAddons: choosable,
    totalAddonConversionAmount,
    // What the customer actually pays today if they confirm exactly these
    // addonChoices — base transition + every 'yearly'-chosen conversion,
    // itemized above, summed only for the single Order amount.
    grandTotal: pricing.amount + totalAddonConversionAmount,
  };
}

async function startMonthlyToAnnualTransition({
  user,
  organizationId,
  subscription,
  plan,
  addonChoices = {},
  calculateInvoiceFn = calculateInvoice,
  calculateCommercialAdjustmentsFn = calculateCommercialAdjustments,
  validateDowngradeFn = validateDowngrade,
  createRazorpayOrderFn = (params) => razorpay.orders.create(params),
  createCommercialTransactionFn = (data) => CommercialTransaction.create(data),
}) {
  await assertTransitionAllowed(subscription, plan, validateDowngradeFn);

  const pricing = computeTransitionPricing(subscription, plan, calculateInvoiceFn, calculateCommercialAdjustmentsFn);
  const { windowStart, windowEnd, transitionInvoice, amount } = pricing;

  // Task 2 — computed identically to the preview above (single source of
  // truth), and charged in the SAME Order as one payment, but tracked as
  // separate itemized amounts throughout (never summed into `amount` itself,
  // which stays the base-plan-only figure the CommercialTransaction/target
  // above already records).
  const { convertible: addonConversions, incompatible: incompatibleAddons, totalAddonConversionAmount } =
    await computeAddonConversionPricing({
      subscription, targetPlanId: plan.planId, addonChoices, windowStart, windowEnd, calculateInvoiceFn,
    });
  const orderAmount = amount + totalAddonConversionAmount;

  let commercialTransaction = null;
  try {
    commercialTransaction = await createCommercialTransactionFn({
      organization: organizationId,
      subscription: subscription._id,
      // Decision (this session): reuses CommercialTransaction's existing
      // 'BILLING_CYCLE_CHANGE' enum value — provisioned in the schema but,
      // confirmed by grep, never actually written anywhere before this.
      // Independent of ScheduledChange's own 'BILLING_CYCLE_CHANGE' type
      // (a different model, used only for the DEFERRED non-UPI cycle-change
      // path) — no shared enum space, no conflation risk. `target.immediate:
      // true` disambiguates this from that deferred concept for anyone
      // reading transaction history later.
      type: 'BILLING_CYCLE_CHANGE',
      status: 'PRICED',
      createdBy: user._id,
      target: {
        immediate: true,
        fromBillingCycle: 'monthly',
        toBillingCycle: 'yearly',
        fromPlanId: subscription.planName,
        toPlanId: plan.planId,
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

  let razorpayOrder;
  try {
    razorpayOrder = await createRazorpayOrderFn({
      amount: orderAmount * 100,
      currency: 'INR',
      receipt: `cyctr_${subscription._id.toString().slice(-12)}_${Date.now().toString(36)}`,
      notes: {
        organization_id: organizationId.toString(),
        subscription_id: subscription._id.toString(),
        type: 'cycle_transition_monthly_to_annual',
      },
    });
  } catch (orderErr) {
    throw orderErr;
  }

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

  subscription.pendingCycleTransition = {
    targetBillingCycle: 'yearly',
    targetPlanId: plan.planId,
    targetPricePerUser: pricing.annualBasePrice,
    amount,
    windowStart,
    windowEnd,
    orderId: razorpayOrder.id,
    createdAt: new Date(),
    addonConversions,
    incompatibleAddons,
  };
  await subscription.save();

  const pricingBreakdown = toPricingBreakdown(transitionInvoice);
  if (pricingBreakdown.pricingLineItems[0]) {
    pricingBreakdown.pricingLineItems[0].label = plan.planId === subscription.planName
      ? `Annual plan (prorated transition from monthly)`
      : `Annual ${plan.planId} (prorated transition from monthly ${subscription.planName})`;
  }

  return {
    subscription,
    amount,
    windowStart,
    windowEnd,
    pricingBreakdown,
    addonConversions,
    incompatibleAddons,
    totalAddonConversionAmount,
    orderId: razorpayOrder.id,
    paymentDetails: {
      key: process.env.RAZORPAY_KEY_ID,
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: 'INR',
      name: user.name,
      description: `Switch to Annual billing — prorated transition charge${addonConversions.length ? ' + add-on conversion' : ''}`,
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
  startMonthlyToAnnualTransition,
  previewMonthlyToAnnualTransition,
};
