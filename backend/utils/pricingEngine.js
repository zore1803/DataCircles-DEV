// utils/pricingEngine.js
//
// Single source of truth for "how much should this cost" — see
// backend/docs/ARCHITECTURE.md §4 and backend/docs/PROJECT_STATE.md §9 for
// the design this implements.
//
// Pure function: no I/O, no payment-provider calls, no DB reads. Coupon
// *eligibility* (a DB read — usage-limit counts) must be resolved by the
// caller before calling this; see discountEngine.js's
// evaluateOrderEligibility/validateAndPriceCoupon for that pre-step. This
// module only prices an already-resolved discount.
const GST_RATE = 0.18;

function computeGST(amount) {
  return Math.round(amount * GST_RATE);
}

// Resolves one Modifier's rupee discount against the running subtotal (i.e.
// the subtotal AFTER any higher-priority modifier already applied — this is
// what makes discount order matter and prevents two percentage discounts
// from both being computed off the original, undiscounted subtotal).
function resolveModifierAmount(modifier, runningSubtotal) {
  let amount;
  if (modifier.value.kind === 'percentage') {
    amount = Math.round((runningSubtotal * modifier.value.amount) / 100);
    if (modifier.value.maxAmount != null) {
      amount = Math.min(amount, modifier.value.maxAmount);
    }
  } else {
    amount = modifier.value.amount;
  }
  return Math.max(0, Math.min(amount, runningSubtotal));
}

// Phase 3 item 5b (BILLING_DOMAIN_SPECIFICATION.md §3.3 Stage 6/7 — Coupon
// strictly before Referral, "mathematically required, not a preference"):
// the engine derives ordering from each modifier's OWN `type`, never from a
// caller-supplied `.priority` field or the array order it was handed in.
//
// This was previously enforced only by utils/modifierResolver.js's
// resolveModifiers() sorting its own output by a `priority` field it
// attaches — but that function was never actually called by any production
// code path (confirmed by grep), and real modifier objects are inconsistently
// shaped: some (built via modifierResolver.js's rewardToModifier()) carry
// `priority`, others (built ad hoc inline, e.g. subscriptionController.js's
// coupon literal at createSubscription) don't. Sorting by a caller-supplied
// `.priority` field would silently break — `undefined - 20 = NaN` — the
// moment a coupon and a referral modifier were ever combined in one array,
// which is exactly what stopped being purely hypothetical once Phase 3 item
// 5a's controller migrations started combining modifiers into the same
// resolvedModifiers array. Deriving order from `type` here instead means
// every modifier sorts correctly regardless of what metadata its builder did
// or didn't attach — the engine no longer trusts anything about the caller.
const MODIFIER_STAGE = { coupon: 6, referral: 7 }; // matches Chapter 3.3's own stage numbers

function sortModifiersByStage(modifiers) {
  return [...modifiers].sort((a, b) => (MODIFIER_STAGE[a.type] ?? 99) - (MODIFIER_STAGE[b.type] ?? 99));
}

// Applies an ordered Modifier[] to a raw rupee amount that ISN'T a full
// plan+add-ons subtotal — e.g. a one-time prorated charge (add-on purchase,
// upgrade proration) where there's no "plan" to build a full snapshot for.
// Same modifier-application logic buildPricingSnapshot uses internally,
// exposed standalone so callers don't need to fake a plan object just to
// discount a bare amount. Sorts by stage internally (see MODIFIER_STAGE
// above) — the array's own input order no longer matters.
function applyModifiers(amount, modifiers = []) {
  let runningTotal = amount;
  const modifierBreakdown = [];
  for (const modifier of sortModifiersByStage(modifiers)) {
    const modifierAmount = resolveModifierAmount(modifier, runningTotal);
    runningTotal = Math.max(0, runningTotal - modifierAmount);
    modifierBreakdown.push({ type: modifier.type, referenceId: modifier.referenceId || null, amount: modifierAmount });
  }
  return { totalAmount: runningTotal, discount: amount - runningTotal, modifierBreakdown };
}

// @param plan             { monthlyPrice, yearlyPrice, planId }
// @param billingCycle     'monthly' | 'yearly'
// @param activeAddons     [{ addonKey, quantity, pricePerUnit }] — only the
//                         add-ons actually being billed for this cycle (e.g.
//                         during an upgrade, add-ons kept only until cycle
//                         end are still "active" for entitlement purposes
//                         but shouldn't be passed here — the caller decides
//                         what's billed, the engine just sums what it's given)
// @param couponDiscount   the already-priced result of
//                         discountEngine.priceLineItems (or the compatible
//                         shape from validateAndPriceCoupon), or null/undefined.
//                         Kept for backward compatibility with existing call
//                         sites — internally normalized into the modifiers
//                         pipeline below, so there's exactly one discount
//                         code path, not two.
// @param modifiers        a Modifier[] — e.g. a coupon and/or a referral
//                         reward (see backend/docs/PRICING_MODIFIER_ARCHITECTURE.md
//                         §3). Order in the array does NOT matter — this
//                         function sorts by stage internally (MODIFIER_STAGE
//                         above), deriving Coupon-before-Referral from each
//                         modifier's own `type`, never from caller-supplied
//                         ordering or a `.priority` field (Phase 3 item 5b).
// @param basePriceOverride  use instead of plan.monthlyPrice/yearlyPrice when
//                         a prior step already computed/locked in the base
//                         price (e.g. a scheduled plan change verified against
//                         a specific charged amount) — avoids re-deriving a
//                         number that must match one already paid for.
function buildPricingSnapshot({ plan, billingCycle, activeAddons = [], couponDiscount = null, modifiers = [], basePriceOverride }) {
  const basePrice = basePriceOverride != null
    ? basePriceOverride
    : (billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice);

  const addonBreakdown = activeAddons.map((a) => ({
    addonKey: a.addonKey,
    quantity: a.quantity,
    pricePerUnit: a.pricePerUnit,
    lineTotal: a.quantity * a.pricePerUnit,
  }));
  const addonsTotal = addonBreakdown.reduce((sum, a) => sum + a.lineTotal, 0);

  const subtotal = basePrice + addonsTotal;

  // Normalize the legacy couponDiscount param into the same modifier
  // pipeline `modifiers` uses, so callers that pass either (or both) get
  // identical, single-path discount handling.
  const allModifiers = [...modifiers];
  if (couponDiscount?.totalDiscount) {
    allModifiers.push({
      type: 'coupon',
      value: { kind: 'fixed', amount: couponDiscount.totalDiscount },
      appliesTo: 'entire_invoice',
    });
  }

  // Phase 3 item 5b: sort by stage internally (MODIFIER_STAGE above) rather
  // than trusting array order — the previous `.unshift()` above was itself a
  // manual, caller-side attempt at "coupon first" that this sort now makes
  // unnecessary (kept as `.push()` purely so the array's construction order
  // doesn't matter either; the sort is what actually enforces correctness).
  let runningTotal = subtotal;
  const modifierBreakdown = [];
  for (const modifier of sortModifiersByStage(allModifiers)) {
    const amount = resolveModifierAmount(modifier, runningTotal);
    runningTotal = Math.max(0, runningTotal - amount);
    modifierBreakdown.push({ type: modifier.type, referenceId: modifier.referenceId || null, amount });
  }

  const totalAmount = runningTotal;
  const discount = subtotal - totalAmount;
  const gst = computeGST(totalAmount);
  const grandTotal = totalAmount + gst;

  return {
    plan: plan.planId,
    billingCycle,
    basePrice,
    addonBreakdown,
    addonsTotal,
    subtotal,
    discount, // total across all modifiers — same meaning as before for existing callers
    modifierBreakdown, // per-modifier amount, for invoice transparency (REFERRAL_SYSTEM_DESIGN.md §20)
    totalAmount, // pre-GST, post-discount — same meaning as today's Subscription.totalAmount
    gst,
    grandTotal, // what should actually be charged/recurred, GST-inclusive
    generatedAt: new Date(),
  };
}

module.exports = { GST_RATE, computeGST, buildPricingSnapshot, applyModifiers };
