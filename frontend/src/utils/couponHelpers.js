// utils/couponHelpers.js
//
// Frontend mirror of backend utils/discountEngine.priceLineItems, so the plans
// page and checkout can show per-product discounts using the coupon's `rules`
// without a round-trip per card. The backend still re-prices and enforces at
// redemption time — this is display only.

export const ruleForProduct = (rules, productType, productKey) =>
  (rules || []).find((r) => r.productType === productType && r.productKey === productKey);

// Discount in rupees for a single line-item amount against its matching rule.
export const discountForItem = (rule, amount) => {
  if (!rule || amount <= 0) return 0;
  const raw = rule.discountType === "percentage"
    ? Math.round((amount * rule.discountValue) / 100)
    : rule.discountValue;
  return Math.min(raw, amount); // never discount below zero
};

// Prices a set of { key, type, amount } line items with the given rules.
// Returns { lineItems: [...with discount/finalAmount], totalDiscount }.
export const priceLineItemsWithCoupon = (rules, lineItems) => {
  let totalDiscount = 0;
  const priced = (lineItems || []).map((item) => {
    const rule = ruleForProduct(rules, item.type, item.key);
    const discount = discountForItem(rule, item.amount);
    if (discount > 0) totalDiscount += discount;
    return {
      ...item,
      discount,
      finalAmount: item.amount - discount,
      discountType: rule?.discountType,
      discountValue: rule?.discountValue,
    };
  });
  return { lineItems: priced, totalDiscount };
};
