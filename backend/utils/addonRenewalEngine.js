// utils/addonRenewalEngine.js
//
// Task 1 (Aug 2026), Option A — decided over the simpler "charge the full
// annual-equivalent value up front" alternative: a monthly-cadence add-on
// must actually be charged every month, on its own independent cadence,
// even while sitting on an annual base plan. The prior assumption (an
// add-on's billingCycle label was purely display/removal-timing metadata,
// with the actual recurring charge always riding the base subscription's
// own renewal — BILLING_DOMAIN_SPECIFICATION.md's SU9 policy) undercharged
// by design once cross-cycle transitions made base.billingCycle !==
// addon.billingCycle possible: an addon labeled "Monthly" sitting on an
// annual base was, in practice, charged once a year at its monthly rate —
// 1/12th of what "Monthly" has to mean for the label to be honest.
//
// SCOPE, DELIBERATELY NARROW (same "happy path first" precedent this
// codebase's own renewalEngine.js set for itself): one add-on instance, CAW
// mandate charge, no retry engine of its own yet. NOT wired into any cron —
// callable, not running, exactly like renewalEngine.js was at its own Slice 1.
//
// ONLY ever applies to a billingCycle:'monthly' addon instance on a
// subscription whose OWN billingCycle is 'yearly' (nextRenewalAt is only
// ever set for that exact mismatch — see models/Subscription.js's comment).
// An addon whose cycle matches the subscription's own continues to ride the
// base renewal completely unchanged — no double-charge risk, this engine
// never touches it.
//
// Failure semantics (deliberately chosen, stated explicitly): a clean charge
// decline does NOT degrade the whole subscription's appStatus the way a
// base-plan renewal failure does (SU9's "one combined overdue state" is
// correct for the base plan; it does not extend to an independently-billed
// add-on that was ALWAYS meant to be a separate commercial item). Instead,
// access to that specific add-on is scheduled for removal — the same
// "keep access until the current paid-for term ends, then stop" pattern
// already used for a plan-downgrade-incompatible add-on. The base plan is
// completely unaffected either way; this is exactly what makes it possible
// to answer "what happens if they cancel the annual plan mid-year" cleanly —
// nothing to charge, nothing degrades, the addon just isn't renewed again.

const { calculateInvoice, toPricingBreakdown } = require('./invoiceEngine');
const { addCalendarMonths } = require('./prorationMath');
const BillingInvoice = require('../models/BillingInvoice');
const CommercialTransaction = require('../models/CommercialTransaction');
const ScheduledChange = require('../models/ScheduledChange');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const { chargeMandateFn: defaultChargeMandateFn } = require('./razorpayChargeMandate');

function computeNextAddonRenewalDate(fromDate) {
  return addCalendarMonths(fromDate, 1);
}

// Charges ONE add-on instance's own monthly renewal via the CAW mandate —
// same charge primitive the base subscription renewal already uses
// (razorpayChargeMandate.js), just invoked per-add-on instead of
// per-subscription. Pure charge + record; does not decide cadence timing —
// the caller (runAddonRenewals below) is responsible for only calling this
// when nextRenewalAt is actually due.
async function renewAddonInstance({
  subscription,
  addon, // the specific activeAddons subdocument being renewed
  chargeMandateFn = defaultChargeMandateFn,
  calculateInvoiceFn = calculateInvoice,
  createBillingInvoiceFn = (data) => BillingInvoice.create(data),
  createCommercialTransactionFn = (data) => CommercialTransaction.create(data),
}) {
  const invoice = calculateInvoiceFn({
    subscription: { planName: subscription.planName, billingCycle: 'monthly', pricePerUser: 0, activeAddons: [{ addonKey: addon.addonKey, quantity: addon.quantity, pricePerUnit: addon.pricePerUnit }] },
  });

  const commercialTransaction = await createCommercialTransactionFn({
    organization: subscription.organization,
    subscription: subscription._id,
    type: 'ADDON_RENEWAL',
    status: 'PRICED',
    target: { addonKey: addon.addonKey, quantity: addon.quantity, pricePerUnit: addon.pricePerUnit, total: invoice.total },
  });

  const billingInvoice = await createBillingInvoiceFn({
    organization: subscription.organization,
    subscription: subscription._id,
    commercialTransaction: commercialTransaction._id,
    reason: 'ADDON_RENEWAL',
    lineItems: invoice.lines || [],
    subtotal: invoice.subtotal,
    discount: invoice.discount || 0,
    taxable: invoice.taxable,
    gst: invoice.gst,
    total: invoice.total,
    status: 'PENDING_PAYMENT',
  });

  let chargeResult;
  try {
    chargeResult = await chargeMandateFn({ subscription, amount: invoice.total });
  } catch (chargeErr) {
    // Ambiguous — same RECONCILIATION_NEEDED shape the base renewal uses for
    // this exact case. Nothing financial touched; a resumed sweep pass finds
    // this same non-terminal transaction.
    return { outcome: 'RECONCILIATION_NEEDED', reason: 'AMBIGUOUS_CHARGE_RESULT', error: chargeErr?.message, addonKey: addon.addonKey };
  }

  if (!chargeResult?.success) {
    // Clean decline — schedule removal at the end of THIS addon's own
    // already-paid-for month (addon.nextRenewalAt, the boundary that just
    // failed to renew), never immediately. Access already paid for is never
    // revoked early; access NOT paid for is never extended either.
    const effectiveAt = addon.nextRenewalAt || new Date();
    try {
      await ScheduledChange.create({
        organization: subscription.organization,
        subscription: subscription._id,
        type: 'REMOVE_ADDON',
        status: 'PENDING',
        effectiveAt,
        payload: { addonKey: addon.addonKey, quantity: addon.quantity, billingCycle: 'monthly' },
      });
    } catch (scErr) {
      console.error(`addonRenewalEngine: scheduling removal after failed renewal failed (non-fatal) — subscription=${subscription._id} addonKey=${addon.addonKey}:`, scErr.message);
    }
    return { outcome: 'FAILED_SCHEDULED_FOR_REMOVAL', addonKey: addon.addonKey, effectiveAt, invoice: billingInvoice._id, transaction: commercialTransaction._id };
  }

  // Success — record payment, commit the transaction/invoice, advance the
  // addon's own renewal clock by exactly one month from the boundary that
  // was due (never from "now", which would let a late-running sweep quietly
  // compress the cadence).
  try {
    await SubscriptionPayment.create({
      organization: subscription.organization,
      subscription: subscription._id,
      razorpayPaymentId: chargeResult.paymentId,
      amount: invoice.total,
      status: 'captured',
      paymentFor: 'addon_renewal',
    });
  } catch (paymentErr) {
    console.error(`addonRenewalEngine: recording payment failed (non-fatal) — subscription=${subscription._id} addonKey=${addon.addonKey}:`, paymentErr.message);
  }

  commercialTransaction.status = 'COMPLETED';
  commercialTransaction.target = { ...commercialTransaction.target, paymentId: chargeResult.paymentId, orderId: chargeResult.orderId };
  await commercialTransaction.save();

  billingInvoice.status = 'PAID';
  billingInvoice.paidAt = new Date();
  await billingInvoice.save();

  const dueAt = addon.nextRenewalAt || new Date();
  addon.lastRenewalAt = dueAt;
  addon.nextRenewalAt = computeNextAddonRenewalDate(dueAt);

  return { outcome: 'RENEWED', addonKey: addon.addonKey, amount: invoice.total, invoice: billingInvoice._id, transaction: commercialTransaction._id, nextRenewalAt: addon.nextRenewalAt };
}

// Sweep entry point — finds every add-on instance due for its own
// independent renewal (nextRenewalAt <= now) across every subscription, and
// renews each. NOT wired into any cron yet (same "callable, not running"
// convention renewalEngine.js itself started with) — a scheduler wiring this
// in on some interval (hourly/daily) is the natural next step once this is
// proven correct, not attempted in this same pass.
async function runAddonRenewals({ now = new Date(), SubscriptionModel = require('../models/Subscription'), renewAddonInstanceFn = renewAddonInstance } = {}) {
  const candidates = await SubscriptionModel.find({ 'activeAddons.nextRenewalAt': { $lte: now } });
  const results = [];
  for (const subscription of candidates) {
    const dueAddons = (subscription.activeAddons || []).filter((a) => a.nextRenewalAt && a.nextRenewalAt <= now);
    for (const addon of dueAddons) {
      const result = await renewAddonInstanceFn({ subscription, addon });
      results.push({ subscription: subscription._id, ...result });
    }
    await subscription.save();
  }
  return results;
}

module.exports = {
  computeNextAddonRenewalDate,
  renewAddonInstance,
  runAddonRenewals,
};
