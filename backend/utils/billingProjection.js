// utils/billingProjection.js
//
// Billing Calendar — canonical read-model projection. Composes existing
// billing engines only (renewalEngine.buildEffectiveSubscription,
// prorationMath.getEntitlementWindow, invoiceEngine.calculateInvoice/
// toPricingBreakdown, addonManagement.addonIdentityKey, ScheduledChange
// reads) — introduces NO new pricing or date math. If a number or date
// isn't already computable by an existing function, this module does not
// report it (see the `coupon`/`referral`/`transition: null` placeholders
// below — Phase 2 work, not invented here).
//
// The one invariant this module exists to enforce by construction: an
// add-on's CURRENT quantity and its SCHEDULED quantity (if a removal is
// pending) are always two separate fields, never collapsed into one —
// this is the exact bug class documented as BUG-024/BUG-041 in
// docs/audit/BillingFindings.md (a hardcoded removal quantity, and a
// >= keep/drop filter that silently mis-carries partial removals).

const ScheduledChange = require('../models/ScheduledChange');
const PlanAddon = require('../models/PlanAddon');
const { buildEffectiveSubscription } = require('./renewalEngine');
const { getEntitlementWindow } = require('./prorationMath');
const { calculateInvoice, toPricingBreakdown } = require('./invoiceEngine');
const { addonIdentityKey } = require('./addonManagement');
const { isCouponStillEligibleForRenewal } = require('./couponRenewalEligibility');
const { buildCouponModifierForLineItems } = require('./discountEngine');

const HORIZON_MS = 183 * 24 * 60 * 60 * 1000; // ~6 months, per spec §57 — no infinite monthly row list

// Same GST-inclusive single-addon renewal calculation addonRenewalEngine.js's
// renewAddonInstance() already uses (pricePerUser: 0, one addon line) — not a
// new calculation, just the same call made read-only here.
function addonRenewalAmount(addon) {
  const invoice = calculateInvoice({
    subscription: {
      planName: 'projection', // unused by calculateInvoice's pricing path when pricePerUser is 0 and it's the only line
      billingCycle: addon.billingCycle,
      pricePerUser: 0,
      activeAddons: [{ addonKey: addon.addonKey, quantity: addon.quantity, pricePerUnit: addon.pricePerUnit }],
    },
  });
  return invoice.total;
}

function nextAddonRenewalDate(addon, subscription) {
  if (addon.billingCycle === 'yearly') return addon.periodEnd || null;
  if (addon.nextRenewalAt) return addon.nextRenewalAt; // monthly addon riding an annual base
  return subscription.currentPeriodEnd; // monthly addon on a monthly base — rides the base renewal
}

async function buildAddonNameMap(activeAddons) {
  const keys = [...new Set(activeAddons.map((a) => a.addonKey))];
  if (keys.length === 0) return {};
  const catalog = await PlanAddon.find({ key: { $in: keys } }).select('key displayName');
  return catalog.reduce((map, c) => ({ ...map, [c.key]: c.displayName }), {});
}

// Builds the current/scheduled AddonEntry list for one cadence ('monthly' or
// 'yearly'), matching each live activeAddons entry against any PENDING
// REMOVE_ADDON ScheduledChange via addonIdentityKey — the exact matching
// getScheduledChanges (subscriptionController.js) already performs, not a
// second comparison.
function buildAddonEntries(activeAddons, cycle, subscription, scheduledChanges, nameMap) {
  return activeAddons
    .filter((a) => (a.billingCycle || subscription.billingCycle) === cycle)
    .map((addon) => {
      const removal = scheduledChanges.find(
        (c) =>
          c.type === 'REMOVE_ADDON' &&
          addonIdentityKey(c.payload, subscription.billingCycle) === addonIdentityKey(addon, subscription.billingCycle)
      );
      return {
        addonKey: addon.addonKey,
        name: nameMap[addon.addonKey] || addon.addonKey,
        billingCycle: cycle,
        current: {
          quantity: addon.quantity,
          pricePerUnit: addon.pricePerUnit,
          addedAt: addon.addedAt,
          nextRenewal: {
            date: nextAddonRenewalDate(addon, subscription),
            amount: addonRenewalAmount(addon),
          },
        },
        scheduled: removal
          ? { quantity: addon.quantity - removal.payload.quantity, effectiveAt: removal.effectiveAt }
          : null,
      };
    });
}

// Iterates three canonical sources only — never synthesizes a business rule.
// Every event carries `source` (where it came from) and `priority` (display
// weight only, decided here from the event's own type — React never
// classifies an event itself).
function buildUpcomingEvents({ subscription, addonEntries, scheduledChanges, cancellation, now, trial }) {
  const horizon = new Date(now.getTime() + HORIZON_MS);
  const events = [];

  // Trial end is the single most important near-term event for a trialing
  // org (spec feedback: it was previously invisible), and every field here
  // already exists on the projection (subscription.trialEnd, the base
  // plan's own nextRenewal amount) — no new computation, just one more
  // canonical event alongside the others below.
  if (trial?.active && trial.endsAt && trial.endsAt <= horizon) {
    // "billing begins" here used to imply a charge that will never happen —
    // nothing converts automatically at trial end (subscriptionLifecycleJobs.js's
    // expiry job only flips isTrialActive/appStatus, never charges anything).
    // No payment is scheduled unless the org actually buys a plan.
    events.push({
      type: 'trial_end',
      source: 'subscription',
      priority: 'critical',
      date: trial.endsAt,
      title: 'Free trial ends',
      description: 'No payment is scheduled — choose a plan to continue',
      amount: null,
    });
  }

  for (const change of scheduledChanges) {
    if (change.effectiveAt > horizon) continue;
    const priority = ['REMOVE_ADDON', 'CANCELLATION', 'PLAN_CHANGE'].includes(change.type) ? 'critical' : 'scheduled';
    const titleByType = {
      REMOVE_ADDON: `${change.payload.quantity} ${change.payload.addonKey} removed`,
      PLAN_CHANGE: 'Plan changes',
      BILLING_CYCLE_CHANGE: 'Billing cycle changes',
      CANCELLATION: 'Subscription cancels',
      REDUCE_QUANTITY: 'Quantity reduces',
    };
    events.push({
      type: change.type.toLowerCase(),
      source: 'scheduled_change',
      priority,
      date: change.effectiveAt,
      title: titleByType[change.type] || change.type,
      description: change.reason || null,
      amount: null,
    });
  }

  for (const entry of addonEntries) {
    const date = entry.current.nextRenewal.date;
    if (date && date <= horizon) {
      events.push({
        type: 'addon_renewal',
        source: 'active_addon',
        priority: 'info',
        date,
        title: `${entry.name} renews`,
        description: `×${entry.current.quantity} (${entry.billingCycle})`,
        amount: entry.current.nextRenewal.amount,
      });
    }
  }

  // Gated on isPaymentConfirmed, matching buildBillingProjection's own
  // nextRenewal gate exactly. A trial subscription also has
  // currentPeriodEnd set (= trialEnd, for internal bookkeeping — see
  // startFreeTrial) but nothing has ever been paid or committed, so there
  // is no real "plan renews" event to report — that's the trial_end event
  // above, not this one. Without this gate, every trialing org saw a
  // fabricated "growth plan renews" event alongside "Free trial ends",
  // implying a charge that was never scheduled and would never happen.
  if (subscription.isPaymentConfirmed && subscription.currentPeriodEnd && subscription.currentPeriodEnd <= horizon) {
    events.push({
      type: 'base_renewal',
      source: 'subscription',
      priority: 'critical',
      date: subscription.currentPeriodEnd,
      title: `${subscription.planName} plan renews`,
      description: subscription.billingCycle,
      amount: null, // filled in by the caller once previewRenewal() has run — see buildBillingProjection
    });
  }

  if (cancellation) {
    events.push({
      type: 'cancellation',
      source: 'scheduled_change',
      priority: 'critical',
      date: cancellation.effectiveAt,
      title: 'Subscription access ends',
      description: 'No refund is issued for the remaining term.',
      amount: null,
    });
  }

  return events.sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function buildBillingProjection(subscription) {
  const now = new Date();
  const previewHorizon = new Date(now.getTime() + 400 * 24 * 60 * 60 * 1000);

  const { effective, cancellation } = await buildEffectiveSubscription(subscription, previewHorizon);

  const scheduledChanges = await ScheduledChange.find({
    subscription: subscription._id,
    status: 'PENDING',
  }).sort({ effectiveAt: 1 });

  const activeAddons = (subscription.activeAddons || []).map((a) => (typeof a.toObject === 'function' ? a.toObject() : { ...a }));
  const nameMap = await buildAddonNameMap(activeAddons);

  const monthly = buildAddonEntries(activeAddons, 'monthly', subscription, scheduledChanges, nameMap);
  const annual = buildAddonEntries(activeAddons, 'yearly', subscription, scheduledChanges, nameMap);

  const entitlementWindow =
    subscription.billingCycle === 'yearly' && subscription.billingAnchor
      ? (() => {
          const { windowStart, windowEnd } = getEntitlementWindow(subscription.billingAnchor, now);
          const totalMs = windowEnd - windowStart;
          const consumedMs = Math.min(totalMs, Math.max(0, now - windowStart));
          const remainingMs = Math.max(0, totalMs - consumedMs);
          return {
            start: windowStart,
            end: windowEnd,
            now,
            consumedMs,
            remainingMs,
            consumedFraction: totalMs > 0 ? consumedMs / totalMs : 0,
            remainingFraction: totalMs > 0 ? remainingMs / totalMs : 0,
          };
        })()
      : null;

  // Reuses previewRenewal()'s own pricing steps (coupon eligibility -> referral
  // modifier -> calculateInvoice) rather than re-deriving them — but computed
  // inline here (not via a second import of previewRenewal) so it can also
  // account for currently-PENDING scheduled changes via `effective`, exactly
  // as getScheduledChanges's own effectiveRecurringTotal computation does.
  // Same pricing computation used both for "next renewal" (already-paying
  // subscriptions) and, during a trial, for "what the first payment will be"
  // — same invoice engine, same coupon-eligibility check either way, just
  // computed once here so the trial_end event never guesses a number.
  const pricingBreakdown = (() => {
    const resolvedModifiers = [];
    if (subscription.appliedCoupon?.fullRulesSnapshot && isCouponStillEligibleForRenewal(subscription.appliedCoupon)) {
      const effectiveLineItems = [
        { key: effective.planName, type: 'plan', amount: effective.pricePerUser },
        ...effective.activeAddons.map((a) => ({ key: a.addonKey, type: 'addon', amount: a.quantity * a.pricePerUnit })),
      ];
      const couponModifier = buildCouponModifierForLineItems(subscription.appliedCoupon.fullRulesSnapshot, effectiveLineItems);
      if (couponModifier) resolvedModifiers.push(couponModifier);
    }
    const invoice = calculateInvoice({ subscription: effective, resolvedModifiers });
    return toPricingBreakdown(invoice, { couponCode: subscription.appliedCoupon?.code });
  })();

  const nextRenewal =
    subscription.isPaymentConfirmed && subscription.currentPeriodEnd
      ? {
          date: subscription.currentPeriodEnd,
          amount: pricingBreakdown.total,
          taxableAmount: pricingBreakdown.taxableAmount,
          gst: pricingBreakdown.gst,
        }
      : null;

  const trial = {
    active: !!subscription.isTrialActive,
    startsAt: subscription.trialStart || null,
    endsAt: subscription.trialEnd || null,
    // Only meaningful (and only computed) while trialing — the price the
    // org converts into once the trial ends, same invoice math as any other
    // renewal, never a separate estimate.
    conversionAmount: subscription.isTrialActive ? pricingBreakdown.total : null,
  };

  const upcomingEvents = buildUpcomingEvents({
    subscription,
    addonEntries: [...monthly, ...annual],
    scheduledChanges,
    cancellation,
    now,
    trial,
  }).map((event) =>
    event.type === 'base_renewal' && nextRenewal ? { ...event, amount: nextRenewal.amount } : event
  );

  return {
    now,
    subscription: {
      id: subscription._id,
      planName: subscription.planName,
      billingCycle: subscription.billingCycle,
      status: subscription.appStatus,
      billingAnchor: subscription.billingAnchor,
    },
    basePlan: {
      current: {
        planName: subscription.planName,
        billingCycle: subscription.billingCycle,
        pricePerUser: subscription.pricePerUser,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
      },
      entitlementWindow,
      nextRenewal,
    },
    addons: { monthly, annual },
    scheduledChanges,
    cancellation: {
      scheduled: !!cancellation || !!subscription.cancelAtPeriodEnd,
      effectiveAt: cancellation?.effectiveAt || (subscription.cancelAtPeriodEnd ? subscription.currentPeriodEnd : null),
    },
    trial,
    coupon: null, // Phase 2 — see module header
    referral: null, // Phase 2 — see module header
    transition: null, // Phase 2 — see module header
    upcomingEvents,
  };
}

module.exports = { buildBillingProjection };
