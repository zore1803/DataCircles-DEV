// scripts/reconcileOrphanedCAWPayment.js
//
// One-off manual reconciliation for a specific real-world incident (Aug
// 2026, org 6a7d76a6cde6b1a3863e015f): the org subscribed to Growth, didn't
// pay immediately, then hit Change Plan -> Starter (which overwrote
// Subscription.registrationLinkId with the Starter link's id before the
// Growth link was ever paid). The org then went back and completed the
// ORIGINAL Growth registration link. Razorpay genuinely captured the
// payment and confirmed the mandate (payment.captured + token.confirmed,
// both logged, both signature-verified) — but handleCAWPaymentCaptured's
// registrationLinkId lookup found nothing (the doc pointed at the newer
// Starter link by then) and silently dropped the fact, leaving a real,
// captured CAW payment with a confirmed mandate and no corresponding active
// subscription. This is exactly the bug fixed in
// controllers/subscriptionController.js's handleCAWPaymentCaptured
// (organization-id fallback correlation + reconciling against the ACTUALLY
// PAID BillingInvoice/notes rather than the doc's later-overwritten
// fields) and in updateSubscription's pending branch (cancels a superseded
// registration link on Razorpay before creating a new one, so this can't
// recur going forward).
//
// This script performs, once, by hand, exactly what the fixed webhook
// handler would have done automatically had it received this event AFTER
// the fix landed. It does NOT call Razorpay — the payment and mandate are
// already real and confirmed there; this only brings the DB record in line
// with what Razorpay already recorded.
//
// Run from the backend/ directory (so .env resolves the same way every
// other backend script/server does): cd backend && node scripts/reconcileOrphanedCAWPayment.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Subscription = require('../models/Subscription');
const BillingInvoice = require('../models/BillingInvoice');
const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');
const RewardUsage = require('../models/RewardUsage');
const { emitBillingEvent } = require('../utils/billingEvents');
const { setAppStatus, runFirstPaymentSettlement } = require('../controllers/subscriptionController');
const { releaseReservation } = require('../utils/referralRewards');
const { addBillingCycle } = require('../utils/renewalEngine');

// Real values, taken directly from the logged webhook payloads pasted by
// the user — not guessed.
const ORG_ID = '6a7d76a6cde6b1a3863e015f';
const PAID_REGISTRATION_LINK_ID = 'inv_TPCnn0qNMa8WCW'; // the Growth link actually completed
const PAID_PAYMENT_ID = 'pay_TPCqal0MSmR42h';
const PAID_ORDER_ID = 'order_TPCnn90uamsHa3';
const PAID_AMOUNT_RUPEES = 649; // from "Processing payment.captured" log (amount already /100'd there)
const PAID_PLAN_NAME = 'growth';
const PAID_BILLING_CYCLE = 'monthly';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  const subscription = await Subscription.findOne({ organization: ORG_ID });
  if (!subscription) {
    throw new Error(`No Subscription found for organization ${ORG_ID}`);
  }

  if (subscription.isPaymentConfirmed && subscription.planName === PAID_PLAN_NAME) {
    console.log('Subscription already shows this plan as confirmed — nothing to do. Current state:', {
      planName: subscription.planName,
      billingCycle: subscription.billingCycle,
      isPaymentConfirmed: subscription.isPaymentConfirmed,
      appStatus: subscription.appStatus,
    });
    await mongoose.disconnect();
    return;
  }

  console.log('Current (broken) state:', {
    planName: subscription.planName,
    billingCycle: subscription.billingCycle,
    registrationLinkId: subscription.registrationLinkId,
    paymentStatus: subscription.paymentStatus,
    mandateStatus: subscription.mandateStatus,
    isPaymentConfirmed: subscription.isPaymentConfirmed,
    appStatus: subscription.appStatus,
  });

  const paidInvoice = await BillingInvoice.findOne({ 'razorpay.registrationLinkId': PAID_REGISTRATION_LINK_ID });
  const paidPlan = await PlanConfig.findOne({ planId: PAID_PLAN_NAME, isActive: true });
  if (!paidPlan) throw new Error(`Plan "${PAID_PLAN_NAME}" not found/active — cannot reconcile.`);

  let activeAddons = [];
  let totalAmount = PAID_BILLING_CYCLE === 'monthly' ? paidPlan.monthlyPrice : paidPlan.yearlyPrice;

  if (paidInvoice) {
    const addonLines = (paidInvoice.lineItems || []).filter((li) => li.type === 'addon');
    const addonEntries = addonLines.length
      ? await PlanAddon.find({ key: { $in: addonLines.map((li) => li.key) } })
      : [];
    activeAddons = addonLines.map((li) => {
      const entry = addonEntries.find((e) => e.key === li.key);
      const quantity = li.quantity || 1;
      return {
        addonKey: li.key,
        quantity,
        pricePerUnit: entry ? entry.price[PAID_BILLING_CYCLE] : (li.amount / quantity),
        addedAt: new Date(),
        billingCycle: PAID_BILLING_CYCLE,
      };
    });
    totalAmount = paidInvoice.taxable;
    console.log(`Found matching BillingInvoice — ${activeAddons.length} add-on(s) recovered, totalAmount=${totalAmount}.`);
  } else {
    console.warn('No matching BillingInvoice found — proceeding with base plan price only, no add-ons.');
  }

  subscription.planName = PAID_PLAN_NAME;
  subscription.billingCycle = PAID_BILLING_CYCLE;
  subscription.pricePerUser = PAID_BILLING_CYCLE === 'monthly' ? paidPlan.monthlyPrice : paidPlan.yearlyPrice;
  subscription.activeAddons = activeAddons;
  subscription.totalAmount = totalAmount;
  subscription.registrationLinkId = PAID_REGISTRATION_LINK_ID;
  subscription.paymentStatus = 'payment_completed';
  subscription.mandateStatus = 'confirmed'; // token.confirmed webhook already verified, per the pasted log
  subscription.lastPaymentAttempt = {
    razorpayPaymentId: PAID_PAYMENT_ID,
    amount: PAID_AMOUNT_RUPEES,
    attemptedAt: new Date(),
    status: 'captured',
  };
  subscription.isPaymentConfirmed = true;
  subscription.isTrialActive = false;

  // Referral-reward correlation — same root cause, same reconciliation
  // approach as handleCAWPaymentCaptured's own fix (see its comment): the
  // release-before-reserve guard on Change Plan / Resume Payment released
  // the reservation that actually discounted THIS invoice as
  // 'REPLACED_BY_RETRY', and reserved a fresh one for the newer, unpaid
  // attempt instead. Recovered by proximity — the reservation that funded
  // this invoice was created in the same request, so its reservedAt sits
  // within seconds of the invoice's own generatedAt.
  if (paidInvoice && paidInvoice.discount > 0) {
    const candidateUsage = await RewardUsage.findOne({
      subscription: subscription._id,
      context: 'TRIAL_CONVERSION',
      reservedAt: { $lte: new Date(paidInvoice.generatedAt.getTime() + 5000) },
    }).sort({ reservedAt: -1 });
    if (candidateUsage && candidateUsage.status === 'released' && candidateUsage.releaseReason === 'REPLACED_BY_RETRY') {
      try {
        await RewardUsage.updateOne(
          { _id: candidateUsage._id, status: 'released' },
          { $set: { status: 'reserved' }, $unset: { releasedAt: 1, releaseReason: 1 } }
        );
        if (subscription.pendingReferralRewardUsageId && String(subscription.pendingReferralRewardUsageId) !== String(candidateUsage._id)) {
          await releaseReservation(subscription.pendingReferralRewardUsageId, 'REPLACED_BY_NEW_INVOICE');
        }
        subscription.pendingReferralRewardUsageId = candidateUsage._id;
        console.log(`Reconciled referral reward usage ${candidateUsage._id} back onto the actually-paid invoice.`);
      } catch (rewardErr) {
        console.error(`Could not reinstate referral reward usage ${candidateUsage._id} (likely re-reserved elsewhere). Manual reconciliation required.`, rewardErr.message);
      }
    } else if (candidateUsage && candidateUsage.status !== 'released') {
      console.log(`Referral reward usage ${candidateUsage._id} is already ${candidateUsage.status} — nothing to fix.`);
    } else {
      console.log('Paid invoice has a discount but no matching released RewardUsage reservation was found (may be coupon-only, or check manually).');
    }
  }

  setAppStatus(subscription, 'active', 'Manually reconciled — orphaned CAW payment (registration link superseded before payment landed, see reconcileOrphanedCAWPayment.js header)');
  if (!subscription.currentPeriodStart) {
    const activatedAt = new Date();
    subscription.currentPeriodStart = activatedAt;
    subscription.currentPeriodEnd = addBillingCycle(activatedAt, subscription.billingCycle);
    subscription.nextBillingDate = subscription.currentPeriodEnd;
  }

  await subscription.save();

  await emitBillingEvent({
    organization: subscription.organization,
    subscription: subscription._id,
    eventType: 'SUBSCRIPTION_ACTIVATED',
    status: 'completed',
    after: subscription,
    amounts: { recurringAfter: subscription.totalAmount },
  });

  await runFirstPaymentSettlement(subscription);

  console.log('Reconciled. New state:', {
    planName: subscription.planName,
    billingCycle: subscription.billingCycle,
    activeAddons: subscription.activeAddons,
    totalAmount: subscription.totalAmount,
    isPaymentConfirmed: subscription.isPaymentConfirmed,
    appStatus: subscription.appStatus,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Reconciliation failed:', err);
  process.exit(1);
});
