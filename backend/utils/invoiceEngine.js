// utils/invoiceEngine.js
//
// calculateInvoice() — the single pricing authority for Charge-at-Will
// (see backend/docs/audit/CAW_BILLING_DESIGN.md §4). PURE function: no I/O,
// no DB reads, no Razorpay calls. Any coupon/referral eligibility check (a
// DB read) must happen in the CALLER before building `resolvedModifiers` —
// the same separation of concerns utils/pricingEngine.js's
// buildPricingSnapshot already uses (see that file's header comment).
//
// Phase 3 item 5a (backend/docs/audit/IMPLEMENTATION_PLAN_V1.md,
// PHASE3_DESIGN_NOTE_INVOICE_ENGINE.md): Stage 5 (Commercial Adjustments —
// proration/unused-value, BILLING_DOMAIN_SPECIFICATION.md §3.3) now exists
// inside this engine via the optional `adjustmentContext` param and
// calculateCommercialAdjustments() below — Option C'' from the design note.
// createSubscription already calls this engine (Phase 2a). The Stage 5
// controller migrations for upgrade/add-on/seat purchase flows are already
// in place; this file now exposes that capability without introducing a
// separate manual pricing branch.
//
// Internally reuses buildPricingSnapshot (subtotal/discount/GST math) and
// utils/prorationMath.js's existing proration math (calculatePlanUpgradeProration/
// calculateAddonProration, also re-exported from addonManagement.js for its
// existing callers) rather than reimplementing either — this is a
// reshaping/consolidation layer around already-tested engines, not a second
// pricing implementation. Deliberately does NOT change
// calculatePlanUpgradeProration()'s/calculateAddonProration()'s existing
// signature or return shape (still a bare number) — a third, previously
// untracked caller (authController.js's extra-seat purchase endpoint) reads
// their return value directly as a number, and changing that shape would have
// silently broken a live Razorpay charge computation. calculateCommercialAdjustments()
// wraps their existing bare-number output into the Stage 5 line-item shape
// instead of altering what they return.
//
// Requires prorationMath.js directly, NOT addonManagement.js — the latter
// requires config/razorpay.js at module-load time, which throws without
// Razorpay env vars configured. This engine must stay genuinely pure/I-O-free
// per its own contract above; that was verified the hard way (see the item
// 5a implementation notes) when requiring addonManagement.js broke exactly
// that in a plain node -e test.

const { buildPricingSnapshot } = require('./pricingEngine');
const { calculatePlanUpgradeProration, calculateAddonProration } = require('./prorationMath');

const SEAT_ADDON_KEY = 'extra_seat';

/**
 * Stage 5 — Commercial Adjustments (BILLING_DOMAIN_SPECIFICATION.md §3.3).
 * Wraps the existing, already-tested proration functions into a line-item
 * shape calculateInvoice() can fold into its own pipeline. Does not
 * reimplement proration math — reuses calculatePlanUpgradeProration()/
 * calculateAddonProration() exactly as they exist today.
 *
 * @param {Object} params
 * @param {'plan_upgrade'|'addon_purchase'} params.type
 * @param {Number} [params.oldBasePrice] - required for type: 'plan_upgrade'
 * @param {Number} [params.newBasePrice] - required for type: 'plan_upgrade'
 * @param {Number} [params.quantity] - required for type: 'addon_purchase'
 * @param {Number} [params.pricePerUnit] - required for type: 'addon_purchase'
 * @param {Date} params.currentPeriodStart
 * @param {Date} params.currentPeriodEnd
 * @returns {{amount: Number, lines: Array}} amount is always positive — the
 *   caller decides sign/meaning (a credit vs. an additional charge) via how
 *   it's folded into basePriceOverride; this function itself never guesses.
 */
function calculateCommercialAdjustments(params = {}) {
  const { type, oldBasePrice, newBasePrice, quantity, pricePerUnit, currentPeriodStart, currentPeriodEnd } = params;

  // Billing period is a fundamental invariant every proration calculation
  // depends on. Without this guard, a missing currentPeriodStart/End (e.g. a
  // CAW subscription whose activation never initialized it) produces
  // Invalid Date -> NaN silently: `NaN <= 0` is false, so
  // calculatePlanUpgradeProration()/calculateAddonProration()'s own zero-
  // guards never trigger, and NaN flows all the way to a real Razorpay
  // order-create call, surfacing as a misleading "amount is required" error
  // far from its actual cause. Fail loudly here instead.
  if (!currentPeriodStart || !currentPeriodEnd || Number.isNaN(new Date(currentPeriodStart).getTime()) || Number.isNaN(new Date(currentPeriodEnd).getTime())) {
    throw new Error('calculateCommercialAdjustments: subscription billing period not initialized (currentPeriodStart/currentPeriodEnd missing or invalid)');
  }

  let amount;
  let key;
  if (type === 'plan_upgrade') {
    amount = calculatePlanUpgradeProration(oldBasePrice, newBasePrice, currentPeriodStart, currentPeriodEnd);
    key = 'plan_upgrade_proration';
  } else if (type === 'addon_purchase') {
    amount = calculateAddonProration(quantity, pricePerUnit, currentPeriodStart, currentPeriodEnd);
    key = 'addon_purchase_proration';
  } else {
    throw new Error(`calculateCommercialAdjustments: unknown type "${type}"`);
  }

  return {
    amount,
    lines: [{ type: 'commercial_adjustment', key, amount }],
  };
}

/**
 * @param {Object} params
 * @param {Object} params.subscription - a Subscription document (or plain
 *   object with the same shape): { planName, billingCycle, pricePerUser,
 *   activeAddons }. Only fields already present on the subscription are
 *   read — no DB lookup for the plan's live price, so a renewal reprices
 *   exactly what the customer is actually on, not whatever PlanConfig says
 *   today.
 * @param {Date} [params.asOf] - reserved for future proration/coupon-validity
 *   use; not read internally yet (proration is a later phase).
 * @param {Object} [params.changeset] - override `pricePerUser` and/or
 *   `activeAddons` to price a hypothetical change (upgrade/downgrade/add-on
 *   preview) WITHOUT mutating the subscription.
 * @param {Array} [params.resolvedModifiers] - an already-resolved Modifier[]
 *   (coupon/referral), exactly like buildPricingSnapshot's `modifiers` param.
 *   Eligibility/DB resolution is the caller's job, not this function's.
 * @param {Object} [params.adjustmentContext] - Stage 5 input, optional. When
 *   present, calculateCommercialAdjustments() runs internally (the engine
 *   decides to invoke Stage 5, not the caller — Option C'', design note §6)
 *   and its amount is folded into the same basePriceOverride seam that
 *   modifiers (Stage 6/7) apply against, so discounts correctly apply to the
 *   POST-adjustment amount (§3.3: "discounting against the pre-proration
 *   list price would discount value the customer never owed"). Absent for
 *   signup/renewal — those callers simply never pass this field, no
 *   eventType dispatch, no always-null parameters (design note §6/§7).
 * @returns {InvoiceBreakdown} { basePrice, seatPrice, addonPrice, subtotal,
 *   discount, taxable, gst, total, lines[], generatedAt }
 */
function calculateInvoice({ subscription, asOf, changeset = {}, resolvedModifiers = [], adjustmentContext } = {}) {
  if (!subscription) throw new Error('calculateInvoice: subscription is required');

  const pricePerUser = changeset.pricePerUser ?? subscription.pricePerUser;
  const activeAddons = changeset.activeAddons ?? subscription.activeAddons ?? [];
  const billingCycle = changeset.billingCycle ?? subscription.billingCycle;

  if (pricePerUser == null) {
    throw new Error('calculateInvoice: pricePerUser is required (on subscription or changeset)');
  }

  const seatAddons = activeAddons.filter((a) => a.addonKey === SEAT_ADDON_KEY);
  const nonSeatAddons = activeAddons.filter((a) => a.addonKey !== SEAT_ADDON_KEY);
  const seatPrice = seatAddons.reduce((sum, a) => sum + a.quantity * a.pricePerUnit, 0);
  const seatQuantity = seatAddons.reduce((sum, a) => sum + a.quantity, 0);

  // Stage 5, only when the caller supplies adjustmentContext. Engine decides
  // to invoke it, not the caller (Option C'') — signup/renewal never pass
  // this field and never carry a Stage 5 branch of their own.
  //
  // SIGN CONVENTION, verified against real code, not assumed (an equivalence
  // test against today's manual computation initially caught this wrong —
  // see item 5a's implementation notes): calculatePlanUpgradeProration()/
  // calculateAddonProration() return a POSITIVE net amount already owed
  // right now (the customer paying MORE for a better plan/more add-on
  // units) — this is NOT §3.3's "Unused Starter Plan Credit" framing (a
  // deduction against a separately-itemized full new-plan charge). Today's
  // proration functions already net the two together into one delta, so the
  // adjustment amount is ADDED to the base, not subtracted. For the one-time
  // upgrade/add-on charge itself, callers pass `pricePerUser: 0` in
  // `changeset` (there is no separately-billed recurring line in that same
  // invoice) — `adjustmentAmount` becomes the entire billable base.
  const adjustment = adjustmentContext ? calculateCommercialAdjustments(adjustmentContext) : null;
  const adjustmentAmount = adjustment ? adjustment.amount : 0;

  // Reuse the existing, already-tested engine — this function does not
  // reimplement subtotal/discount/GST math. Stage 5's amount is folded in
  // HERE, before modifiers (Stage 6/7) run inside buildPricingSnapshot — the
  // only place that actually enforces "adjustment before discount"
  // mathematically, since buildPricingSnapshot's modifiers apply against
  // `subtotal`, not against the display `lines` array below (verified
  // against real code, PHASE3_DESIGN_NOTE_INVOICE_ENGINE.md §7.1/§7.2).
  const effectiveBase = pricePerUser + seatPrice + adjustmentAmount;

  const snapshot = buildPricingSnapshot({
    plan: { planId: subscription.planName },
    billingCycle,
    activeAddons: nonSeatAddons,
    basePriceOverride: effectiveBase, // pricePerUser + seats + Stage 5 adjustment (added, not subtracted — see note above), broken out below for transparency
    modifiers: resolvedModifiers,
  });

  const lines = [
    { type: 'plan', key: subscription.planName, amount: pricePerUser },
    ...(seatAddons.length ? [{ type: 'seats', key: SEAT_ADDON_KEY, amount: seatPrice, quantity: seatQuantity }] : []),
    ...snapshot.addonBreakdown.map((a) => ({ type: 'addon', key: a.addonKey, amount: a.lineTotal, quantity: a.quantity })),
    ...(adjustment ? adjustment.lines : []), // positive — the net prorated charge already owed, not a credit (see the sign-convention note above)
    ...(snapshot.discount > 0 ? [{ type: 'discount', key: 'modifiers', amount: -snapshot.discount }] : []),
    { type: 'tax', key: 'gst', amount: snapshot.gst },
  ];

  return {
    basePrice: pricePerUser,
    seatPrice,
    addonPrice: snapshot.addonsTotal, // non-seat add-ons only; seats broken out above
    adjustment: adjustmentAmount || undefined, // Stage 5 amount, only present when adjustmentContext was passed
    subtotal: snapshot.subtotal,
    discount: snapshot.discount, // TOTAL across all modifiers (coupon + referral combined) — see modifierBreakdown for per-source amounts
    // Per-modifier-type breakdown, already computed internally by
    // buildPricingSnapshot but not previously surfaced here — needed so
    // callers can report "coupon saved you X, referral saved you Y"
    // separately instead of one combined (and, per a real UI bug found
    // after Brief 1/Brief 2, misleadingly-labeled) number.
    modifierBreakdown: snapshot.modifierBreakdown,
    taxable: snapshot.totalAmount, // post-discount, pre-GST
    gst: snapshot.gst,
    total: snapshot.grandTotal,
    lines,
    generatedAt: snapshot.generatedAt,
  };
}

module.exports = { calculateInvoice, calculateCommercialAdjustments, SEAT_ADDON_KEY };
