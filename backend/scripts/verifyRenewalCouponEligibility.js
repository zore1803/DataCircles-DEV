// scripts/verifyRenewalCouponEligibility.js
//
// Fixture-based verification for R7 (§3.6a, Chapter 19 C2/C4, Chapter 17) —
// coupon revalidation at renewal via utils/couponRenewalEligibility.js.
// Since first_payment/fixed_cycles/until_date cannot be created through the
// real coupon-creation validation path (couponController.js's
// ENFORCEABLE_DURATIONS rejects them), this fixture constructs the
// appliedCoupon snapshot directly on a fixture Subscription document — same
// pattern already used elsewhere in this project when exercising a
// not-yet-fully-wired path. WRITES disposable documents and deletes them
// after each fixture — do NOT point this at a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyRenewalCouponEligibility.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const CommercialTransaction = require('../models/CommercialTransaction');
const BillingInvoice = require('../models/BillingInvoice');
const BillingCycle = require('../models/BillingCycle');
const { renewSubscription } = require('../utils/renewalEngine');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], Subscription: [], CommercialTransaction: [], BillingInvoice: [], BillingCycle: [] };
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
  await BillingCycle.deleteMany({ _id: { $in: registry.BillingCycle } });
  await BillingInvoice.deleteMany({ _id: { $in: registry.BillingInvoice } });
  await CommercialTransaction.deleteMany({ _id: { $in: registry.CommercialTransaction } });
  await Subscription.deleteMany({ _id: { $in: registry.Subscription } });
  await Organization.deleteMany({ _id: { $in: registry.Organization } });
}

async function trackedCreate(Model, key, registry, doc) {
  const created = await Model.create(doc);
  registry[key].push(created._id);
  return created;
}

function baseSubscriptionFields(organization, plan, appliedCoupon, overrides = {}) {
  const now = new Date();
  const periodEnd = new Date(now);
  return {
    organization,
    planName: 'growth',
    appStatus: 'active',
    billingCycle: 'monthly',
    pricePerUser: plan.monthlyPrice,
    userCount: 1,
    totalAmount: plan.monthlyPrice,
    mandateTokenId: 'token_test_r7_fixture',
    currentPeriodStart: new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: periodEnd,
    nextBillingDate: periodEnd,
    activeAddons: [],
    appliedCoupon,
    ...overrides,
  };
}

const okCharge = async () => ({ success: true, paymentId: 'pay_test_r7', orderId: 'order_test_r7' });

async function runCase({ registry, plan, org, durationType, expectDiscount }) {
  const appliedCoupon = {
    code: `TEST-${durationType.toUpperCase()}`,
    name: `Test ${durationType} coupon`,
    duration: { type: durationType, cycles: durationType === 'fixed_cycles' ? 3 : undefined },
    discountAmount: 60,
    baseSubtotal: plan.monthlyPrice,
    recurringSubtotal: plan.monthlyPrice - 60,
    // Renewal now rebuilds the modifier from fullRulesSnapshot against the
    // actual effective line items (Bug 2 fix) rather than reusing this flat
    // discountAmount directly — this must resolve to the same ₹60 so the
    // existing assertions below stay meaningful.
    fullRulesSnapshot: [
      { productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 60 },
    ],
  };
  const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(org._id, plan, appliedCoupon));

  const result = await renewSubscription(subscription, { chargeMandateFn: okCharge });
  assert.equal(result.outcome, 'RENEWED', `[${durationType}] Expected RENEWED, got ${JSON.stringify(result)}`);

  const invoice = await BillingInvoice.findById(result.invoice);
  registry.BillingInvoice.push(invoice._id);

  const commercialTransaction = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'RENEWAL' });
  registry.CommercialTransaction.push(commercialTransaction._id);

  const billingCycle = await BillingCycle.findOne({ subscription: subscription._id });
  if (billingCycle) registry.BillingCycle.push(billingCycle._id);

  if (expectDiscount) {
    assert.equal(invoice.discount, 60, `[${durationType}] Expected the coupon discount to apply (discount=60), got ${invoice.discount}`);
    assert.equal(invoice.taxable, plan.monthlyPrice - 60, `[${durationType}] Taxable amount must reflect the applied discount`);
  } else {
    assert.equal(invoice.discount, 0, `[${durationType}] Expected the coupon to be EXCLUDED at renewal (discount=0), got ${invoice.discount}`);
    assert.equal(invoice.taxable, plan.monthlyPrice, `[${durationType}] Taxable amount must be full price — coupon must not silently apply`);
  }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('R7 — coupon revalidation at renewal\n');

  const plan = await (async () => {
    const p = await PlanConfig.findOne({ planId: 'growth', isActive: true });
    if (!p) throw new Error('Expected an active "growth" PlanConfig to already exist in this DB');
    return p;
  })();

  await test('lifetime coupon — still applies at renewal (live production case, must not regress)', async (registry) => {
    const org = await trackedCreate(Organization, 'Organization', registry, { name: 'R7 Lifetime Fixture Org', code: `r7-lifetime-${Date.now()}` });
    await runCase({ registry, plan, org, durationType: 'lifetime', expectDiscount: true });
  });

  await test('until_cancelled coupon — still applies at renewal (live production case, must not regress)', async (registry) => {
    const org = await trackedCreate(Organization, 'Organization', registry, { name: 'R7 UntilCancelled Fixture Org', code: `r7-untilcancelled-${Date.now()}` });
    await runCase({ registry, plan, org, durationType: 'until_cancelled', expectDiscount: true });
  });

  await test('first_payment coupon — excluded at renewal (not creatable today, fixture-constructed to prove future-safety)', async (registry) => {
    const org = await trackedCreate(Organization, 'Organization', registry, { name: 'R7 FirstPayment Fixture Org', code: `r7-firstpayment-${Date.now()}` });
    await runCase({ registry, plan, org, durationType: 'first_payment', expectDiscount: false });
  });

  await test('fixed_cycles coupon — excluded at renewal, fail-closed (no counter exists; not creatable today)', async (registry) => {
    const org = await trackedCreate(Organization, 'Organization', registry, { name: 'R7 FixedCycles Fixture Org', code: `r7-fixedcycles-${Date.now()}` });
    await runCase({ registry, plan, org, durationType: 'fixed_cycles', expectDiscount: false });
  });

  await test('until_date coupon — excluded at renewal, fail-closed (no expiry field on snapshot; not creatable today)', async (registry) => {
    const org = await trackedCreate(Organization, 'Organization', registry, { name: 'R7 UntilDate Fixture Org', code: `r7-untildate-${Date.now()}` });
    await runCase({ registry, plan, org, durationType: 'until_date', expectDiscount: false });
  });

  await test('missing duration (legacy appliedCoupon snapshot predating this field) — fail-closed, not a crash', async (registry) => {
    const org = await trackedCreate(Organization, 'Organization', registry, { name: 'R7 MissingDuration Fixture Org', code: `r7-missing-${Date.now()}` });
    // No `duration` key at all — the real legacy shape this guards against.
    // Mongoose's own enum validator already prevents an INVALID (non-enum)
    // duration.type from ever being persisted, so that's not a reachable
    // state to fixture-test; a genuinely absent `duration` is the real gap.
    const appliedCoupon = {
      code: 'TEST-LEGACY-NO-DURATION',
      name: 'Legacy coupon snapshot with no duration field',
      discountAmount: 60,
      baseSubtotal: plan.monthlyPrice,
      recurringSubtotal: plan.monthlyPrice - 60,
    };
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, baseSubscriptionFields(org._id, plan, appliedCoupon));
    const result = await renewSubscription(subscription, { chargeMandateFn: okCharge });
    assert.equal(result.outcome, 'RENEWED', `Expected RENEWED, got ${JSON.stringify(result)}`);

    const invoice = await BillingInvoice.findById(result.invoice);
    registry.BillingInvoice.push(invoice._id);
    const commercialTransaction = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'RENEWAL' });
    registry.CommercialTransaction.push(commercialTransaction._id);
    const billingCycle = await BillingCycle.findOne({ subscription: subscription._id });
    if (billingCycle) registry.BillingCycle.push(billingCycle._id);

    assert.equal(invoice.discount, 0, 'A coupon snapshot with no duration field must be excluded (fail-closed), not silently applied');
    assert.equal(invoice.taxable, plan.monthlyPrice, 'Taxable amount must be full price');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
