// utils/billingEvents.js
//
// One place to emit BillingEvents. Emission is FIRE-AND-FORGET: it must never
// throw into or block a billing flow, because an audit-log write failing is
// never a reason to fail (or worse, half-complete) a real payment. Callers
// `await emitBillingEvent(...)` for ordering but it resolves even on error.
const BillingEvent = require('../models/BillingEvent');

// Freezes the billing-relevant slice of a subscription document into the
// snapshot shape BillingEvent stores. Accepts either a live Subscription
// doc or a plain object (e.g. a reconstructed before-state).
function snapshotOf(sub) {
  if (!sub) return undefined;
  return {
    planName: sub.planName,
    billingCycle: sub.billingCycle,
    pricePerUser: sub.pricePerUser,
    userCount: sub.userCount,
    totalAmount: sub.totalAmount,
    activeAddons: (sub.activeAddons || []).map((a) => ({
      addonKey: a.addonKey,
      quantity: a.quantity,
      pricePerUnit: a.pricePerUnit,
    })),
    appliedCoupon: sub.appliedCoupon?.code
      ? {
          code: sub.appliedCoupon.code,
          name: sub.appliedCoupon.name,
          discountAmount: sub.appliedCoupon.discountAmount,
        }
      : undefined,
  };
}

const prettyPlan = (name) => (name ? name.charAt(0).toUpperCase() + name.slice(1) : name);
// Add-on/plan keys can be snake_case ("extra_seat") — prettyPlan alone only
// capitalizes the first letter, leaving "Extra_seat". This replaces
// underscores and title-cases every word.
const prettyKey = (key) => (key || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const money = (n) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;
const perCycle = (n, cycle) => `${money(n)}/${cycle === 'yearly' ? 'yr' : 'mo'}`;

// Computes the human-readable summary ONCE, at write time, from the same
// before/after/amounts/metadata the event is already storing — so the
// Timeline UI never has to infer "what changed" from raw snapshots, and that
// logic lives in exactly one place instead of being duplicated in React.
function buildEventSummary(event) {
  const before = event.before;
  const after = event.after;
  const amounts = event.amounts || {};
  const cycle = after?.billingCycle || before?.billingCycle;

  switch (event.eventType) {
    case 'SUBSCRIPTION_CREATED':
      return {
        title: `Subscribed to ${prettyPlan(after?.planName)}`,
        subtitle: after?.appliedCoupon?.code ? `Coupon ${after.appliedCoupon.code} applied` : undefined,
        amountChange: perCycle(amounts.recurringAfter, cycle),
        detail: amounts.discount ? `${money(amounts.discount)} discount applied` : undefined,
      };
    case 'PLAN_UPGRADE':
      return {
        title: `Upgraded to ${prettyPlan(event.metadata?.newPlanName || after?.planName)}`,
        subtitle: before?.planName ? `${prettyPlan(before.planName)} → ${prettyPlan(after?.planName)}` : undefined,
        amountChange: amounts.recurringBefore != null ? `${money(amounts.recurringAfter - amounts.recurringBefore)} more per cycle` : undefined,
        detail: amounts.paid ? `${money(amounts.paid)} paid today (prorated)` : undefined,
      };
    case 'PLAN_DOWNGRADE':
      return {
        title: `Downgraded to ${prettyPlan(after?.planName)}`,
        subtitle: before?.planName ? `${prettyPlan(before.planName)} → ${prettyPlan(after?.planName)}` : undefined,
        amountChange: amounts.recurringBefore != null ? `${money(amounts.recurringBefore - amounts.recurringAfter)} less per cycle` : undefined,
        detail: undefined,
      };
    case 'DOWNGRADE_SCHEDULED':
      return {
        title: `Downgrade scheduled to ${prettyPlan(event.metadata?.targetPlanId || after?.planName)}`,
        subtitle: before?.planName ? `${prettyPlan(before.planName)} → ${prettyPlan(after?.planName)}` : undefined,
        amountChange: amounts.recurringAfter != null ? `Becomes ${perCycle(amounts.recurringAfter, cycle)}` : undefined,
        detail: event.effectiveAt ? `Effective ${new Date(event.effectiveAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined,
      };
    case 'BILLING_CYCLE_CHANGE_SCHEDULED':
      return {
        title: `Billing cycle change scheduled`,
        subtitle: before?.billingCycle ? `${before.billingCycle} → ${after?.billingCycle}` : undefined,
        amountChange: amounts.recurringAfter != null ? `Becomes ${perCycle(amounts.recurringAfter, cycle)}` : undefined,
        detail: event.effectiveAt ? `Effective ${new Date(event.effectiveAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined,
      };
    case 'ADDON_ADDED':
      return {
        title: `${prettyKey(event.metadata?.addonKey)} Added`,
        subtitle: event.metadata?.quantity > 1 ? `×${event.metadata.quantity}` : undefined,
        amountChange: amounts.recurringBefore != null ? `+${money(amounts.recurringAfter - amounts.recurringBefore)} per cycle` : undefined,
        detail: amounts.paid ? `${money(amounts.paid)} paid today (prorated)` : undefined,
      };
    case 'ADDON_REMOVAL_SCHEDULED':
      return {
        title: `${prettyKey(event.metadata?.addonKey)} removal scheduled`,
        subtitle: event.metadata?.quantity > 1 ? `×${event.metadata.quantity}` : undefined,
        amountChange: undefined,
        detail: event.effectiveAt ? `Effective ${new Date(event.effectiveAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined,
      };
    case 'ADDON_REMOVED':
      return {
        title: `${prettyKey(event.metadata?.addonKey)} Removed`,
        subtitle: event.metadata?.quantity > 1 ? `×${event.metadata.quantity}` : undefined,
        amountChange: amounts.recurringBefore != null ? `-${money(amounts.recurringBefore - amounts.recurringAfter)} per cycle` : undefined,
        detail: undefined,
      };
    case 'RENEWAL':
      return {
        title: 'Renewal',
        subtitle: prettyPlan(after?.planName),
        amountChange: amounts.paid != null ? money(amounts.paid) + ' paid' : undefined,
        detail: undefined,
      };
    case 'PAYMENT_FAILED':
      return {
        title: 'Payment Failed',
        subtitle: event.metadata?.reason || undefined,
        amountChange: undefined,
        detail: undefined,
      };
    case 'TRIAL_STARTED':
      return { title: 'Free Trial Started', subtitle: prettyPlan(after?.planName), amountChange: undefined, detail: event.effectiveAt ? `Ends ${new Date(event.effectiveAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined };
    case 'TRIAL_ENDED':
      return { title: 'Trial Ended', subtitle: undefined, amountChange: undefined, detail: undefined };
    case 'SUBSCRIPTION_CANCELLED':
      return {
        title: event.status === 'scheduled' ? 'Cancellation Scheduled' : 'Subscription Cancelled',
        subtitle: prettyPlan(after?.planName || before?.planName),
        amountChange: undefined,
        detail: event.effectiveAt ? `Effective ${new Date(event.effectiveAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined,
      };
    case 'REFERRAL_RECORDED':
      return { title: 'Referral Recorded', subtitle: undefined, amountChange: undefined, detail: 'Awaiting first payment' };
    case 'REFERRAL_REWARD_EARNED':
      return {
        title: 'Referral Reward Earned',
        subtitle: event.metadata?.rewardType === 'fixed'
          ? money(event.metadata?.rewardValue)
          : `${event.metadata?.rewardValue}% off`,
        amountChange: undefined,
        detail: undefined,
      };
    case 'REFERRAL_REWARD_RESERVED':
      return { title: 'Referral Reward Reserved', subtitle: undefined, amountChange: undefined, detail: 'Applied to a pending invoice' };
    case 'REFERRAL_REWARD_RELEASED':
      return { title: 'Referral Reward Released', subtitle: undefined, amountChange: undefined, detail: 'Available again' };
    case 'REFERRAL_REWARD_CONSUMED':
      return {
        title: 'Referral Reward Applied',
        subtitle: undefined,
        amountChange: amounts.discount != null ? `-${money(amounts.discount)}` : undefined,
        detail: undefined,
      };
    case 'REFERRAL_REWARD_REVOKED':
      return { title: 'Referral Reward Revoked', subtitle: undefined, amountChange: undefined, detail: undefined };
    case 'REFERRAL_REWARD_EXPIRED':
      return { title: 'Referral Reward Expired', subtitle: undefined, amountChange: undefined, detail: undefined };
    case 'REFERRAL_DISABLED':
      return { title: 'Referrals Disabled', subtitle: undefined, amountChange: undefined, detail: undefined };
    default:
      return { title: event.eventType, subtitle: undefined, amountChange: undefined, detail: undefined };
  }
}

// event: {
//   organization, subscription, eventType,
//   occurredAt?, effectiveAt?, status?,
//   before?, after?,        // subscription docs/objects — snapshotted here
//   amounts?, payment?, razorpay?, metadata?,
// }
async function emitBillingEvent(event) {
  try {
    await BillingEvent.create({
      organization: event.organization,
      subscription: event.subscription,
      eventType: event.eventType,
      occurredAt: event.occurredAt || new Date(),
      effectiveAt: event.effectiveAt || event.occurredAt || new Date(),
      status: event.status || 'completed',
      beforeSnapshot: snapshotOf(event.before),
      afterSnapshot: snapshotOf(event.after),
      summary: buildEventSummary(event),
      amounts: event.amounts,
      payment: event.payment,
      razorpay: event.razorpay,
      metadata: event.metadata,
    });
  } catch (err) {
    // Never propagate — a logging failure must not break the billing flow.
    console.error(`emitBillingEvent(${event?.eventType}) failed:`, err.message);
  }
}

module.exports = { emitBillingEvent, snapshotOf, buildEventSummary };
