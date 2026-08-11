// scripts/verifyMandateCeilingFlat.js
//
// docs/audit/MANDATE_STRATEGY_AND_ANNUAL_BILLING.md (final): mandate ceiling
// registers at a flat ₹15,000, not firstInvoice × MANDATE_HEADROOM_MULTIPLIER.
// Verifies both independent copies of computeMandateMaxAmountRupees
// (utils/cawAcquisition.js and controllers/subscriptionController.js) —
// they must stay in sync, per the comment cross-referencing them.
//
// Run with: node scripts/verifyMandateCeilingFlat.js (pure function, no DB)

const assert = require('node:assert/strict');
require('dotenv').config();

const { computeMandateMaxAmountRupees: fromCawAcquisition } = require('../utils/cawAcquisition');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok - ${name}`); }
  catch (err) { failed++; console.log(`  FAIL - ${name}: ${err.message}`); }
}

test('cawAcquisition.js: flat ₹15,000 regardless of first-invoice amount (small invoice)', () => {
  assert.equal(fromCawAcquisition(100), 15000);
});

test('cawAcquisition.js: flat ₹15,000 regardless of first-invoice amount (large invoice)', () => {
  assert.equal(fromCawAcquisition(7200), 15000);
});

test('cawAcquisition.js: env override respected (CAW_MANDATE_CEILING_RUPEES)', () => {
  process.env.CAW_MANDATE_CEILING_RUPEES = '20000';
  delete require.cache[require.resolve('../utils/cawAcquisition')];
  const { computeMandateMaxAmountRupees: reloaded } = require('../utils/cawAcquisition');
  assert.equal(reloaded(100), 20000);
  delete process.env.CAW_MANDATE_CEILING_RUPEES;
  delete require.cache[require.resolve('../utils/cawAcquisition')];
});

// subscriptionController.js requires config/razorpay.js at module load, which
// throws without RAZORPAY_KEY_ID configured — its own computeMandateMaxAmountRupees
// isn't separately exported (it's a private module-level function), so this
// checks by SOURCE (confirming the actual formula in the file text) rather
// than by import, since it's not part of that controller's public exports and
// extracting it would require a larger refactor out of scope for this hotfix.
test('subscriptionController.js: duplicated copy uses the same flat-₹15,000 formula, not the superseded multiplier', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(require.resolve('../controllers/subscriptionController.js'), 'utf8');
  const fnMatch = source.match(/function computeMandateMaxAmountRupees\([^)]*\)\s*\{[^}]*\}/);
  assert.ok(fnMatch, 'computeMandateMaxAmountRupees function not found in subscriptionController.js');
  assert.match(fnMatch[0], /MANDATE_CEILING_RUPEES/, 'must reference the flat ceiling constant');
  assert.doesNotMatch(fnMatch[0], /MANDATE_HEADROOM_MULTIPLIER|firstInvoiceRupees\s*\*/, 'must NOT use the superseded multiplier formula');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
