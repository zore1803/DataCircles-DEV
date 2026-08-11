// scripts/verifyScheduledChangeDerivedView.js
//
// Regression fixture for getScheduledChanges()'s derived keptAddons/
// removedAddons view (subscriptionController.js). WRITES disposable
// documents and deletes them after — do NOT point this at a production
// database.
//
// Covers the edge case explicitly flagged during review: multiple
// simultaneous REMOVE_ADDON records alongside a PLAN_CHANGE must all
// compose correctly (removedAddons must include EVERY addon with a pending
// removal, not just the first found; keptAddons must exclude all of them).
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyScheduledChangeDerivedView.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const ScheduledChange = require('../models/ScheduledChange');
const { getScheduledChanges } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], Subscription: [], ScheduledChange: [] };
  try {
    await fn(registry);
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  } finally {
    await ScheduledChange.deleteMany({ _id: { $in: registry.ScheduledChange } });
    await Subscription.deleteMany({ _id: { $in: registry.Subscription } });
    await Organization.deleteMany({ _id: { $in: registry.Organization } });
  }
}

function mockReqRes(organizationId) {
  let jsonBody;
  return {
    req: { user: { organization: organizationId } },
    res: { status() { return this; }, json(b) { jsonBody = b; return this; } },
    get: () => jsonBody,
  };
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Running getScheduledChanges derived-view regression fixtures...\n');

  await test('single REMOVE_ADDON: kept = the rest, removed = exactly that one', async (registry) => {
    const org = await Organization.create({ name: 'SC Derived View Fixture 1', code: 'sc-dv1-' + Date.now() });
    registry.Organization.push(org._id);
    const sub = await Subscription.create({
      organization: org._id, planName: 'business', appStatus: 'active', status: 'active',
      billingCycle: 'monthly', pricePerUser: 650, userCount: 1, totalAmount: 900,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      activeAddons: [
        { addonKey: 'crm_records', quantity: 1, pricePerUnit: 100 },
        { addonKey: 'whatsapp', quantity: 1, pricePerUnit: 150 },
      ],
    });
    registry.Subscription.push(sub._id);
    const effectiveAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const sc1 = await ScheduledChange.create({ organization: org._id, subscription: sub._id, type: 'PLAN_CHANGE', status: 'PENDING', effectiveAt, payload: { planId: 'growth', pricePerUser: 450, billingCycle: 'monthly' } });
    registry.ScheduledChange.push(sc1._id);
    const sc2 = await ScheduledChange.create({ organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING', effectiveAt, payload: { addonKey: 'whatsapp', quantity: 1 } });
    registry.ScheduledChange.push(sc2._id);

    const { req, res, get } = mockReqRes(org._id);
    await getScheduledChanges(req, res);
    const body = get();

    assert.equal(body.keptAddons.length, 1);
    assert.equal(body.keptAddons[0].addonKey, 'crm_records');
    assert.equal(body.removedAddons.length, 1);
    assert.equal(body.removedAddons[0].addonKey, 'whatsapp');
  });

  await test('multiple simultaneous REMOVE_ADDON records all compose (the flagged edge case)', async (registry) => {
    const org = await Organization.create({ name: 'SC Derived View Fixture 2', code: 'sc-dv2-' + Date.now() });
    registry.Organization.push(org._id);
    const sub = await Subscription.create({
      organization: org._id, planName: 'business', appStatus: 'active', status: 'active',
      billingCycle: 'monthly', pricePerUser: 650, userCount: 1, totalAmount: 900,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      activeAddons: [
        { addonKey: 'crm_records', quantity: 1, pricePerUnit: 100 },
        { addonKey: 'whatsapp', quantity: 1, pricePerUnit: 150 },
        { addonKey: 'email', quantity: 1, pricePerUnit: 80 },
      ],
    });
    registry.Subscription.push(sub._id);
    const effectiveAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const sc1 = await ScheduledChange.create({ organization: org._id, subscription: sub._id, type: 'PLAN_CHANGE', status: 'PENDING', effectiveAt, payload: { planId: 'growth', pricePerUser: 450, billingCycle: 'monthly' } });
    registry.ScheduledChange.push(sc1._id);
    const sc2 = await ScheduledChange.create({ organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING', effectiveAt, payload: { addonKey: 'whatsapp', quantity: 1 } });
    registry.ScheduledChange.push(sc2._id);
    const sc3 = await ScheduledChange.create({ organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING', effectiveAt, payload: { addonKey: 'email', quantity: 1 } });
    registry.ScheduledChange.push(sc3._id);

    const { req, res, get } = mockReqRes(org._id);
    await getScheduledChanges(req, res);
    const body = get();

    assert.equal(body.scheduledChanges.length, 3);
    assert.equal(body.keptAddons.length, 1, 'exactly one addon should survive both removals');
    assert.equal(body.keptAddons[0].addonKey, 'crm_records');
    const removedKeys = body.removedAddons.map((a) => a.addonKey).sort();
    assert.deepEqual(removedKeys, ['email', 'whatsapp'], 'BOTH removals must be present, not just the first');
  });

  await test('no pending changes: everything kept, nothing removed', async (registry) => {
    const org = await Organization.create({ name: 'SC Derived View Fixture 3', code: 'sc-dv3-' + Date.now() });
    registry.Organization.push(org._id);
    const sub = await Subscription.create({
      organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
      billingCycle: 'monthly', pricePerUser: 450, userCount: 1, totalAmount: 450,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      activeAddons: [{ addonKey: 'crm_records', quantity: 1, pricePerUnit: 100 }],
    });
    registry.Subscription.push(sub._id);

    const { req, res, get } = mockReqRes(org._id);
    await getScheduledChanges(req, res);
    const body = get();

    assert.equal(body.scheduledChanges.length, 0);
    assert.equal(body.keptAddons.length, 1);
    assert.equal(body.removedAddons.length, 0);
  });

  await test('PARTIAL quantity removal: addon survives at reduced quantity, not treated as fully removed', async (registry) => {
    // Regression for a real gap caught during review: the first derivation
    // only checked addonKey membership, which would have wrongly treated
    // ANY scheduled removal as a full removal (quantity add-ons support
    // partial decrements — e.g. remove 1 of 3 seats, per addonManagement.js's
    // incremental payload.quantity merge).
    const org = await Organization.create({ name: 'SC Derived View Fixture 4', code: 'sc-dv4-' + Date.now() });
    registry.Organization.push(org._id);
    const sub = await Subscription.create({
      organization: org._id, planName: 'business', appStatus: 'active', status: 'active',
      billingCycle: 'monthly', pricePerUser: 650, userCount: 1, totalAmount: 900,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      activeAddons: [{ addonKey: 'extra_seat', quantity: 3, pricePerUnit: 50 }],
    });
    registry.Subscription.push(sub._id);
    const effectiveAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const sc = await ScheduledChange.create({ organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING', effectiveAt, payload: { addonKey: 'extra_seat', quantity: 1 } });
    registry.ScheduledChange.push(sc._id);

    const { req, res, get } = mockReqRes(org._id);
    await getScheduledChanges(req, res);
    const body = get();

    assert.equal(body.keptAddons.length, 1, 'the addon must still be present (2 of 3 remain), not excluded entirely');
    assert.equal(body.keptAddons[0].addonKey, 'extra_seat');
    assert.equal(body.keptAddons[0].quantity, 2, 'kept quantity must be residual (3 - 1), not the original 3');
    assert.equal(body.removedAddons.length, 1);
    assert.equal(body.removedAddons[0].quantity, 1, 'removed quantity must be exactly the scheduled amount, not the full original quantity');
  });

  await test('effectiveRecurringTotal: Starter ₹250 + Extra Seat ₹100 = ₹350 current, REMOVE_ADDON(extra_seat) scheduled → ₹250 future (the exact reported scenario)', async (registry) => {
    const org = await Organization.create({ name: 'SC Effective Total Fixture 1', code: 'sc-total1-' + Date.now() });
    registry.Organization.push(org._id);
    const sub = await Subscription.create({
      organization: org._id, planName: 'starter', appStatus: 'active', status: 'active',
      billingCycle: 'monthly', pricePerUser: 250, userCount: 1, totalAmount: 350,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      activeAddons: [{ addonKey: 'extra_seat', quantity: 1, pricePerUnit: 100 }],
    });
    registry.Subscription.push(sub._id);
    const sc = await ScheduledChange.create({
      organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING',
      effectiveAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      payload: { addonKey: 'extra_seat', quantity: 1 },
    });
    registry.ScheduledChange.push(sc._id);

    const { req, res, get } = mockReqRes(org._id);
    await getScheduledChanges(req, res);
    const body = get();

    assert.equal(body.effectiveRecurringTotal, 250, 'future recurring total must be 250 (Starter only), not 350 (current, still including the seat)');
    console.log('effectiveRecurringTotal:', body.effectiveRecurringTotal, '(current totalAmount stays 350 until the removal executes)');
  });

  await test('effectiveRecurringTotal is null when nothing is scheduled (not a duplicate of the current total)', async (registry) => {
    const org = await Organization.create({ name: 'SC Effective Total Fixture 2', code: 'sc-total2-' + Date.now() });
    registry.Organization.push(org._id);
    const sub = await Subscription.create({
      organization: org._id, planName: 'starter', appStatus: 'active', status: 'active',
      billingCycle: 'monthly', pricePerUser: 250, userCount: 1, totalAmount: 250,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      activeAddons: [],
    });
    registry.Subscription.push(sub._id);

    const { req, res, get } = mockReqRes(org._id);
    await getScheduledChanges(req, res);
    const body = get();

    assert.equal(body.effectiveRecurringTotal, null, 'must be null, not 250, when nothing is scheduled');
  });

  await test('effectiveRecurringTotal is null when a CANCELLATION is pending (no future recurring amount)', async (registry) => {
    const org = await Organization.create({ name: 'SC Effective Total Fixture 3', code: 'sc-total3-' + Date.now() });
    registry.Organization.push(org._id);
    const sub = await Subscription.create({
      organization: org._id, planName: 'starter', appStatus: 'active', status: 'active',
      billingCycle: 'monthly', pricePerUser: 250, userCount: 1, totalAmount: 250,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed', cancelAtPeriodEnd: true,
      activeAddons: [],
    });
    registry.Subscription.push(sub._id);
    const sc = await ScheduledChange.create({
      organization: org._id, subscription: sub._id, type: 'CANCELLATION', status: 'PENDING',
      effectiveAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      payload: { cancelAtPeriodEnd: true },
    });
    registry.ScheduledChange.push(sc._id);

    const { req, res, get } = mockReqRes(org._id);
    await getScheduledChanges(req, res);
    const body = get();

    assert.equal(body.effectiveRecurringTotal, null, 'must be null — a cancelled subscription has no future recurring amount to preview');
  });

  await test('effectiveRecurringTotal: coupon covers current plan (Business) but NOT the scheduled target (Growth) — discount must disappear', async (registry) => {
    // Scheduled-change preview coupon-scope fix (found while tracing C1):
    // getScheduledChanges() used to reuse appliedCoupon.discountAmount as a
    // flat, unconditional modifier — never checking whether the coupon's
    // rules actually cover the TARGET plan. This is the exact scenario that
    // exposed it: a coupon scoped to Starter/Business but not Growth, with a
    // scheduled downgrade FROM Business INTO Growth.
    const org = await Organization.create({ name: 'SC Coupon Scope Fixture 1', code: 'sc-coupon1-' + Date.now() });
    registry.Organization.push(org._id);
    const sub = await Subscription.create({
      organization: org._id, planName: 'business', appStatus: 'active', status: 'active',
      billingCycle: 'monthly', pricePerUser: 650, userCount: 1, totalAmount: 637,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed', activeAddons: [],
      appliedCoupon: {
        code: 'SC-SCOPE-1', name: 'Business/Starter-only coupon', duration: { type: 'until_cancelled' },
        discountAmount: 13, baseSubtotal: 650, recurringSubtotal: 637,
        fullRulesSnapshot: [
          { productType: 'plan', productKey: 'starter', discountType: 'percentage', discountValue: 2 },
          { productType: 'plan', productKey: 'business', discountType: 'percentage', discountValue: 2 },
          // Deliberately no rule for 'growth'.
        ],
      },
    });
    registry.Subscription.push(sub._id);
    const sc = await ScheduledChange.create({
      organization: org._id, subscription: sub._id, type: 'PLAN_CHANGE', status: 'PENDING',
      effectiveAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      payload: { planId: 'growth', pricePerUser: 450, billingCycle: 'monthly' },
    });
    registry.ScheduledChange.push(sc._id);

    const { req, res, get } = mockReqRes(org._id);
    await getScheduledChanges(req, res);
    const body = get();

    assert.equal(body.effectiveRecurringTotal, 450, `The coupon has no rule for growth — future total must be the undiscounted ₹450, got ${body.effectiveRecurringTotal} (this is the exact bug: a flat frozen ₹13 was being reused regardless of target plan)`);
  });

  await test('effectiveRecurringTotal: coupon covers BOTH current plan (Business) and scheduled target (Growth), at different rates — must use the TARGET plan\'s own rate', async (registry) => {
    const org = await Organization.create({ name: 'SC Coupon Scope Fixture 2', code: 'sc-coupon2-' + Date.now() });
    registry.Organization.push(org._id);
    const sub = await Subscription.create({
      organization: org._id, planName: 'business', appStatus: 'active', status: 'active',
      billingCycle: 'monthly', pricePerUser: 650, userCount: 1, totalAmount: 637,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed', activeAddons: [],
      appliedCoupon: {
        code: 'SC-SCOPE-2', name: 'Business+Growth coupon, different rates', duration: { type: 'until_cancelled' },
        discountAmount: 13, baseSubtotal: 650, recurringSubtotal: 637,
        fullRulesSnapshot: [
          { productType: 'plan', productKey: 'business', discountType: 'percentage', discountValue: 2 },
          { productType: 'plan', productKey: 'growth', discountType: 'percentage', discountValue: 5 },
        ],
      },
    });
    registry.Subscription.push(sub._id);
    const sc = await ScheduledChange.create({
      organization: org._id, subscription: sub._id, type: 'PLAN_CHANGE', status: 'PENDING',
      effectiveAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      payload: { planId: 'growth', pricePerUser: 450, billingCycle: 'monthly' },
    });
    registry.ScheduledChange.push(sc._id);

    const { req, res, get } = mockReqRes(org._id);
    await getScheduledChanges(req, res);
    const body = get();

    // 5% of 450 = 22.5 -> rounds to 23 per priceLineItems' Math.round.
    assert.equal(body.effectiveRecurringTotal, 450 - 23, `Growth's own 5% rule must apply (₹23 off), not the frozen business-plan ₹13, got total ${body.effectiveRecurringTotal}`);
  });

  await test('P0 fix: monthly + annual instances of the SAME addonKey — removal on the monthly instance must not bleed into the annual one', async (registry) => {
    // Regression for the bug found while verifying Task 3 (Aug 2026):
    // getScheduledChanges matched keptAddons by addonKey alone, so with two
    // coexisting instances of the same addonKey at different billingCycles,
    // a removal scheduled against one instance could misattribute quantity
    // against whichever instance the .find() happened to hit first.
    const org = await Organization.create({ name: 'SC Dual Cycle Fixture 1', code: 'sc-dual1-' + Date.now() });
    registry.Organization.push(org._id);
    const annualPeriodEnd = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000);
    const sub = await Subscription.create({
      organization: org._id, planName: 'growth', appStatus: 'active', status: 'active',
      billingCycle: 'yearly', pricePerUser: 4800, userCount: 1, totalAmount: 5200,
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      billingAnchor: new Date(),
      activeAddons: [
        { addonKey: 'seat', billingCycle: 'monthly', quantity: 2, pricePerUnit: 100 },
        { addonKey: 'seat', billingCycle: 'yearly', quantity: 1, pricePerUnit: 1000, periodEnd: annualPeriodEnd },
      ],
    });
    registry.Subscription.push(sub._id);
    const effectiveAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const sc = await ScheduledChange.create({
      organization: org._id, subscription: sub._id, type: 'REMOVE_ADDON', status: 'PENDING', effectiveAt,
      payload: { addonKey: 'seat', billingCycle: 'monthly', quantity: 1 },
    });
    registry.ScheduledChange.push(sc._id);

    const { req, res, get } = mockReqRes(org._id);
    await getScheduledChanges(req, res);
    const body = get();

    assert.equal(body.removedAddons.length, 1, 'exactly one removal, targeting the monthly instance only');
    assert.equal(body.removedAddons[0].billingCycle, 'monthly', 'removal must attribute to the MONTHLY instance, not the annual one');
    assert.equal(body.removedAddons[0].quantity, 1);

    const keptMonthly = body.keptAddons.find((a) => a.addonKey === 'seat' && a.billingCycle === 'monthly');
    const keptYearly = body.keptAddons.find((a) => a.addonKey === 'seat' && a.billingCycle === 'yearly');
    assert.ok(keptMonthly, 'monthly instance must still be present (2 - 1 = 1 remains)');
    assert.equal(keptMonthly.quantity, 1, 'monthly instance must be reduced to 1, not removed entirely or left at 2');
    assert.ok(keptYearly, 'annual instance must be completely untouched by the monthly removal');
    assert.equal(keptYearly.quantity, 1, 'annual instance quantity must be unaffected');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
})().catch(async (e) => {
  console.error('FAIL', e);
  await mongoose.disconnect();
  process.exit(1);
});
