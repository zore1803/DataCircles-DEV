// scripts/verifyAccessEntitlementEnd.js
//
// Hotfix (docs/audit/PHASE3_ENTITLEMENT_WINDOW_SCHEMA_TRACE.md findings
// #16-18, #21): pure math verification for getAccessEntitlementEnd(), the
// shared helper now used by subscriptionCheck.js, subscriptionLifecycleJobs.js,
// and superAdminController.js's cancellation email. No database needed.
//
// Run with: node scripts/verifyAccessEntitlementEnd.js

const assert = require('node:assert/strict');
const { getAccessEntitlementEnd, getEntitlementWindow } = require('../utils/prorationMath');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}: ${err.message}`); }
}

test('monthly subscription: returns currentPeriodEnd completely unchanged (byte-for-byte, the critical regression guard)', () => {
  const currentPeriodEnd = new Date('2026-08-15T00:00:00.000Z');
  const sub = { billingCycle: 'monthly', billingAnchor: new Date('2026-01-15'), currentPeriodEnd };
  const result = getAccessEntitlementEnd(sub);
  assert.equal(result, currentPeriodEnd, 'must be the exact same value, not a recomputed one');
});

test('monthly subscription with NO billingAnchor: still returns currentPeriodEnd unchanged (monthly never needs an anchor)', () => {
  const currentPeriodEnd = new Date('2026-08-15T00:00:00.000Z');
  const sub = { billingCycle: 'monthly', billingAnchor: null, currentPeriodEnd };
  assert.equal(getAccessEntitlementEnd(sub), currentPeriodEnd);
});

test('yearly subscription: returns the anchor-relative entitlement window end, NOT currentPeriodEnd', () => {
  const currentPeriodEnd = new Date('2026-05-01'); // e.g. a stale/rolling value that doesn't reflect the real annual term
  const anchor = new Date('2026-01-17');
  const sub = { billingCycle: 'yearly', billingAnchor: anchor, currentPeriodEnd };
  const result = getAccessEntitlementEnd(sub);
  const expected = getEntitlementWindow(anchor, new Date()).windowEnd;
  assert.equal(result.getTime(), expected.getTime());
  assert.notEqual(result.getTime(), currentPeriodEnd.getTime(), 'must NOT equal the stale rolling field');
});

test('yearly subscription with NO billingAnchor: falls back to currentPeriodEnd (never crashes, never blocks access over missing historical data)', () => {
  const currentPeriodEnd = new Date('2026-08-15');
  const sub = { _id: 'fake-id', billingCycle: 'yearly', billingAnchor: null, currentPeriodEnd };
  const result = getAccessEntitlementEnd(sub);
  assert.equal(result, currentPeriodEnd);
});

test('THE CORE BUG THIS FIXES: an annual customer whose rolling currentPeriodEnd already passed is still correctly entitled', () => {
  const anchor = new Date('2026-01-17');
  // Rolling field already in the past (simulating whatever a legacy/rolling
  // sync might have left it at) — the OLD code would incorrectly treat this
  // customer as expired.
  const staleCurrentPeriodEnd = new Date('2026-02-01');
  const sub = { billingCycle: 'yearly', billingAnchor: anchor, currentPeriodEnd: staleCurrentPeriodEnd };
  const entitlementEnd = getAccessEntitlementEnd(sub);
  const now = new Date('2026-06-01'); // well past staleCurrentPeriodEnd, well within the real annual window
  assert.ok(now < entitlementEnd, 'the customer must still be considered entitled — real annual window has not ended');
  assert.ok(now > staleCurrentPeriodEnd, 'sanity check: the stale rolling field really has already passed');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
