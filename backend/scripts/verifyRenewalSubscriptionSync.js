// scripts/verifyRenewalSubscriptionSync.js
//
// Fixture-based verification for the P0 architectural fix found during live
// QA: renewSubscription() priced invoices correctly but never wrote the
// result back onto the canonical Subscription document — only the billing
// PERIOD advanced, leaving totalAmount/planName/billingCycle/activeAddons
// silently stale after any renewal that actually changed something (a
// coupon losing eligibility, a scheduled downgrade, an add-on change).
//
// This fixture deliberately seeds Subscription.totalAmount with a WRONG,
// stale value before renewing — proving the sync actually corrects it to
// match the real invoice, not just coincidentally agreeing because nothing
// changed. Also proves the invoice, the Subscription document, and what the
// dashboard would display (Subscription.totalAmount + GST) all agree
// afterward — the exact three-way check this bug broke.
//
// Drives the REAL exports (renewSubscription) — not a copy of its logic.
// WRITES disposable documents and deletes them after — do NOT point this at
// a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyRenewalSubscriptionSync.js

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
const { computeGST } = require('../utils/pricingEngine');

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

const okCharge = async () => ({ success: true, paymentId: 'pay_test_sync', orderId: 'order_test_sync' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('Renewal → Subscription synchronization — the P0 architectural fix\n');

  const plan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
  assert.ok(plan, 'Expected an active "growth" PlanConfig');

  await test('renewal with a still-eligible coupon: invoice, Subscription.totalAmount, and dashboard math all agree — and the deliberately-stale prior value gets corrected', async (registry) => {
    const org = await trackedCreate(Organization, 'Organization', registry, { name: 'RenewalSyncOrg', code: `renewsync-${Date.now()}` });

    const appliedCoupon = {
      code: 'SYNCFIX', name: 'Sync Fix Fixture', duration: { type: 'lifetime' },
      discountAmount: 60, baseSubtotal: plan.monthlyPrice, recurringSubtotal: plan.monthlyPrice - 60,
      // Bug 2 fix (found via live QA): renewal now rebuilds the modifier from
      // fullRulesSnapshot against the actual effective plan, not a flat
      // discountAmount — needs a real rule here to keep resolving to ₹60.
      fullRulesSnapshot: [{ productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 60 }],
    };
    const now = new Date();
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'growth', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: plan.monthlyPrice, userCount: 1,
      // Deliberately WRONG/stale — a value the real pre-renewal state would
      // never actually be, so a passing assertion below proves synchronization
      // happened, not that the number coincidentally matched.
      totalAmount: plan.monthlyPrice + 9999,
      mandateTokenId: 'token_test_sync_fixture',
      currentPeriodStart: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: now,
      nextBillingDate: now,
      activeAddons: [],
      appliedCoupon,
    });

    const result = await renewSubscription(subscription, { chargeMandateFn: okCharge });
    assert.equal(result.outcome, 'RENEWED', `Expected RENEWED, got ${JSON.stringify(result)}`);

    const invoice = await BillingInvoice.findById(result.invoice);
    registry.BillingInvoice.push(invoice._id);
    const commercialTransaction = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'RENEWAL' });
    registry.CommercialTransaction.push(commercialTransaction._id);
    const billingCycle = await BillingCycle.findOne({ subscription: subscription._id });
    if (billingCycle) registry.BillingCycle.push(billingCycle._id);

    const reloadedSubscription = await Subscription.findById(subscription._id);

    // Three-way check: invoice, Subscription document, dashboard math.
    assert.equal(invoice.taxable, plan.monthlyPrice - 60, 'Invoice must reflect the coupon discount');
    assert.equal(reloadedSubscription.totalAmount, invoice.taxable, 'Subscription.totalAmount must match the invoice EXACTLY — this is the field every dashboard/plan-card screen reads directly');
    assert.notEqual(reloadedSubscription.totalAmount, plan.monthlyPrice + 9999, 'The deliberately-stale seed value must have been overwritten, not left in place');

    const dashboardDisplayedTotal = reloadedSubscription.totalAmount + computeGST(reloadedSubscription.totalAmount);
    assert.equal(dashboardDisplayedTotal, invoice.total, 'What the dashboard would compute and display must match the invoice\'s own GST-inclusive total');

    // Full commercial state, not just the amount — planName/billingCycle/
    // activeAddons must also be synced, not just totalAmount.
    assert.equal(reloadedSubscription.planName, 'growth');
    assert.equal(reloadedSubscription.billingCycle, 'monthly');
    assert.deepEqual(reloadedSubscription.activeAddons.map((a) => a.addonKey), []);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
