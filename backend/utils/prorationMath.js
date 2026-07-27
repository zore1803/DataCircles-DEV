// utils/prorationMath.js
//
// The two pure proration functions, extracted from utils/addonManagement.js
// (Phase 3 item 5a) so utils/invoiceEngine.js can reuse them without pulling
// in addonManagement.js's DB models and config/razorpay require — which
// throws at module-load time without Razorpay env vars configured, breaking
// invoiceEngine.js's own documented "pure function, no I/O" contract.
//
// addonManagement.js re-exports both from here unchanged, so its three
// existing callers (subscriptionController.js's upgrade/add-on-purchase
// paths, authController.js's extra-seat purchase) needed zero changes.
// No math changed — this is a location move only.

/**
 * Calculates the prorated charge (in rupees) for adding addon units mid-cycle.
 * Pure calculation — does NOT call Razorpay or mutate anything.
 */
function calculateAddonProration(quantity, pricePerUnit, currentPeriodStart, currentPeriodEnd) {
  const now = new Date();
  const periodStart = new Date(currentPeriodStart);
  const periodEnd = new Date(currentPeriodEnd);
  const totalPeriodMs = periodEnd - periodStart;
  const remainingMs = periodEnd - now;
  if (remainingMs <= 0) return 1; // period already ended — charge minimum
  const prorationFactor = remainingMs / totalPeriodMs;
  const fullCycleCharge = quantity * pricePerUnit;
  return Math.max(1, Math.round(fullCycleCharge * prorationFactor));
}

/**
 * Calculates the prorated charge for the BASE PRICE DIFFERENCE when
 * upgrading plans mid-cycle. Only the difference between new and old
 * base price is prorated (add-ons are separate and untouched).
 * Returns rupees (not paise). Minimum ₹1.
 */
function calculatePlanUpgradeProration(oldBasePrice, newBasePrice, currentPeriodStart, currentPeriodEnd) {
  const now = new Date();
  const periodStart = new Date(currentPeriodStart);
  const periodEnd = new Date(currentPeriodEnd);

  const totalMs = periodEnd - periodStart;
  const remainingMs = periodEnd - now;
  if (remainingMs <= 0 || totalMs <= 0) return Math.max(1, newBasePrice - oldBasePrice);

  const factor = remainingMs / totalMs;
  const diff = (newBasePrice - oldBasePrice) * factor;
  return Math.max(1, Math.round(diff));
}

module.exports = { calculateAddonProration, calculatePlanUpgradeProration };
