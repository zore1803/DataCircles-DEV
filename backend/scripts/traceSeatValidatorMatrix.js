// scripts/traceSeatValidatorMatrix.js
//
// Test matrix requested in review: Growth (3 included + 1 seat addon =
// capacity 4), downgrading to Starter, varying occupied users 2/3/4/5.
// Expected (Starter included=1 + 1 carried seat = capacity 2):
//   2 users -> PASS
//   3 users -> AUTO_FIXABLE +1
//   4 users -> AUTO_FIXABLE +2
//   5 users -> AUTO_FIXABLE +3
//
// Run with: CONFIRM_TEST_DB=yes node scripts/traceSeatValidatorMatrix.js

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

  const org = await Organization.create({ name: 'Seat Matrix Fixture', code: 'matrix-' + Date.now() });
  const sub = await Subscription.create({
    organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
    billingCycle: 'monthly', pricePerUser: 450, userCount: 1, totalAmount: 550,
    isPaymentConfirmed: true, paymentStatus: 'payment_completed',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    activeAddons: [{ addonKey: 'seat', quantity: 1, pricePerUnit: 100 }],
  });

  const cases = [
    { users: 2, expectedStatus: STATUS.PASS, expectedShortfall: 0 },
    { users: 3, expectedStatus: STATUS.AUTO_FIXABLE, expectedShortfall: 1 },
    { users: 4, expectedStatus: STATUS.AUTO_FIXABLE, expectedShortfall: 2 },
    { users: 5, expectedStatus: STATUS.AUTO_FIXABLE, expectedShortfall: 3 },
  ];

  let passed = 0, failed = 0;
  for (const c of cases) {
    // Reset users to exactly `c.users` for this org.
    await User.deleteMany({ organization: org._id });
    for (let i = 0; i < c.users; i++) {
      await User.create({
        name: `Matrix User ${i}`, organization: org._id,
        auth0Id: `matrix-${Date.now()}-${i}-${c.users}`, email: `matrix-${Date.now()}-${i}-${c.users}@example.com`,
      });
    }

    const result = await validateDowngrade(sub, 'starter');
    const seatCheck = result.results.find((r) => r.type === 'SEATS');
    console.log(`users=${c.users}: status=${seatCheck.status} allowed=${seatCheck.allowed} minimumQuantity=${seatCheck.minimumQuantity ?? 0} (expected status=${c.expectedStatus}, shortfall=${c.expectedShortfall})`);

    try {
      assert.equal(seatCheck.status, c.expectedStatus);
      if (c.expectedStatus === STATUS.AUTO_FIXABLE) {
        assert.equal(seatCheck.minimumQuantity, c.expectedShortfall);
        assert.equal(seatCheck.requiredAddon, 'extra_seat', 'Starter\'s seat addon key is extra_seat (remapped from growth\'s "seat")');
      }
      passed++;
    } catch (e) {
      console.error(`  FAIL: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);

  await User.deleteMany({ organization: org._id });
  await Subscription.deleteMany({ _id: sub._id });
  await Organization.deleteMany({ _id: org._id });
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
})().catch(async (e) => {
  console.error('FATAL', e);
  await mongoose.disconnect();
  process.exit(1);
});
