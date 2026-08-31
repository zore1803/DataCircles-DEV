// scripts/verifyUpgradePreviewContract.js
//
// Domain-contract verification for the Billing Calendar's upgrade-date
// slider, BEFORE any frontend projection UI is built (per explicit
// instruction — trace and verify the real billing functions' exact
// semantics first, do not assume). Pure function tests only — calculateInvoice
// has no DB/Razorpay I/O, so this needs no database connection.
//
// Verifies, against the REAL calculateInvoice()/calculateCommercialAdjustments()/
// calculatePlanUpgradeProration() chain (not a reimplementation):
//   1. GST inclusion/exclusion in the returned figures
//   2. Coupon treatment (baked into old/new totals before proration, per
//      the real upgrade branch's own comment)
//   3. Referral treatment (as its own modifier, applied to the one-time
//      upgrade invoice)
//   4. asOfDate semantics at three boundary cases: today (start of period),
//      mid-period, and exactly at currentPeriodEnd
//
// Run with: node scripts/verifyUpgradePreviewContract.js

const assert = require('node:assert/strict');
const { calculateInvoice } = require('../utils/invoiceEngine');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL - ${name}`);
    console.log(`         ${err.message}`);
  }
}

// A Growth-monthly subscription upgrading to Business-monthly, mid-cycle.
// Real figures from PlanConfig-shaped catalog prices (₹450 Growth, ₹650
// Business — matching this app's real seeded plan catalog, not invented).
const PERIOD_START = new Date('2026-08-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-09-01T00:00:00.000Z'); // 31-day period
const OLD_BASE = 450;
const NEW_BASE = 650;

function upgradeInvoiceAt(asOfDate, resolvedModifiers = []) {
  return calculateInvoice({
    subscription: { planName: 'business', billingCycle: 'monthly', pricePerUser: 0, activeAddons: [] },
    changeset: { pricePerUser: 0 },
    asOf: asOfDate,
    adjustmentContext: {
      type: 'plan_upgrade',
      oldBasePrice: OLD_BASE,
      newBasePrice: NEW_BASE,
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
    },
    resolvedModifiers,
  });
}

console.log('=== 1. asOfDate semantics ===');

test('at period start (asOfDate = periodStart): full period remaining, ~full diff prorated', () => {
  const inv = upgradeInvoiceAt(PERIOD_START);
  // factor = remainingMs/totalMs ≈ 1.0 (asOfDate === periodStart means
  // remainingMs === totalMs exactly)
  assert.equal(inv.adjustment, NEW_BASE - OLD_BASE, `expected full diff ${NEW_BASE - OLD_BASE}, got ${inv.adjustment}`);
});

test('mid-period (asOfDate = periodStart + 15 days of 31): ~half the diff prorated', () => {
  const midDate = new Date(PERIOD_START.getTime() + 15 * 24 * 60 * 60 * 1000);
  const inv = upgradeInvoiceAt(midDate);
  const expectedFactor = (PERIOD_END - midDate) / (PERIOD_END - PERIOD_START);
  const expected = Math.max(1, Math.round((NEW_BASE - OLD_BASE) * expectedFactor));
  assert.equal(inv.adjustment, expected, `expected ${expected} (factor ${expectedFactor.toFixed(4)}), got ${inv.adjustment}`);
});

test('exactly at currentPeriodEnd: falls back to FULL undiscounted diff, not ₹0 or a crash', () => {
  const inv = upgradeInvoiceAt(PERIOD_END);
  assert.equal(inv.adjustment, NEW_BASE - OLD_BASE, `expected fallback full diff ${NEW_BASE - OLD_BASE}, got ${inv.adjustment}`);
});

test('one minute AFTER currentPeriodEnd: same fallback behavior (remainingMs negative)', () => {
  const after = new Date(PERIOD_END.getTime() + 60000);
  const inv = upgradeInvoiceAt(after);
  assert.equal(inv.adjustment, NEW_BASE - OLD_BASE);
});

test('omitting asOfDate entirely still works (real wall-clock now) — backward compatibility', () => {
  const inv = upgradeInvoiceAt(undefined);
  // Just confirm it doesn't throw and returns a sane positive number —
  // real "now" is outside this test's fixed period window (Aug 2026),
  // so this exercises the same currentPeriodEnd-passed fallback path.
  assert.ok(inv.adjustment > 0, `expected a positive fallback amount, got ${inv.adjustment}`);
});

console.log('=== 2. GST inclusion ===');

test('taxable is pre-GST, total is GST-inclusive, gst is the difference', () => {
  const inv = upgradeInvoiceAt(PERIOD_START);
  assert.ok(inv.gst > 0, 'expected a nonzero GST amount');
  assert.equal(inv.total, inv.taxable + inv.gst, `total (${inv.total}) should equal taxable (${inv.taxable}) + gst (${inv.gst})`);
  console.log(`         adjustment(pre-discount)=${inv.adjustment} taxable(post-discount,pre-GST)=${inv.taxable} gst=${inv.gst} total(GST-inclusive)=${inv.total}`);
});

console.log('=== 3. Coupon treatment ===');

test('a coupon modifier reduces taxable/total but the adjustment (Stage 5 raw diff) itself is unaffected', () => {
  const withoutCoupon = upgradeInvoiceAt(PERIOD_START);
  // A flat ₹50-off modifier, same shape buildCouponModifierForLineItems produces.
  const couponModifier = { type: 'coupon', value: { kind: 'fixed', amount: 50 }, appliesTo: 'entire_invoice' };
  const withCoupon = upgradeInvoiceAt(PERIOD_START, [couponModifier]);
  assert.equal(withCoupon.adjustment, withoutCoupon.adjustment, 'Stage 5 raw adjustment amount must not itself be discounted — only taxable/total are');
  assert.ok(withCoupon.taxable < withoutCoupon.taxable, `taxable should drop with a coupon applied (${withCoupon.taxable} vs ${withoutCoupon.taxable})`);
  assert.ok(withCoupon.discount > 0, 'expected a nonzero discount field');
  console.log(`         without coupon: taxable=${withoutCoupon.taxable} total=${withoutCoupon.total} | with ₹50 coupon: taxable=${withCoupon.taxable} total=${withCoupon.total} discount=${withCoupon.discount}`);
});

console.log('=== 4. Referral treatment ===');

test('a referral modifier applies the same way a coupon does (separate line, same discount mechanism)', () => {
  const withoutReferral = upgradeInvoiceAt(PERIOD_START);
  const referralModifier = { type: 'referral', value: { kind: 'percentage', amount: 20 }, appliesTo: 'entire_invoice' };
  const withReferral = upgradeInvoiceAt(PERIOD_START, [referralModifier]);
  assert.equal(withReferral.adjustment, withoutReferral.adjustment, 'Stage 5 raw adjustment must not itself be discounted');
  assert.ok(withReferral.taxable < withoutReferral.taxable, 'taxable should drop with a referral discount applied');
  const referralLine = (withReferral.modifierBreakdown || []).find((m) => m.type === 'referral');
  assert.ok(referralLine, 'expected a referral line in modifierBreakdown');
  console.log(`         referral modifierBreakdown: ${JSON.stringify(withReferral.modifierBreakdown)}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
