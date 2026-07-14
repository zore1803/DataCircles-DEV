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

// Applies an ordered Modifier[] to a raw rupee amount that ISN'T a full
// plan+add-ons subtotal — e.g. a one-time prorated charge (add-on purchase,
// upgrade proration) where there's no "plan" to build a full snapshot for.
// Same modifier-application logic buildPricingSnapshot uses internally,
// exposed standalone so callers don't need to fake a plan object just to
// discount a bare amount.
function applyModifiers(amount, modifiers = []) {
  let runningTotal = amount;
  const modifierBreakdown = [];
  for (const modifier of modifiers) {
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
// @param modifiers        an ordered Modifier[] from utils/modifierResolver.js
//                         (see backend/docs/PRICING_MODIFIER_ARCHITECTURE.md
//                         §3) — e.g. a referral reward. Applied in array
//                         order (the resolver is responsible for sorting by
//                         priority; this function trusts the order it's given).
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
    allModifiers.unshift({
      type: 'coupon',
      value: { kind: 'fixed', amount: couponDiscount.totalDiscount },
      appliesTo: 'entire_invoice',
    });
  }

  let runningTotal = subtotal;
  const modifierBreakdown = [];
  for (const modifier of allModifiers) {
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
