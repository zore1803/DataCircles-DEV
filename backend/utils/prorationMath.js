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
 *
 * @param {Date|string} [asOfDate] - the instant to price the upgrade AS IF
 *   executed at. Defaults to real wall-clock `new Date()` — every existing
 *   caller (the real upgrade commit path) omits this, so behavior is
 *   unchanged. Added for the Billing Calendar's upgrade-date slider, which
 *   needs "if I upgraded on THIS date instead of right now, what would I
 *   owe" — a hypothetical instant, not the real one.
 */
function calculatePlanUpgradeProration(oldBasePrice, newBasePrice, currentPeriodStart, currentPeriodEnd, asOfDate) {
  const now = asOfDate ? new Date(asOfDate) : new Date();
  const periodStart = new Date(currentPeriodStart);
  const periodEnd = new Date(currentPeriodEnd);

  const totalMs = periodEnd - periodStart;
  const remainingMs = periodEnd - now;
  if (remainingMs <= 0 || totalMs <= 0) return Math.max(1, newBasePrice - oldBasePrice);

  const factor = remainingMs / totalMs;
  const diff = (newBasePrice - oldBasePrice) * factor;
  return Math.max(1, Math.round(diff));
}

// Phase 3 (docs/audit/PHASE3_MONTHLY_TO_ANNUAL_PRORATION.md) — calendar-safe
// month arithmetic for the base-plan entitlement-window model.
//
// Naive `Date.setMonth(d.getMonth() + n)` overflows on day-of-month edges:
// Jan 31 + 1 month becomes Mar 3 (JS rolls the extra 3 days into the next
// month rather than clamping), and a leap-day anchor (Feb 29) + 12 months
// becomes Mar 1 instead of Feb 28. Verified directly (node -e, not assumed)
// before writing this. Clamping to the target month's actual last day is the
// standard fix and what this function does.
function addCalendarMonths(date, months) {
  const d = new Date(date);
  const originalDay = d.getDate();
  d.setDate(1); // avoid overflow while changing month
  d.setMonth(d.getMonth() + months);
  const daysInTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(originalDay, daysInTargetMonth));
  return d;
}

// Critical: window boundaries must be computed as ONE direct jump from the
// anchor (`addCalendarMonths(anchor, 12*k)`), never by chaining smaller
// increments — chaining compounds the clamp error. Verified directly: from
// anchor Jan 31, twelve chained +1-month steps produces Jan 28 the following
// year (wrong — the clamp at Feb 28 permanently loses the 31st), while one
// direct +12-months jump correctly returns Jan 31 (no clamping needed, since
// the target month also has 31 days). getEntitlementWindow below always
// recomputes windowStart/windowEnd from `anchor` with the full offset, never
// by advancing a previous window's boundary forward.
function getEntitlementWindow(anchor, now = new Date()) {
  const anchorDate = new Date(anchor);
  const nowDate = new Date(now);

  // Cheap estimate to avoid iterating from k=0 for a long-lived anchor, then
  // corrected below by direct verification — the estimate is never trusted
  // on its own, since calendar-month arithmetic (day-of-month effects) can
  // put it off by one in either direction.
  let k = Math.floor(
    ((nowDate.getFullYear() - anchorDate.getFullYear()) * 12 + (nowDate.getMonth() - anchorDate.getMonth())) / 12
  );
  let windowStart = addCalendarMonths(anchorDate, 12 * k);
  let windowEnd = addCalendarMonths(anchorDate, 12 * (k + 1));

  // Boundary-inclusive convention (matches this codebase's existing
  // boundary-inclusive rules elsewhere, e.g. BILLING_DOMAIN_SPECIFICATION.md's
  // BT-series): `now` landing exactly on a window's end rolls forward into
  // the NEXT window, never treated as the last instant of the old one.
  let guard = 0;
  while (windowStart > nowDate && guard++ < 1200) {
    k -= 1;
    windowStart = addCalendarMonths(anchorDate, 12 * k);
    windowEnd = addCalendarMonths(anchorDate, 12 * (k + 1));
  }
  guard = 0;
  while (windowEnd <= nowDate && guard++ < 1200) {
    k += 1;
    windowStart = addCalendarMonths(anchorDate, 12 * k);
    windowEnd = addCalendarMonths(anchorDate, 12 * (k + 1));
  }

  return { windowStart, windowEnd };
}

// Hotfix (docs/audit/PHASE3_ENTITLEMENT_WINDOW_SCHEMA_TRACE.md finding #21/#18/#16-17):
// the correct "when does this customer's paid access actually end" answer,
// used by any access-gate/expiry check. NOT part of the Phase 3 schema
// question (no new stored fields) — this derives from the already-immutable
// `billingAnchor` (Phase 1) via `getEntitlementWindow`, exactly as that
// document's storage-recommendation section describes for the
// "derive on-demand" option.
//
// Deliberately branches on billingCycle rather than always computing a
// window: an entitlement WINDOW is a concept that only exists for annual
// billing ("12 months of service, anchor-relative"). A monthly subscriber's
// entitlement IS the rolling current period — there is no separate
// anchor-relative concept to derive for them, so this returns
// `currentPeriodEnd` completely unchanged for every monthly subscription,
// which is also what makes this a byte-for-byte no-op for the monthly case
// that every existing subscription is in today.
//
// Falls back to `currentPeriodEnd` for a yearly subscription with no
// `billingAnchor` recorded (pre-Phase-1 data, or a genuine integrity gap) —
// logs so the gap is visible rather than silently wrong, but never throws or
// blocks access over missing historical data.
function getAccessEntitlementEnd(subscription) {
  if (subscription.billingCycle === 'yearly') {
    if (subscription.billingAnchor) {
      return getEntitlementWindow(subscription.billingAnchor, new Date()).windowEnd;
    }
    console.warn(
      `getAccessEntitlementEnd: yearly subscription ${subscription._id} has no billingAnchor — falling back to currentPeriodEnd, which is NOT the correct entitlement boundary for an annual plan. Investigate why this anchor is missing.`
    );
  }
  return subscription.currentPeriodEnd;
}

/**
 * Amount payable today for a Monthly -> Annual base-plan cadence change,
 * per the entitlement-window model (BILLING_DOMAIN_SPECIFICATION.md's
 * "corrected model" — NOT the superseded §4.1 fresh-contract formula).
 * Pure calculation — does NOT call Razorpay, read the DB, or mutate anything.
 *
 * @param {Number} monthlyBasePrice
 * @param {Number} annualBasePrice
 * @param {Date} anchor - subscription.billingAnchor (Phase 1) — immutable,
 *   set at first-ever payment, NEVER the transition date itself.
 * @param {Date} currentPeriodStart - the CURRENT monthly period's start
 * @param {Date} currentPeriodEnd - the CURRENT monthly period's end
 * @param {Date} [now]
 * @returns {{amount: Number, windowStart: Date, windowEnd: Date, newAnnualValue: Number, unusedMonthlyValue: Number, monthsCompleted: Number, monthsIntoWindow: Number}}
 *   windowStart/windowEnd are the anchor-relative annual window this
 *   transition lands in — the caller uses windowEnd as the new period's end,
 *   NEVER `now + 12 months`. newAnnualValue/unusedMonthlyValue are the two
 *   unrounded intermediate values (before the final Math.round/floor) —
 *   exposed additively for a confirmation UI to explain the arithmetic
 *   (e.g. "Annual remaining value ₹4,800 − Unused monthly value ₹250"),
 *   never recomputed independently by a caller. monthsCompleted/
 *   monthsIntoWindow are informational only (whole-month approximations for
 *   display, e.g. "17 months completed, 5 months into your current window"),
 *   NOT used in the amount calculation itself, which stays on continuous
 *   day-level ms fractions per this file's existing convention.
 */
function calculateMonthlyToAnnualTransition(monthlyBasePrice, annualBasePrice, anchor, currentPeriodStart, currentPeriodEnd, now = new Date()) {
  const { windowStart, windowEnd } = getEntitlementWindow(anchor, now);
  const totalWindowMs = windowEnd - windowStart;
  const remainingWindowMs = windowEnd - now;
  const newAnnualValue = annualBasePrice * (remainingWindowMs / totalWindowMs);

  const periodStart = new Date(currentPeriodStart);
  const periodEnd = new Date(currentPeriodEnd);
  const totalMonthlyMs = periodEnd - periodStart;
  const remainingMonthlyMs = Math.max(0, periodEnd - now);
  const unusedMonthlyValue = totalMonthlyMs > 0 ? monthlyBasePrice * (remainingMonthlyMs / totalMonthlyMs) : 0;

  const amount = Math.max(1, Math.round(newAnnualValue - unusedMonthlyValue));

  // Display-only whole-month approximations (matches the spec's own
  // illustrative "17 months elapsed, 5 into the second window" framing) —
  // derived from the anchor-relative window math already computed above,
  // never a second independent date calculation.
  const anchorDate = new Date(anchor);
  const monthsCompleted = Math.max(0, Math.round((now - anchorDate) / (30.44 * 24 * 60 * 60 * 1000)));
  const monthsIntoWindow = Math.max(0, Math.round((now - windowStart) / (30.44 * 24 * 60 * 60 * 1000)));

  return { amount, windowStart, windowEnd, newAnnualValue, unusedMonthlyValue, monthsCompleted, monthsIntoWindow };
}

module.exports = {
  calculateAddonProration,
  calculatePlanUpgradeProration,
  addCalendarMonths,
  getEntitlementWindow,
  calculateMonthlyToAnnualTransition,
  getAccessEntitlementEnd,
};
