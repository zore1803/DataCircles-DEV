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
      // Found via live QA: this fires the moment a CAW mandate is REQUESTED
      // (Registration Link created), not when it's approved — "Subscribed"
      // falsely implies completion for something that might still be
      // abandoned. Renamed to match what's actually true at this point;
      // SUBSCRIPTION_ACTIVATED (below) is the new, separate event for the
      // real confirmation moment.
      return {
        title: `${prettyPlan(after?.planName)} Plan Selected`,
        subtitle: after?.appliedCoupon?.code ? `Coupon ${after.appliedCoupon.code} applied` : undefined,
        amountChange: perCycle(amounts.recurringAfter, cycle),
        detail: 'Awaiting mandate approval and first payment',
      };
    case 'SUBSCRIPTION_ACTIVATED':
      // The genuinely real moment — emitted only from reconcileMandate()'s
      // AND-gate (paymentStatus:'payment_completed' && mandateStatus:'confirmed'),
      // never at request time. This is the event that was previously missing
      // entirely — the timeline used to jump straight from "Subscribed" (at
      // request time) to nothing, which is exactly the confusing gap
      // reported live ("subscription active ??? payment maybe").
      return {
        title: `${prettyPlan(after?.planName)} Plan Active`,
        subtitle: 'Mandate approved, first payment captured',
        amountChange: perCycle(amounts.recurringAfter, cycle),
        detail: undefined,
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
    // Already reserved in BillingEvent's eventType enum but never wired up
    // to a summary until now — generic enough to cover any cancelled
    // scheduled change (downgrade today; billing-cycle-change tomorrow),
    // not just downgrades specifically.
    case 'SCHEDULE_CANCELLED':
      return {
        title: `Scheduled ${prettyPlan(event.metadata?.targetPlanId) ? `change to ${prettyPlan(event.metadata.targetPlanId)}` : 'change'} cancelled`,
        subtitle: `Staying on ${prettyPlan(after?.planName)}`,
        amountChange: amounts.recurringAfter != null ? `Recurring stays ${perCycle(amounts.recurringAfter, cycle)}` : undefined,
        detail: undefined,
      };
    case 'BILLING_CYCLE_CHANGE_SCHEDULED':
      return {
        title: `Billing cycle change scheduled`,
        subtitle: before?.billingCycle ? `${before.billingCycle} → ${after?.billingCycle}` : undefined,
        amountChange: amounts.recurringAfter != null ? `Becomes ${perCycle(amounts.recurringAfter, cycle)}` : undefined,
        detail: event.effectiveAt ? `Effective ${new Date(event.effectiveAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined,
      };
    case 'BILLING_CYCLE_CHANGE_COMPLETED':
      // Phase 3 — the IMMEDIATE Monthly->Annual transition, distinct from
      // BILLING_CYCLE_CHANGE_SCHEDULED above (the deferred non-UPI path).
      return {
        title: `Switched to Annual billing`,
        subtitle: before?.billingCycle ? `${before.billingCycle} → ${after?.billingCycle}` : undefined,
        amountChange: amounts.recurringAfter != null ? `Now ${perCycle(amounts.recurringAfter, cycle)}` : undefined,
        detail: amounts.paid ? `${money(amounts.paid)} paid today (prorated transition)` : undefined,
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
        // Fixed: previously hardcoded undefined regardless of `amounts` —
        // the one outlier among scheduling event types (DOWNGRADE_SCHEDULED/
        // BILLING_CYCLE_CHANGE_SCHEDULED already read amounts.recurringAfter
        // this same way). Now that the emission site actually passes
        // amounts, this can show it too.
        amountChange: amounts.recurringAfter != null ? `Becomes ${perCycle(amounts.recurringAfter, cycle)}` : undefined,
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
      return {
        title: event.metadata?.endedBy === 'admin' ? 'Trial Ended Early' : 'Trial Ended',
        subtitle: undefined,
        amountChange: undefined,
        detail: event.metadata?.endedBy === 'admin' ? 'Ended by support ahead of the original end date' : undefined,
      };
    case 'TRIAL_ADJUSTED': {
      const days = event.metadata?.adjustmentDays;
      const direction = days > 0 ? 'Extended' : 'Shortened';
      return {
        title: `Trial ${direction}`,
        subtitle: days != null ? `${direction === 'Extended' ? '+' : ''}${days} day${Math.abs(days) === 1 ? '' : 's'}` : undefined,
        amountChange: undefined,
        detail: event.effectiveAt ? `New end date: ${new Date(event.effectiveAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined,
      };
    }
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
      // BILLING_UX_SPEC.md §5 — "Used," not "Applied": the timeline records
      // history after the fact (the reward is gone permanently at this
      // point), whereas "Applied" is reserved for the in-checkout callout, a
      // different moment in the same lifecycle (§1.5) where "Applied" is
      // the correct, present-tense word.
      return {
        title: 'Referral Reward Used',
        subtitle: undefined,
        amountChange: amounts.discount != null ? `-${money(amounts.discount)}` : undefined,
        detail: undefined,
      };
    case 'REFERRAL_DISCOUNT_APPLIED':
      // BILLING_UX_SPEC.md §5/§3 — the referee's OWN entry, never shown to
      // the referrer. Deliberately different title/verb from the referrer's
      // "Reward Earned"/"Reward Used" — no "reward," no "earn," matching §3's
      // rule that referrer-side language never appears on the referee's side.
      return {
        title: 'Referral Discount Applied',
        subtitle: event.metadata?.referralPercent != null ? `${event.metadata.referralPercent}% off` : undefined,
        amountChange: amounts.discount != null ? `-${money(amounts.discount)}` : undefined,
        detail: 'Applied to your first invoice',
      };
    case 'REFERRAL_REWARD_REVOKED':
      return { title: 'Referral Reward Revoked', subtitle: undefined, amountChange: undefined, detail: undefined };
    case 'REFERRAL_REWARD_EXPIRED':
      return { title: 'Referral Reward Expired', subtitle: undefined, amountChange: undefined, detail: undefined };
    case 'REFERRAL_DISABLED':
      return { title: 'Referrals Disabled', subtitle: undefined, amountChange: undefined, detail: undefined };
    // C1 (coupon replacement) — these enum values existed but were never
    // emitted anywhere before; wiring in real copy now that
    // replaceAppliedCoupon/removeAppliedCoupon actually fire them.
    case 'COUPON_APPLIED':
      return {
        title: `Coupon ${after?.appliedCoupon?.code || ''} Applied`,
        subtitle: undefined,
        amountChange: amounts.recurringAfter != null ? `Recurring now ${perCycle(amounts.recurringAfter, cycle)}` : undefined,
        detail: undefined,
      };
    case 'COUPON_CHANGED':
      return {
        title: `Coupon changed to ${after?.appliedCoupon?.code || ''}`,
        subtitle: event.metadata?.previousCouponCode ? `${event.metadata.previousCouponCode} → ${after?.appliedCoupon?.code || ''}` : undefined,
        amountChange: amounts.recurringBefore != null ? `Recurring: ${perCycle(amounts.recurringBefore, cycle)} → ${perCycle(amounts.recurringAfter, cycle)}` : undefined,
        detail: undefined,
      };
    case 'COUPON_REMOVED':
      return {
        title: `Coupon ${event.metadata?.couponCode || before?.appliedCoupon?.code || ''} Removed`,
        subtitle: undefined,
        amountChange: amounts.recurringBefore != null ? `Recurring: ${perCycle(amounts.recurringBefore, cycle)} → ${perCycle(amounts.recurringAfter, cycle)}` : undefined,
        detail: 'Historical redemption is preserved — only future billing is affected',
      };
    case 'BILLING_RECONCILIATION_NEEDED':
      return {
        title: 'Needs Manual Review',
        subtitle: event.metadata?.reason || undefined,
        amountChange: undefined,
        detail: event.metadata?.note || 'Automated billing reconciliation could not fully resolve this — check backend logs for the originating handler and payment/registration link IDs in metadata.',
      };
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
