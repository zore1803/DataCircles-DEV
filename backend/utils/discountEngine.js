// utils/discountEngine.js
//
// Generic discount evaluation over a checkout's LINE ITEMS. Nothing in here
// knows about "coupons" specifically — it evaluates a discount-rule document
// (today: a Coupon) against a checkout context. Referral rewards / support
// credits / promo campaigns can reuse `evaluateOrderEligibility` + `priceLineItems`
// as-is by feeding in a rule with the same shape.
//
// A "line item" is { key, type: 'plan'|'addon', amount }. Discount lives on
// the PRODUCT RULE, not on the coupon as a whole: for each line item we look
// up a matching rule by (type, key) and apply that rule's own discountType/
// discountValue. No matching rule = no discount for that item — there is no
// coupon-level fallback discount to fall back to.
const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');

function findRule(rule, item) {
  return (rule.rules || []).find((r) => r.productType === item.type && r.productKey === item.key);
}

// Order-level checks: things that make the whole coupon unusable regardless
// of which line items it would otherwise touch (status, dates, org scope,
// billing cycle, usage limits). Per-item pricing is handled separately in
// priceLineItems so a coupon can discount some items and not others.
async function evaluateOrderEligibility(rule, context) {
  const { organizationId, billingCycle } = context;

  if (!rule.isActive) {
    return { valid: false, reason: 'This coupon is no longer active.' };
  }

  const now = new Date();
  if (rule.validity?.startDate && now < new Date(rule.validity.startDate)) {
    return { valid: false, reason: 'This coupon is not yet valid.' };
  }
  if (rule.validity?.expiryDate && now > new Date(rule.validity.expiryDate)) {
    return { valid: false, reason: 'This coupon has expired.' };
  }

  if (rule.scope?.type === 'organizations') {
    const allowed = (rule.scope.organizations || []).map((id) => id.toString());
    if (!allowed.includes(organizationId.toString())) {
      return { valid: false, reason: 'This coupon is not available for your organization.' };
    }
  }

  const cycleRule = rule.eligibility?.billingCycle || 'both';
  if (cycleRule !== 'both' && billingCycle && cycleRule !== billingCycle) {
    return { valid: false, reason: `This coupon only applies to ${cycleRule} billing.` };
  }

  const maxTotal = rule.usageLimits?.maxRedemptions;
  if (maxTotal != null && (rule.analytics?.totalRedemptions || 0) >= maxTotal) {
    return { valid: false, reason: 'This coupon has reached its total usage limit.' };
  }

  const maxPerOrg = rule.usageLimits?.maxRedemptionsPerOrganization;
  if (maxPerOrg != null) {
    const orgRedemptions = await CouponRedemption.countDocuments({
      coupon: rule._id,
      organization: organizationId,
    });
    if (orgRedemptions >= maxPerOrg) {
      return { valid: false, reason: 'You have already used this coupon the maximum number of times.' };
    }
  }

  return { valid: true };
}

// Prices each line item against its own matching product rule, if any.
function priceLineItems(rule, lineItems) {
  let totalDiscount = 0;
  let matchedCount = 0;

  const pricedItems = lineItems.map((item) => {
    const matched = findRule(rule, item);
    if (!matched || item.amount <= 0) {
      return { ...item, discount: 0, finalAmount: item.amount, eligible: !!matched };
    }
    matchedCount += 1;
    let discount = matched.discountType === 'percentage'
      ? Math.round((item.amount * matched.discountValue) / 100)
      : matched.discountValue;
    discount = Math.min(discount, item.amount);
    totalDiscount += discount;
    return { ...item, discount, finalAmount: item.amount - discount, eligible: true, discountType: matched.discountType, discountValue: matched.discountValue };
  });

  return { lineItems: pricedItems, totalDiscount, eligibleCount: matchedCount };
}

// Looks up a coupon by code, checks order-level eligibility, then prices it
// against the given line items. This is the entry point every checkout call
// site should use.
async function validateAndPriceCoupon(code, context) {
  if (!code) return { valid: false, reason: 'No coupon code provided.' };

  const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });
  if (!coupon) {
    return { valid: false, reason: 'Coupon not found.' };
  }

  const orderResult = await evaluateOrderEligibility(coupon, context);
  if (!orderResult.valid) return orderResult;

  const lineItems = context.lineItems || [];
  const priced = priceLineItems(coupon, lineItems);

  if (priced.eligibleCount === 0) {
    return { valid: false, reason: 'This coupon does not apply to any item in your order.' };
  }

  const baseAmount = lineItems.reduce((sum, i) => sum + i.amount, 0);
  return {
    valid: true,
    coupon,
    lineItems: priced.lineItems,
    discountAmount: priced.totalDiscount,
    finalAmount: Math.max(0, baseAmount - priced.totalDiscount),
  };
}

// Persists a redemption record and bumps the coupon's denormalized analytics.
// Called after a checkout using a coupon actually completes (payment
// captured), not at validation time — an abandoned checkout must not consume
// usage limits or count toward analytics.
async function recordRedemption({ coupon, organizationId, subscriptionId, context, baseAmount, discountAmount }) {
  await CouponRedemption.create({
    coupon: coupon._id,
    couponCode: coupon.code,
    organization: organizationId,
    subscription: subscriptionId,
    context,
    baseAmount,
    discountAmount,
    finalAmount: Math.max(0, baseAmount - discountAmount),
  });

  const orgIdStr = organizationId.toString();
  const alreadyCounted = (coupon.analytics.organizationsUsed || []).some((id) => id.toString() === orgIdStr);

  await Coupon.updateOne(
    { _id: coupon._id },
    {
      $inc: {
        'analytics.totalRedemptions': 1,
        'analytics.totalDiscountValue': discountAmount,
        'analytics.revenueInfluenced': baseAmount,
      },
      $set: { 'analytics.lastRedeemedAt': new Date() },
      ...(alreadyCounted ? {} : { $addToSet: { 'analytics.organizationsUsed': organizationId } }),
    }
  );
}

// Builds a 'coupon' Modifier for ONE already-known line item (an add-on
// being purchased, or — once Brief 2 lands — a plan being upgraded to),
// reusing priceLineItems() exactly as signup does, just against a single
// item instead of a full order. Not new matching logic — same primitive,
// a new caller (same shape as R8's reservation reuse).
//
// `fullRulesSnapshot` is appliedCoupon.fullRulesSnapshot (Subscription.js) —
// the coupon's complete rule set at application time, never the live Coupon
// document (immutability principle, same as `duration`). priceLineItems()
// only ever reads `.rules` off whatever's passed in — shape-agnostic,
// confirmed by trace — so wrapping the snapshot array as `{ rules }` is
// sufficient, no live Coupon lookup needed here at all.
//
// Returns a Modifier ({type:'coupon', value:{kind:'fixed', amount}, ...})
// if the item matched a rule, or null if it didn't (CP3's "the discount
// simply stops applying, no error" — a plain no-op, not a thrown error).
function buildCouponModifierForItem(fullRulesSnapshot, item) {
  if (!fullRulesSnapshot || fullRulesSnapshot.length === 0) return null;
  const { lineItems, totalDiscount } = priceLineItems({ rules: fullRulesSnapshot }, [item]);
  const matched = lineItems[0];
  if (!matched.eligible || totalDiscount <= 0) return null;
  return {
    type: 'coupon',
    value: { kind: 'fixed', amount: totalDiscount },
    appliesTo: 'entire_invoice',
  };
}

// Same as buildCouponModifierForItem, but against a LIST of line items —
// used where the "invoice" being priced has more than one item (e.g. plan
// upgrade: old/new plan + carried-forward add-ons). priceLineItems() always
// accepted a list natively; this is just the modifier-shaping wrapper around
// it for a multi-item caller, exactly the same relationship
// buildCouponModifierForItem already has to priceLineItems() for one item.
function buildCouponModifierForLineItems(fullRulesSnapshot, lineItems) {
  if (!fullRulesSnapshot || fullRulesSnapshot.length === 0) return null;
  const { totalDiscount } = priceLineItems({ rules: fullRulesSnapshot }, lineItems);
  if (totalDiscount <= 0) return null;
  return {
    type: 'coupon',
    value: { kind: 'fixed', amount: totalDiscount },
    appliesTo: 'entire_invoice',
  };
}

module.exports = {
  evaluateOrderEligibility,
  findRule,
  priceLineItems,
  validateAndPriceCoupon,
  recordRedemption,
  buildCouponModifierForItem,
  buildCouponModifierForLineItems,
};
