const { calculateInvoice, toPricingBreakdown } = require('./invoiceEngine');
const CommercialTransaction = require('../models/CommercialTransaction');
const RewardUsage = require('../models/RewardUsage');
const { rewardToModifier } = require('./modifierResolver');
const { reserveNextAvailableReward, releaseReservation, getNextAvailableReward } = require('./referralRewards');
const { buildCouponModifierForItem } = require('./discountEngine');
const { isCouponStillEligibleForRenewal } = require('./couponRenewalEligibility');
const razorpay = require('../config/razorpay');

// Task 4 (Aug 2026): shared guard checks + resolvedBillingCycle/pricePerUnit
// derivation, used by BOTH the read-only preview and the real order-creating
// flow, so a preview can never show a number/error the real commit wouldn't
// also produce. Pure — no I/O beyond the reads already required to validate.
function resolveAddonPurchaseInputs(subscription, plan, catalogEntry, billingCycle) {
  if (!subscription || !subscription.isPaymentConfirmed) {
    throw new Error('No active paid subscription found.');
  }
  if (subscription.cancelAtPeriodEnd) {
    throw new Error('Cannot purchase add-ons when subscription is pending cancellation.');
  }
  if (!plan) {
    throw new Error('Plan configuration not found.');
  }
  if (!catalogEntry) {
    throw new Error('Add-on not found.');
  }

  const planAllowed =
    (catalogEntry.availableOnPlans?.length || 0) === 0 ||
    catalogEntry.availableOnPlans.includes(plan.planId);
  if (!planAllowed) {
    throw new Error(`Add-on "${catalogEntry.displayName}" is not available on the "${plan.planId}" plan.`);
  }

  const resolvedBillingCycle = billingCycle || subscription.billingCycle;
  if (resolvedBillingCycle === 'yearly' && subscription.billingCycle !== 'yearly') {
    throw new Error('An annual add-on can only be purchased on an annual base plan.');
  }

  const pricePerUnit = catalogEntry.price?.[resolvedBillingCycle];
  if (!pricePerUnit) {
    throw new Error(`No price configured for "${catalogEntry.displayName}" on the ${resolvedBillingCycle} billing cycle.`);
  }

  return { resolvedBillingCycle, pricePerUnit };
}

// Read-only preview — no Order, no CommercialTransaction, no reward
// RESERVATION (uses getNextAvailableReward's pure read instead of
// reserveNextAvailableReward's real reservation write), no subscription
// mutation. Mirrors cycleTransitionLifecycle.js's previewMonthlyToAnnualTransition
// shape: same pricing math as the real purchase, computed without any of
// its side effects, so the confirmation UI can show a real number before
// the user commits to paying.
async function previewAddonPurchase({
  subscription,
  plan,
  catalogEntry,
  addonKey,
  quantity,
  billingCycle,
  calculateInvoiceFn = calculateInvoice,
  getNextAvailableRewardFn = getNextAvailableReward,
}) {
  const { resolvedBillingCycle, pricePerUnit } = resolveAddonPurchaseInputs(subscription, plan, catalogEntry, billingCycle);

  const resolvedModifiers = [];
  if (subscription.appliedCoupon?.fullRulesSnapshot && isCouponStillEligibleForRenewal(subscription.appliedCoupon)) {
    const couponModifier = buildCouponModifierForItem(
      subscription.appliedCoupon.fullRulesSnapshot,
      { key: addonKey, type: 'addon', amount: pricePerUnit * quantity }
    );
    if (couponModifier) resolvedModifiers.push(couponModifier);
  }

  // Read-only peek — does NOT reserve. A reward that's available right now
  // could still be claimed by a concurrent purchase before this preview's
  // caller actually commits; the real purchase always re-resolves for
  // itself at that point, exactly like every other preview/commit pair in
  // this codebase (e.g. previewMonthlyToAnnualTransition's own preview-vs-
  // commit relationship) — a preview quotes the best available answer NOW,
  // it does not (and cannot, without reserving) guarantee it holds later.
  let peekedReward = null;
  try {
    peekedReward = await getNextAvailableRewardFn(subscription.organization);
  } catch (peekErr) {
    console.error('Referral reward peek failed (proceeding at full price):', peekErr.message);
  }
  if (peekedReward) {
    resolvedModifiers.push(rewardToModifier(peekedReward));
  }

  const addonInvoice = calculateInvoiceFn({
    subscription: {
      planName: subscription.planName,
      billingCycle: subscription.billingCycle,
      pricePerUser: 0,
      activeAddons: [],
    },
    changeset: { pricePerUser: 0 },
    adjustmentContext: {
      type: 'addon_purchase',
      quantity,
      pricePerUnit,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
    resolvedModifiers,
  });

  const pricingBreakdown = toPricingBreakdown(addonInvoice, {
    couponCode: subscription.appliedCoupon?.code,
    referralPercent: peekedReward?.rewardType === 'percentage' ? peekedReward.rewardValue : undefined,
  });
  if (pricingBreakdown.pricingLineItems[0]) {
    pricingBreakdown.pricingLineItems[0].label = `${catalogEntry.displayName} ×${quantity} (prorated)`;
  }

  return {
    billingCycle: resolvedBillingCycle,
    pricePerUnit,
    prorationAmount: addonInvoice.adjustment,
    discountedProrationAmount: addonInvoice.taxable,
    prorationAmountWithGST: addonInvoice.total,
    pricingBreakdown,
  };
}

async function startAddonPurchase({
  user,
  organizationId,
  subscription,
  plan,
  catalogEntry,
  addonKey,
  quantity,
  // Phase 2c (docs/audit/PHASE2_ADDON_CYCLE_TRACE.md) — optional, defaults to
  // the subscription's own cycle so every existing caller (no route wires
  // this param yet — that's Phase 2d) behaves exactly as before. Only a
  // caller that explicitly passes 'yearly' can ever request an annual addon.
  billingCycle,
  calculateInvoiceFn = calculateInvoice,
  reserveNextAvailableRewardFn = reserveNextAvailableReward,
  releaseReservationFn = releaseReservation,
  createRazorpayOrderFn = (params) => razorpay.orders.create(params),
  updateCommercialTransactionsFn = (filter, update) => CommercialTransaction.updateMany(filter, update),
  createCommercialTransactionFn = (data) => CommercialTransaction.create(data),
  updateRewardUsageFn = (id, update) => RewardUsage.updateOne({ _id: id }, { $set: update }),
  saveSubscriptionFn = (sub) => sub.save(),
}) {
  if (!subscription || !subscription.isPaymentConfirmed) {
    throw new Error('No active paid subscription found.');
  }
  if (subscription.cancelAtPeriodEnd) {
    throw new Error('Cannot purchase add-ons when subscription is pending cancellation.');
  }
  if (subscription.pendingAddonAddition?.orderId) {
    throw new Error('A previous add-on purchase is still pending payment. Complete or cancel it first.');
  }

  if (!plan) {
    throw new Error('Plan configuration not found.');
  }
  if (!catalogEntry) {
    throw new Error(`Add-on "${addonKey}" not found.`);
  }

  const planAllowed =
    (catalogEntry.availableOnPlans?.length || 0) === 0 ||
    catalogEntry.availableOnPlans.includes(plan.planId);
  if (!planAllowed) {
    throw new Error(`Add-on "${catalogEntry.displayName}" is not available on the "${plan.planId}" plan.`);
  }

  // Phase 2c cycle: defaults to the subscription's own cycle (existing
  // behavior, unchanged for every current caller). Business contract
  // (docs/audit/PHASE2_ADDON_CYCLE_TRACE.md): a monthly base plan may only
  // hold monthly add-ons; an annual base plan may hold either. This is the
  // one place that asymmetry is enforced for purchases.
  const resolvedBillingCycle = billingCycle || subscription.billingCycle;
  if (resolvedBillingCycle === 'yearly' && subscription.billingCycle !== 'yearly') {
    throw new Error('An annual add-on can only be purchased on an annual base plan.');
  }

  const pricePerUnit = catalogEntry.price?.[resolvedBillingCycle];
  if (!pricePerUnit) {
    throw new Error(`No price configured for "${catalogEntry.displayName}" on the ${resolvedBillingCycle} billing cycle.`);
  }

  if (subscription.pendingAddonAddition?.referralRewardUsageId) {
    try {
      await releaseReservationFn(subscription.pendingAddonAddition.referralRewardUsageId);
    } catch (relErr) {
      console.error('Failed to release prior add-on reservation:', relErr.message);
    }
  }

  let reservation = null;
  try {
    reservation = await reserveNextAvailableRewardFn(organizationId, {
      subscription: subscription._id,
      context: 'ADDON_PURCHASE',
    });
  } catch (reserveErr) {
    console.error('Referral reservation failed (proceeding at full price):', reserveErr.message);
  }

  let referralRewardUsageId = null;
  const resolvedModifiers = [];

  // Brief 1 — coupon, pushed BEFORE referral (Stage 6 -> Stage 7 per §3.3;
  // the actual sort is enforced inside calculateInvoice()/buildPricingSnapshot
  // regardless of push order, but matching the order confirms intent rather
  // than relying on that invariant silently). The add-on being purchased IS
  // the one unambiguous "item" here (confirmed by trace: calculateAddonProration()
  // already prices exactly one named addonKey/quantity/pricePerUnit) — no
  // Stage 5 change needed, unlike plan upgrades (filed separately). Reads
  // ONLY the frozen appliedCoupon.fullRulesSnapshot, never the live Coupon —
  // same immutability principle as duration/R7. CP3's "stops applying, no
  // error" falls out naturally: buildCouponModifierForItem returns null on
  // no match, a plain no-op.
  // Coupon P0 fix (found via live QA): gated on the SAME eligibility
  // question renewal already asked correctly — a first_payment coupon must
  // not keep discounting every add-on purchase after its one first invoice.
  if (subscription.appliedCoupon?.fullRulesSnapshot && isCouponStillEligibleForRenewal(subscription.appliedCoupon)) {
    const couponModifier = buildCouponModifierForItem(
      subscription.appliedCoupon.fullRulesSnapshot,
      { key: addonKey, type: 'addon', amount: pricePerUnit * quantity }
    );
    if (couponModifier) {
      resolvedModifiers.push(couponModifier);
    }
  }

  if (reservation) {
    resolvedModifiers.push(rewardToModifier(reservation.reward));
    referralRewardUsageId = reservation.usage._id;
  }

  const addonInvoice = calculateInvoiceFn({
    subscription: {
      planName: subscription.planName,
      billingCycle: subscription.billingCycle,
      pricePerUser: 0,
      activeAddons: [],
    },
    changeset: { pricePerUser: 0 },
    adjustmentContext: {
      type: 'addon_purchase',
      quantity,
      pricePerUnit,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
    resolvedModifiers,
  });

  const prorationAmount = addonInvoice.adjustment;
  const discountedProrationAmount = addonInvoice.taxable;
  // Per-source amounts, read from modifierBreakdown (Invoice Engine, always
  // computed internally, only newly surfaced) — NOT re-derived from the
  // combined `discount` field. Fixes a real UI bug found after coupon
  // support landed: `referralDiscountAmount` used to mean "combined
  // coupon+referral discount," so a coupon-only purchase would render
  // referral-specific copy ("🎉 Referral reward applied") for a discount
  // that had nothing to do with a referral. Each field below now means
  // exactly what its name says.
  const couponDiscountAmount = (addonInvoice.modifierBreakdown || []).filter((m) => m.type === 'coupon').reduce((sum, m) => sum + m.amount, 0);
  const referralDiscountAmount = (addonInvoice.modifierBreakdown || []).filter((m) => m.type === 'referral').reduce((sum, m) => sum + m.amount, 0);
  const totalDiscountAmount = addonInvoice.discount || 0;
  // BILLING_UX_SPEC.md §4 — record the real amount now that pricing knows
  // it (same reserve-before-pricing reasoning as the upgrade path). Reuses
  // the existing updateRewardUsageFn injectable rather than adding a new one.
  if (reservation && referralDiscountAmount > 0) {
    await updateRewardUsageFn(reservation.usage._id, { amount: referralDiscountAmount });
  }
  const prorationAmountWithGST = addonInvoice.total;
  // BILLING_UX_SPEC.md §1.2 — canonical shape, straightforward here since
  // (unlike plan upgrade) both coupon and referral are pushed directly into
  // THIS invoice's own resolvedModifiers — no separate baseline-netting
  // needed, addonInvoice.modifierBreakdown already carries both cleanly.
  const pricingBreakdown = toPricingBreakdown(addonInvoice, {
    couponCode: subscription.appliedCoupon?.code,
    referralPercent: reservation?.reward.rewardType === 'percentage' ? reservation.reward.rewardValue : undefined,
  });
  // Line label correction: toPricingBreakdown's default "Prorated Adjustment"
  // label is generic across upgrade/add-on; name it for what it actually is here.
  if (pricingBreakdown.pricingLineItems[0]) {
    pricingBreakdown.pricingLineItems[0].label = `${catalogEntry.displayName} ×${quantity} (prorated)`;
  }

  let commercialTransaction = null;
  try {
    await updateCommercialTransactionsFn(
      {
        organization: organizationId,
        subscription: subscription._id,
        type: 'ADDON_PURCHASE',
        status: { $in: ['CREATED', 'PRICED', 'AWAITING_PAYMENT', 'FAILED'] },
      },
      { $set: { status: 'VOID' } }
    );
    commercialTransaction = await createCommercialTransactionFn({
      organization: organizationId,
      subscription: subscription._id,
      type: 'ADDON_PURCHASE',
      status: 'PRICED',
      createdBy: user._id,
      target: { addonKey, quantity, pricePerUnit },
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
      amount: prorationAmountWithGST * 100,
      currency: 'INR',
      receipt: `${addonKey}_${subscription._id.toString().slice(-8)}_${Date.now().toString().slice(-6)}`,
      notes: {
        organization_id: organizationId.toString(),
        subscription_id: subscription._id.toString(),
        addon_key: addonKey,
        quantity: quantity.toString(),
        price_per_unit: pricePerUnit.toString(),
        type: 'addon_purchase',
      },
    });
  } catch (orderErr) {
    if (referralRewardUsageId) {
      await releaseReservationFn(referralRewardUsageId);
    }
    throw orderErr;
  }

  if (referralRewardUsageId) {
    await updateRewardUsageFn(referralRewardUsageId, { invoiceId: razorpayOrder.id });
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

  subscription.pendingAddonAddition = {
    addonKey,
    quantity,
    pricePerUnit,
    billingCycle: resolvedBillingCycle,
    prorationAmount: prorationAmountWithGST,
    orderId: razorpayOrder.id,
    createdAt: new Date(),
    referralRewardUsageId,
  };
  await saveSubscriptionFn(subscription);

  return {
    subscription,
    prorationAmount,
    discountedProrationAmount,
    couponDiscountAmount,
    referralDiscountAmount,
    totalDiscountAmount,
    pricingBreakdown,
    prorationAmountWithGST,
    orderId: razorpayOrder.id,
    paymentDetails: {
      key: process.env.RAZORPAY_KEY_ID,
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: 'INR',
      name: user.name,
      description: `${catalogEntry.displayName} ×${quantity} — pro-rated for remaining cycle`,
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
  startAddonPurchase,
  previewAddonPurchase,
};
