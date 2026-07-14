// utils/pricingSnapshot.js
//
// Single source of GST math for rendering an ALREADY-PURCHASED subscription's
// stored pricing snapshot. Nothing here recalculates a coupon or re-runs the
// discount engine — it only formats numbers that are already persisted on the
// Subscription document (pricePerUser, activeAddons, appliedCoupon,
// totalAmount). Any screen showing "what is this org actually paying" should
// import GST_RATE / computeGST from here rather than hardcoding 0.18, so this
// number can only ever be defined in one place.
export const GST_RATE = 0.18;

export const computeGST = (subtotal) => Math.round(subtotal * GST_RATE);

export const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(price);
