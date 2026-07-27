const { calculateInvoice } = require('./invoiceEngine');
const CommercialTransaction = require('../models/CommercialTransaction');
const RewardUsage = require('../models/RewardUsage');
const { rewardToModifier } = require('./modifierResolver');
const { reserveNextAvailableReward, releaseReservation } = require('./referralRewards');
const { buildCouponModifierForItem } = require('./discountEngine');
const razorpay = require('../config/razorpay');

async function startAddonPurchase({
  user,
  organizationId,
  subscription,
  plan,
  catalogEntry,
  addonKey,
  quantity,
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

  const pricePerUnit = catalogEntry.price?.[subscription.billingCycle];
  if (!pricePerUnit) {
    throw new Error(`No price configured for "${catalogEntry.displayName}" on the ${subscription.billingCycle} billing cycle.`);
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
  if (subscription.appliedCoupon?.fullRulesSnapshot) {
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
  const prorationAmountWithGST = addonInvoice.total;

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
};
