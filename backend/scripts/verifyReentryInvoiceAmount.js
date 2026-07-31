// scripts/verifyReentryInvoiceAmount.js
//
// Fixture-based verification for Bug A (found via live QA — Resume Payment
// opened a Razorpay invoice showing ₹336 instead of ₹396): updateSubscription's
// !isPaymentConfirmed re-entry branch (trial-conversion / plan-change-while-
// pending / Resume Payment all share this branch) was passing
// `firstInvoiceRupees: totalAmount` where `totalAmount = snapshot.taxable`
// (pre-GST) instead of the GST-inclusive `snapshot.total` — silently
// undercharging every Registration Link created through this branch by
// exactly the GST amount. createSubscription's own fresh-signup path never
// had this bug (it correctly uses `invoice.total`); this fixture proves the
// re-entry branch now matches it.
//
// Drives the REAL exports.updateSubscription handler end-to-end, intercepting
// the exact `amount` (paise) Razorpay's createRegistrationLink is called
// with — the actual number that determines what the customer is charged —
// not just re-deriving the expected math independently.
//
// WRITES disposable documents and deletes them after each fixture — do NOT
// point this at a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyReentryInvoiceAmount.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');
const Coupon = require('../models/Coupon');

const razorpayClient = require('../config/razorpay');
razorpayClient.subscriptions = razorpayClient.subscriptions || {};
let lastRegistrationLinkParams = null;
razorpayClient.subscriptions.createRegistrationLink = async (params) => {
  lastRegistrationLinkParams = params;
  return {
    id: `inv_fixture_stub_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    short_url: 'https://rzp.io/rzp/fixture_stub',
    expire_by: Math.floor(Date.now() / 1000) + 86400,
    customer_id: `cust_fixture_stub_${Date.now()}`,
  };
};

const { updateSubscription } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], Coupon: [] };
  try {
    await fn(registry);
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  } finally {
    await cleanup(registry);
  }
}

async function cleanup(registry) {
  await Subscription.deleteMany({ _id: { $in: registry.Subscription } });
  await User.deleteMany({ _id: { $in: registry.User } });
  await Organization.deleteMany({ _id: { $in: registry.Organization } });
  await Coupon.deleteMany({ _id: { $in: registry.Coupon } });
}

async function trackedCreate(Model, key, registry, doc) {
  const created = await Model.create(doc);
  registry[key].push(created._id);
  return created;
}

function mockReqRes(user, body) {
  let statusCode = 200;
  let jsonBody = null;
  const res = { status(code) { statusCode = code; return this; }, json(body) { jsonBody = body; return this; } };
  return { req: { user, body }, res, getResult: () => ({ statusCode, jsonBody }) };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('Bug A — re-entry Registration Link amount must be GST-inclusive, not pre-GST taxable\n');

  const starterPlan = await PlanConfig.findOne({ planId: 'starter', isActive: true });
  const seatAddon = await PlanAddon.findOne({ isActive: true });
  assert.ok(starterPlan && seatAddon, 'Expected an active starter PlanConfig and at least one active PlanAddon');

  await test('trial-conversion re-entry with Starter + seat + coupon: Registration Link amount is the GST-inclusive total (₹396), not the pre-GST taxable (₹336)', async (registry) => {
    const org = await trackedCreate(Organization, 'Organization', registry, { name: 'ReentryAmount Org', code: `reentry-amt-${Date.now()}` });
    const user = await trackedCreate(User, 'User', registry, {
      name: 'ReentryAmount User', email: `reentry-amt-${Date.now()}@example.test`,
      phone: `9${String(Date.now()).slice(-9)}`, organization: org._id, role: 'admin', auth0Id: `reentry-amt-${Date.now()}`,
    });
    const trialSub = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'starter', appStatus: 'trial', status: 'created',
      billingCycle: 'monthly', pricePerUser: starterPlan.monthlyPrice, userCount: 1, totalAmount: 0,
      isPaymentConfirmed: false, paymentStatus: 'pending_payment', isTrialActive: true,
      trialStart: new Date(), trialEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Coupon rule chosen so the math matches the exact reported scenario:
    // ₹250 plan + ₹100 seat = ₹350 subtotal, -₹14 coupon (4% of 350) = ₹336
    // taxable, +18% GST (₹60.48 -> rounds to ₹60) = ₹396 total.
    const coupon = await trackedCreate(Coupon, 'Coupon', registry, {
      code: `REENTRY-AMT-${Date.now()}`, name: 'Reentry amount fixture', isActive: true,
      scope: { type: 'global' },
      rules: [
        { productType: 'plan', productKey: 'starter', discountType: 'fixed', discountValue: 10 },
        { productType: 'addon', productKey: seatAddon.key, discountType: 'fixed', discountValue: 4 },
      ],
      duration: { type: 'until_cancelled' },
    });

    lastRegistrationLinkParams = null;
    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id, name: user.name, email: user.email, phone: user.phone }, {
      planId: 'starter', billingCycle: 'monthly', addons: [{ addonKey: seatAddon.key, quantity: 1 }], couponCode: coupon.code,
    });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected conversion to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);

    assert.ok(lastRegistrationLinkParams, 'Expected createRegistrationLink to have been called');
    const chargedRupees = lastRegistrationLinkParams.amount / 100;

    // Independently derive the expected GST-inclusive total from the same
    // pricing engine, so this fixture doesn't just re-check a hardcoded
    // number if catalog prices ever change.
    const { calculateInvoice } = require('../utils/invoiceEngine');
    const seatUnitPrice = seatAddon.price.monthly;
    const expected = calculateInvoice({
      subscription: { planName: 'starter', billingCycle: 'monthly', pricePerUser: starterPlan.monthlyPrice, activeAddons: [{ addonKey: seatAddon.key, quantity: 1, pricePerUnit: seatUnitPrice }] },
      resolvedModifiers: [{ type: 'coupon', value: { kind: 'fixed', amount: 14 }, appliesTo: 'entire_invoice' }],
    });

    assert.equal(chargedRupees, expected.total, `Registration Link must be created for the GST-inclusive total (₹${expected.total}), got ₹${chargedRupees} — this is exactly the bug: charging the pre-GST taxable amount (₹${expected.taxable}) instead`);
    assert.notEqual(chargedRupees, expected.taxable, 'Sanity check: taxable and total must actually differ in this fixture, or this test proves nothing');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
