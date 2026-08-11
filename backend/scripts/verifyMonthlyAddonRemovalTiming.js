const assert = require('node:assert/strict');
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'test_key';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test_secret';
const { getAddonRemovalEffectiveAt } = require('../utils/addonManagement');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}:`, err.message);
    process.exitCode = 1;
  }
}

test('monthly add-on on annual base uses its own monthly cadence rather than the base plan period', () => {
  const addedAt = new Date('2026-01-10T12:00:00.000Z');
  const subscription = {
    billingCycle: 'yearly',
    currentPeriodEnd: new Date('2027-01-10T12:00:00.000Z'),
  };
  const addon = {
    addonKey: 'seat',
    billingCycle: 'monthly',
    addedAt,
  };

  const effectiveAt = getAddonRemovalEffectiveAt(addon, subscription);
  const expected = new Date(addedAt);
  expected.setMonth(expected.getMonth() + 1);

  assert.equal(effectiveAt.getTime(), expected.getTime());
});

test('annual add-on keeps its own explicit periodEnd when present', () => {
  const addedAt = new Date('2026-01-10T12:00:00.000Z');
  const periodEnd = new Date('2027-01-10T12:00:00.000Z');
  const subscription = {
    billingCycle: 'yearly',
    currentPeriodEnd: new Date('2027-12-31T23:59:59.999Z'),
  };
  const addon = {
    addonKey: 'seat',
    billingCycle: 'yearly',
    addedAt,
    periodEnd,
  };

  assert.equal(getAddonRemovalEffectiveAt(addon, subscription).getTime(), periodEnd.getTime());
});
