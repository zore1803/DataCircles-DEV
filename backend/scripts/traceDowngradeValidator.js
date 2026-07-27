// scripts/traceDowngradeValidator.js
//
// Regression fixture for validateSeats/validateDowngrade (utils/downgradeValidator.js).
//
// Run with: CONFIRM_TEST_DB=yes node scripts/traceDowngradeValidator.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const { validateDowngrade, STATUS } = require('../utils/downgradeValidator');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.\n');

  const org = await Organization.create({ name: 'Downgrade Validator Fixture', code: 'val-' + Date.now() });
  const sub = await Subscription.create({
    organization: org._id, planName: 'business', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 650, userCount: 1, totalAmount: 650,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    activeAddons: [],
  });

  const users = [];
  for (let i = 0; i < 5; i++) {
    users.push(await User.create({
      name: `Fixture User ${i}`, organization: org._id,
      auth0Id: `val-fixture-${Date.now()}-${i}`, email: `val-fixture-${Date.now()}-${i}@example.com`,
    }));
  }

  console.log('Fixture: Business, 0 add-ons, 5 users. Target: Growth (includes 3 seats).\n');
  const result = await validateDowngrade(sub, 'growth');
  console.log('Result:', JSON.stringify(result, null, 2));

  console.log('\n--- ASSERTIONS (over limit) ---');
  try {
    assert.equal(result.eligible, false);
    const seatCheck = result.results.find((r) => r.type === 'SEATS');
    assert.equal(seatCheck.status, STATUS.AUTO_FIXABLE);
    assert.equal(seatCheck.current, 5);
    assert.equal(seatCheck.allowed, 3);
    assert.equal(seatCheck.minimumQuantity, 2, '5 users - 3 included = 2 more seats needed');
    assert.ok(seatCheck.requiredAddon, 'must recommend a specific add-on key');
    console.log('ALL ASSERTIONS PASSED (over limit)');
  } catch (e) {
    console.error('ASSERTION FAILED:', e.message);
    process.exitCode = 1;
  }

  // Remove 3 users so occupied (2) <= included (3) -> should PASS.
  await User.deleteMany({ _id: { $in: users.slice(0, 3).map((u) => u._id) } });
  console.log('\nRemoved 3 users (now 2 occupied seats, within Growth\'s included 3).\n');
  const result2 = await validateDowngrade(sub, 'growth');
  console.log('Result:', JSON.stringify(result2, null, 2));

  console.log('\n--- ASSERTIONS (within limit) ---');
  try {
    assert.equal(result2.eligible, true);
    const seatCheck2 = result2.results.find((r) => r.type === 'SEATS');
    assert.equal(seatCheck2.status, STATUS.PASS);
    console.log('ALL ASSERTIONS PASSED (within limit)');
  } catch (e) {
    console.error('ASSERTION FAILED:', e.message);
    process.exitCode = 1;
  }

  await User.deleteMany({ organization: org._id });
  await Subscription.deleteMany({ _id: sub._id });
  await Organization.deleteMany({ _id: org._id });
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('FATAL', e);
  await mongoose.disconnect();
  process.exit(1);
});
