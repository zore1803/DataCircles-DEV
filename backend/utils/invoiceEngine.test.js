// utils/invoiceEngine.test.js
//
// Dependency-free unit tests for calculateInvoice() — no test framework is
// installed in this repo yet, and adding one is out of scope for "create the
// engine and unit-test it" (Phase 4). Run with: node utils/invoiceEngine.test.js
// Exits non-zero on any failure.

const assert = require('node:assert/strict');
const { calculateInvoice, SEAT_ADDON_KEY } = require('./invoiceEngine');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    console.error(`  FAIL - ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('calculateInvoice()');

test('plan only, no addons, no discount — GST computed correctly', () => {
  const subscription = { planName: 'starter', billingCycle: 'monthly', pricePerUser: 250, activeAddons: [] };
  const invoice = calculateInvoice({ subscription });
  assert.equal(invoice.basePrice, 250);
  assert.equal(invoice.seatPrice, 0);
  assert.equal(invoice.addonPrice, 0);
  assert.equal(invoice.subtotal, 250);
  assert.equal(invoice.discount, 0);
  assert.equal(invoice.taxable, 250);
  assert.equal(invoice.gst, Math.round(250 * 0.18));
  assert.equal(invoice.total, 250 + Math.round(250 * 0.18));
  assert.equal(invoice.lines.length, 2); // plan + tax
});

test('non-seat add-ons are summed into addonPrice and the subtotal', () => {
  const subscription = {
    planName: 'growth', billingCycle: 'monthly', pricePerUser: 450,
    activeAddons: [{ addonKey: 'custom_domain', quantity: 1, pricePerUnit: 100 }],
  };
  const invoice = calculateInvoice({ subscription });
  assert.equal(invoice.addonPrice, 100);
  assert.equal(invoice.seatPrice, 0);
  assert.equal(invoice.subtotal, 550);
  assert.ok(invoice.lines.some((l) => l.type === 'addon' && l.key === 'custom_domain'));
});

test('extra_seat add-ons are broken out as seatPrice, not double-counted in addonPrice', () => {
  const subscription = {
    planName: 'growth', billingCycle: 'monthly', pricePerUser: 450,
    activeAddons: [
      { addonKey: SEAT_ADDON_KEY, quantity: 3, pricePerUnit: 50 },
      { addonKey: 'custom_domain', quantity: 1, pricePerUnit: 100 },
    ],
  };
  const invoice = calculateInvoice({ subscription });
  assert.equal(invoice.seatPrice, 150); // 3 * 50
  assert.equal(invoice.addonPrice, 100); // custom_domain only — seats excluded
  assert.equal(invoice.subtotal, 450 + 150 + 100); // base + seats + addon
  const seatLine = invoice.lines.find((l) => l.type === 'seats');
  assert.equal(seatLine.amount, 150);
  assert.equal(seatLine.quantity, 3);
});

test('a resolved modifier (e.g. coupon) discounts the subtotal before GST', () => {
  const subscription = { planName: 'starter', billingCycle: 'monthly', pricePerUser: 250, activeAddons: [] };
  const modifiers = [{ type: 'coupon', value: { kind: 'fixed', amount: 50 }, appliesTo: 'entire_invoice' }];
  const invoice = calculateInvoice({ subscription, resolvedModifiers: modifiers });
  assert.equal(invoice.discount, 50);
  assert.equal(invoice.taxable, 200);
  assert.equal(invoice.gst, Math.round(200 * 0.18));
  assert.ok(invoice.lines.some((l) => l.type === 'discount' && l.amount === -50));
});

test('a percentage modifier is capped by maxAmount', () => {
  const subscription = { planName: 'business', billingCycle: 'monthly', pricePerUser: 650, activeAddons: [] };
  const modifiers = [{ type: 'coupon', value: { kind: 'percentage', amount: 50, maxAmount: 100 }, appliesTo: 'entire_invoice' }];
  const invoice = calculateInvoice({ subscription, resolvedModifiers: modifiers });
  // 50% of 650 = 325, but capped at 100
  assert.equal(invoice.discount, 100);
  assert.equal(invoice.taxable, 550);
});

test('changeset overrides pricePerUser/activeAddons WITHOUT mutating the input subscription (upgrade preview)', () => {
  const subscription = { planName: 'starter', billingCycle: 'monthly', pricePerUser: 250, activeAddons: [] };
  const preview = calculateInvoice({ subscription, changeset: { pricePerUser: 450 } });
  assert.equal(preview.basePrice, 450);
  // original object must be untouched
  assert.equal(subscription.pricePerUser, 250);
});

test('changeset can override billingCycle too', () => {
  const subscription = { planName: 'starter', billingCycle: 'monthly', pricePerUser: 250, activeAddons: [] };
  const invoice = calculateInvoice({ subscription, changeset: { billingCycle: 'yearly' } });
  assert.equal(invoice.basePrice, 250); // pricePerUser not overridden here, only cycle label
});

test('multiple modifiers apply in order, each against the already-discounted running total', () => {
  const subscription = { planName: 'growth', billingCycle: 'monthly', pricePerUser: 450, activeAddons: [] };
  const modifiers = [
    { type: 'referral', value: { kind: 'fixed', amount: 50 }, appliesTo: 'entire_invoice' },
    { type: 'coupon', value: { kind: 'percentage', amount: 10 }, appliesTo: 'entire_invoice' },
  ];
  const invoice = calculateInvoice({ subscription, resolvedModifiers: modifiers });
  // 450 - 50 = 400; 10% of 400 = 40; total discount = 90
  assert.equal(invoice.discount, 90);
  assert.equal(invoice.taxable, 360);
});

test('throws a clear error when pricePerUser is missing from both subscription and changeset', () => {
  assert.throws(
    () => calculateInvoice({ subscription: { planName: 'starter', billingCycle: 'monthly', activeAddons: [] } }),
    /pricePerUser is required/
  );
});

test('throws a clear error when subscription is missing entirely', () => {
  assert.throws(() => calculateInvoice({}), /subscription is required/);
});

test('missing activeAddons on the subscription defaults to none (no addon/seat lines)', () => {
  const subscription = { planName: 'starter', billingCycle: 'monthly', pricePerUser: 250 };
  const invoice = calculateInvoice({ subscription });
  assert.equal(invoice.seatPrice, 0);
  assert.equal(invoice.addonPrice, 0);
});

console.log(`\n${passed} passed`);
if (process.exitCode) {
  console.error('SOME TESTS FAILED');
} else {
  console.log('ALL TESTS PASSED');
}
