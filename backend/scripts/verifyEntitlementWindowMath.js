// scripts/verifyEntitlementWindowMath.js
//
// Phase 3 (docs/audit/PHASE3_MONTHLY_TO_ANNUAL_PRORATION.md): pure math
// verification for addCalendarMonths/getEntitlementWindow/
// calculateMonthlyToAnnualTransition. No database, no CONFIRM_TEST_DB gate
// needed — these are pure functions.
//
// Run with: node scripts/verifyEntitlementWindowMath.js

const assert = require('node:assert/strict');
const {
  addCalendarMonths,
  getEntitlementWindow,
  calculateMonthlyToAnnualTransition,
} = require('../utils/prorationMath');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}: ${err.message}`); }
}
const iso = (d) => new Date(d).toISOString().slice(0, 10);

// --- addCalendarMonths: day-overflow clamping ---
test('Jan 31 + 1 month clamps to Feb 28 (non-leap)', () => {
  assert.equal(iso(addCalendarMonths('2026-01-31', 1)), '2026-02-28');
});
test('Jan 31 + 12 months returns Jan 31 (target month also has 31 days, no clamp)', () => {
  assert.equal(iso(addCalendarMonths('2026-01-31', 12)), '2027-01-31');
});
test('Feb 29 (leap anchor) + 12 months clamps to Feb 28 (next year not leap)', () => {
  assert.equal(iso(addCalendarMonths('2024-02-29', 12)), '2025-02-28');
});
test('Feb 29 (leap anchor) + 48 months recovers Feb 29 (2028 is leap)', () => {
  assert.equal(iso(addCalendarMonths('2024-02-29', 48)), '2028-02-29');
});
test('Aug 31 + 1 month clamps to Sep 30', () => {
  assert.equal(iso(addCalendarMonths('2026-08-31', 1)), '2026-09-30');
});
test('direct 24-month jump from Jan 31 equals two chained 12-month jumps (both exact multiples, no compounding)', () => {
  const direct = iso(addCalendarMonths('2026-01-31', 24));
  const chained = iso(addCalendarMonths(addCalendarMonths('2026-01-31', 12), 12));
  assert.equal(direct, '2028-01-31');
  assert.equal(chained, '2028-01-31');
});
test('REGRESSION GUARD: chaining by 1-month steps compounds the clamp error — this is why windows must be computed as one direct jump from the anchor, never chained', () => {
  let chained = '2026-01-31';
  for (let i = 0; i < 12; i++) chained = addCalendarMonths(chained, 1);
  assert.equal(iso(chained), '2027-01-28', 'documents the known-wrong chained result — proves why getEntitlementWindow must never chain');
  assert.notEqual(iso(chained), '2027-01-31', 'the correct answer, obtainable only via a direct 12-month jump');
});

// --- getEntitlementWindow: the spec's own worked examples ---
test('3-month example: anchor Jan 17, switch Apr 17 -> window is Jan 17 -> next Jan 17', () => {
  const { windowStart, windowEnd } = getEntitlementWindow('2026-01-17', '2026-04-17');
  assert.equal(iso(windowStart), '2026-01-17');
  assert.equal(iso(windowEnd), '2027-01-17');
});
test('17-month example: window rolls into the SECOND anchor-relative window, still ending on the anchor day', () => {
  const { windowStart, windowEnd } = getEntitlementWindow('2025-01-17', '2026-06-17');
  assert.equal(iso(windowStart), '2026-01-17');
  assert.equal(iso(windowEnd), '2027-01-17');
});
test('switching exactly at the anchor anniversary instant rolls forward into the NEW window (boundary-inclusive convention)', () => {
  const { windowStart, windowEnd } = getEntitlementWindow('2026-01-17', '2027-01-17');
  assert.equal(iso(windowStart), '2027-01-17');
  assert.equal(iso(windowEnd), '2028-01-17');
});
test('leap-day anchor: window correctly clamps and later recovers day 29', () => {
  const early = getEntitlementWindow('2024-02-29', '2025-06-15');
  assert.equal(iso(early.windowStart), '2025-02-28');
  const later = getEntitlementWindow('2024-02-29', '2028-06-15');
  assert.equal(iso(later.windowStart), '2028-02-29');
});
test('day-31 anchor: window boundary stable across a switch in the clamped (28-day) month', () => {
  const { windowStart, windowEnd } = getEntitlementWindow('2026-01-31', '2026-02-15');
  assert.equal(iso(windowStart), '2026-01-31');
  assert.equal(iso(windowEnd), '2027-01-31');
});

// --- calculateMonthlyToAnnualTransition: full formula, matching the spec's own numbers ---
test('clean boundary case: switch exactly on a monthly boundary, no monthly credit needed', () => {
  // Anchor Jan 17, switching Apr 17 exactly when the CURRENT monthly period ENDS
  // (periodEnd === now, so remainingMonthlyMs = 0, no credit) — not when a new
  // one starts (that would still owe the full old-period value as "unused").
  const { amount, windowStart, windowEnd } = calculateMonthlyToAnnualTransition(
    450, 4800,
    '2026-01-17',
    '2026-03-17', '2026-04-17', // current monthly period ENDS exactly at the switch instant
    new Date('2026-04-17')
  );
  assert.equal(iso(windowStart), '2026-01-17');
  assert.equal(iso(windowEnd), '2027-01-17');
  // Close to but NOT exactly 4800*9/12=3600 — that figure is the spec's own
  // illustrative whole-month approximation. This implementation deliberately
  // uses continuous day-level ms fractions (not whole-month counting), per
  // this document's resolution of the spec's acknowledged "day-level
  // rounding rule" gap — so Apr→Jan (9 real months of varying length) will
  // differ slightly from a uniform 9/12 split. Asserting a tight tolerance
  // around the illustrative figure, not exact equality to it.
  assert.ok(Math.abs(amount - 3600) < 50, `expected close to 3600 (day-level precision, not the whole-month approximation), got ${amount}`);
});
test('mid-cycle case: monthly credit reduces the annual charge', () => {
  // Anchor Jan 17. Current monthly period Apr 10 -> May 10, switching May 5 (25 of 30
  // days already elapsed in the monthly period, 5 days unused).
  const { amount } = calculateMonthlyToAnnualTransition(
    300, 3600,
    '2026-01-17',
    '2026-04-10', '2026-05-10',
    new Date('2026-05-05')
  );
  // Window: Jan17->Jan17 next year. now=May5, so remainingWindowMs/totalWindowMs is
  // some fraction < 1 (partway through the window) — just assert the monthly credit
  // actually reduced the amount versus the no-credit baseline.
  const withoutCredit = calculateMonthlyToAnnualTransition(
    0, 3600, '2026-01-17', '2026-04-10', '2026-05-10', new Date('2026-05-05')
  ).amount;
  assert.ok(amount < withoutCredit, 'a positive monthly credit must reduce the payable amount');
});
test('never goes below the ₹1 floor even if annual value is fully consumed by monthly credit', () => {
  const { amount } = calculateMonthlyToAnnualTransition(
    100000, 1, // absurdly large monthly price, tiny annual price
    '2026-01-17',
    '2026-01-01', '2026-02-01',
    new Date('2026-01-02')
  );
  assert.equal(amount, 1);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
