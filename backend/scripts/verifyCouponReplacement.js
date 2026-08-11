// scripts/verifyCouponReplacement.js
//
// Fixture-based verification for C1 (coupon replacement on an already-paid
// subscription) — traced, designed, and now built per the explicit
// architectural requirement: Subscription.appliedCoupon is a swappable
// pointer to "what currently affects future pricing"; CouponRedemption is a
// SEPARATE, permanent audit record. Removing/replacing a coupon must never
// delete/decrement historical redemption or free up a redemption slot.
//
// Drives the REAL exports.removeAppliedCoupon / exports.replaceAppliedCoupon
// handlers end-to-end (not copies of their logic).
//
// WRITES disposable documents and deletes them after each fixture — do NOT
// point this at a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyCouponReplacement.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');
const BillingEvent = require('../models/BillingEvent');

const { removeAppliedCoupon, replaceAppliedCoupon, previewRemoveCoupon, previewReplaceCoupon } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], Coupon: [], CouponRedemption: [], BillingEvent: [] };
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
  await BillingEvent.deleteMany({ _id: { $in: registry.BillingEvent } });
  await CouponRedemption.deleteMany({ _id: { $in: registry.CouponRedemption } });
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

async function makeOrgAndUser(registry, label) {
  const org = await trackedCreate(Organization, 'Organization', registry, { name: `${label} Org`, code: `${label.toLowerCase()}-${Date.now()}` });
  const user = await trackedCreate(User, 'User', registry, {
    name: `${label} User`, email: `${label.toLowerCase()}-${Date.now()}@example.test`,
    phone: `9${String(Date.now()).slice(-9)}`, organization: org._id, role: 'admin', auth0Id: `${label.toLowerCase()}-${Date.now()}`,
  });
  return { org, user };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('C1 — coupon replacement: swap the pointer, never touch redemption history\n');

  const starterPlan = await PlanConfig.findOne({ planId: 'starter', isActive: true });
  const growthPlan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
  assert.ok(starterPlan && growthPlan);

  await test('remove: an already-redeemed first_payment coupon can be detached; recurring baseline recomputes to full price; historical CouponRedemption untouched', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'RemoveCoupon');
    const coupon = await trackedCreate(Coupon, 'Coupon', registry, {
      code: `REMOVE-FP-${Date.now()}`, name: 'Remove fixture', isActive: true,
      scope: { type: 'global' },
      rules: [{ productType: 'plan', productKey: 'starter', discountType: 'fixed', discountValue: 20 }],
      duration: { type: 'first_payment' },
    });
    const redemption = await trackedCreate(CouponRedemption, 'CouponRedemption', registry, {
      coupon: coupon._id, couponCode: coupon.code, organization: org._id,
      context: { planId: 'starter', billingCycle: 'monthly', checkoutType: 'new_subscription' },
      baseAmount: starterPlan.monthlyPrice, discountAmount: 20, finalAmount: starterPlan.monthlyPrice - 20,
    });
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'starter', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: starterPlan.monthlyPrice, userCount: 1, totalAmount: starterPlan.monthlyPrice, activeAddons: [],
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      appliedCoupon: {
        couponId: coupon._id, code: coupon.code, name: coupon.name, duration: { type: 'first_payment' },
        discountAmount: 20, baseSubtotal: starterPlan.monthlyPrice, recurringSubtotal: starterPlan.monthlyPrice,
        fullRulesSnapshot: coupon.rules, redeemed: true,
      },
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id }, {});
    await removeAppliedCoupon(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected remove to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);

    const reloaded = await Subscription.findById(subscription._id);
    assert.ok(!reloaded.appliedCoupon?.code, 'appliedCoupon must be cleared');
    assert.equal(reloaded.totalAmount, starterPlan.monthlyPrice, 'recurring baseline must return to full undiscounted price');

    const redemptionStillExists = await CouponRedemption.findById(redemption._id);
    assert.ok(redemptionStillExists, 'historical CouponRedemption must NOT be deleted by removing the coupon from the subscription');

    const event = await BillingEvent.findOne({ subscription: subscription._id, eventType: 'COUPON_REMOVED' });
    registry.BillingEvent.push(event._id);
    assert.ok(event, 'COUPON_REMOVED BillingEvent must be emitted');
  });

  await test('replace: a lifetime coupon can be swapped for a different lifetime coupon; new discount applies to recurring baseline; old redemption untouched, new redemption recorded once', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'ReplaceCoupon');
    const oldCoupon = await trackedCreate(Coupon, 'Coupon', registry, {
      code: `OLD-LIFETIME-${Date.now()}`, name: 'Old lifetime fixture', isActive: true,
      scope: { type: 'global' },
      rules: [{ productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 20 }],
      duration: { type: 'lifetime' },
    });
    const newCoupon = await trackedCreate(Coupon, 'Coupon', registry, {
      code: `NEW-LIFETIME-${Date.now()}`, name: 'New lifetime fixture', isActive: true,
      scope: { type: 'global' },
      rules: [{ productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 45 }],
      duration: { type: 'lifetime' },
    });
    const oldRedemption = await trackedCreate(CouponRedemption, 'CouponRedemption', registry, {
      coupon: oldCoupon._id, couponCode: oldCoupon.code, organization: org._id,
      context: { planId: 'growth', billingCycle: 'monthly', checkoutType: 'new_subscription' },
      baseAmount: growthPlan.monthlyPrice, discountAmount: 20, finalAmount: growthPlan.monthlyPrice - 20,
    });
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'growth', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: growthPlan.monthlyPrice, userCount: 1, totalAmount: growthPlan.monthlyPrice - 20, activeAddons: [],
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      appliedCoupon: {
        couponId: oldCoupon._id, code: oldCoupon.code, name: oldCoupon.name, duration: { type: 'lifetime' },
        discountAmount: 20, baseSubtotal: growthPlan.monthlyPrice, recurringSubtotal: growthPlan.monthlyPrice - 20,
        fullRulesSnapshot: oldCoupon.rules, redeemed: true,
      },
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id }, { couponCode: newCoupon.code });
    await replaceAppliedCoupon(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected replace to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);

    const reloaded = await Subscription.findById(subscription._id);
    assert.equal(reloaded.appliedCoupon.code, newCoupon.code, 'appliedCoupon must now point to the NEW coupon');
    assert.equal(reloaded.appliedCoupon.discountAmount, 45, 'new coupon discount amount must be recorded');
    assert.equal(reloaded.totalAmount, growthPlan.monthlyPrice - 45, 'recurring baseline must reflect the NEW coupon');
    assert.equal(reloaded.appliedCoupon.redeemed, true, 'new coupon redemption must be recorded immediately (no future payment event to wait for)');

    const oldRedemptionStillExists = await CouponRedemption.findById(oldRedemption._id);
    assert.ok(oldRedemptionStillExists, 'the OLD coupon\'s historical redemption must be untouched');

    const newRedemptions = await CouponRedemption.find({ coupon: newCoupon._id, organization: org._id });
    newRedemptions.forEach((r) => registry.CouponRedemption.push(r._id));
    assert.equal(newRedemptions.length, 1, 'exactly ONE new redemption must be recorded for the new coupon, not zero or duplicated');

    const event = await BillingEvent.findOne({ subscription: subscription._id, eventType: 'COUPON_CHANGED' });
    registry.BillingEvent.push(event._id);
    assert.ok(event, 'COUPON_CHANGED BillingEvent must be emitted');
    assert.equal(event.metadata.previousCouponCode, oldCoupon.code);
    assert.equal(event.metadata.newCouponCode, newCoupon.code);
  });

  await test('replace: attaching a first_payment coupon post-purchase correctly has ZERO effect on the recurring baseline (no future invoice for it to discount)', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'ReplaceFirstPayment');
    const newCoupon = await trackedCreate(Coupon, 'Coupon', registry, {
      code: `POSTPURCHASE-FP-${Date.now()}`, name: 'Post-purchase first_payment fixture', isActive: true,
      scope: { type: 'global' },
      rules: [{ productType: 'plan', productKey: 'starter', discountType: 'fixed', discountValue: 30 }],
      duration: { type: 'first_payment' },
    });
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'starter', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: starterPlan.monthlyPrice, userCount: 1, totalAmount: starterPlan.monthlyPrice, activeAddons: [],
      isPaymentConfirmed: true, paymentStatus: 'payment_completed', appliedCoupon: null,
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id }, { couponCode: newCoupon.code });
    await replaceAppliedCoupon(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected replace to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);

    const reloaded = await Subscription.findById(subscription._id);
    assert.equal(reloaded.appliedCoupon.code, newCoupon.code, 'the coupon snapshot must still be attached (for audit/display)');
    assert.equal(reloaded.totalAmount, starterPlan.monthlyPrice, 'a first_payment coupon attached post-purchase must NOT discount the recurring baseline — there is no future first invoice left for it to apply to');

    const newRedemptions = await CouponRedemption.find({ coupon: newCoupon._id, organization: org._id });
    newRedemptions.forEach((r) => registry.CouponRedemption.push(r._id));
    const event = await BillingEvent.findOne({ subscription: subscription._id, eventType: 'COUPON_CHANGED' });
    if (event) registry.BillingEvent.push(event._id);
  });

  await test('remove: fails cleanly with no coupon currently applied', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'RemoveNoCoupon');
    await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'starter', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: starterPlan.monthlyPrice, userCount: 1, totalAmount: starterPlan.monthlyPrice, activeAddons: [],
      isPaymentConfirmed: true, paymentStatus: 'payment_completed', appliedCoupon: null,
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id }, {});
    await removeAppliedCoupon(req, res);
    const { statusCode } = getResult();
    assert.equal(statusCode, 400, 'must reject cleanly when there is nothing to remove');
  });

  await test('replace: rejected for a subscription that has not yet paid — this endpoint is post-purchase only', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'ReplacePendingSub');
    const coupon = await trackedCreate(Coupon, 'Coupon', registry, {
      code: `PENDING-REJECT-${Date.now()}`, name: 'Pending-rejection fixture', isActive: true,
      scope: { type: 'global' }, rules: [{ productType: 'plan', productKey: 'starter', discountType: 'fixed', discountValue: 10 }],
      duration: { type: 'lifetime' },
    });
    await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'starter', appStatus: 'trial', billingCycle: 'monthly',
      pricePerUser: starterPlan.monthlyPrice, userCount: 1, totalAmount: 0, activeAddons: [],
      isPaymentConfirmed: false, paymentStatus: 'pending_payment',
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id }, { couponCode: coupon.code });
    await replaceAppliedCoupon(req, res);
    const { statusCode } = getResult();
    assert.equal(statusCode, 400, 'must reject — this is the post-purchase replacement endpoint, not the signup coupon path');
  });

  await test('preview-removal: recurring coupon reports the real before/after amounts WITHOUT persisting anything', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'PreviewRemove');
    const coupon = await trackedCreate(Coupon, 'Coupon', registry, {
      code: `PREVIEW-REMOVE-${Date.now()}`, name: 'Preview remove fixture', isActive: true,
      scope: { type: 'global' }, rules: [{ productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 25 }],
      duration: { type: 'until_cancelled' },
    });
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'growth', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: growthPlan.monthlyPrice, userCount: 1, totalAmount: growthPlan.monthlyPrice - 25, activeAddons: [],
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      appliedCoupon: { couponId: coupon._id, code: coupon.code, name: coupon.name, duration: { type: 'until_cancelled' }, discountAmount: 25, baseSubtotal: growthPlan.monthlyPrice, recurringSubtotal: growthPlan.monthlyPrice - 25, fullRulesSnapshot: coupon.rules, redeemed: true },
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id }, {});
    await previewRemoveCoupon(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected preview to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);
    assert.equal(jsonBody.recurringBefore, growthPlan.monthlyPrice - 25);
    assert.equal(jsonBody.recurringAfter, growthPlan.monthlyPrice);
    assert.equal(jsonBody.willChangeRecurring, true);

    const reloaded = await Subscription.findById(subscription._id);
    assert.equal(reloaded.appliedCoupon.code, coupon.code, 'preview must NOT actually remove the coupon');
    assert.equal(reloaded.totalAmount, growthPlan.monthlyPrice - 25, 'preview must NOT actually change totalAmount');
  });

  await test('preview-removal: first_payment (already non-recurring) coupon correctly reports NO change to recurring amount', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'PreviewRemoveFP');
    const coupon = await trackedCreate(Coupon, 'Coupon', registry, {
      code: `PREVIEW-REMOVE-FP-${Date.now()}`, name: 'Preview remove FP fixture', isActive: true,
      scope: { type: 'global' }, rules: [{ productType: 'plan', productKey: 'starter', discountType: 'fixed', discountValue: 20 }],
      duration: { type: 'first_payment' },
    });
    await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'starter', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: starterPlan.monthlyPrice, userCount: 1, totalAmount: starterPlan.monthlyPrice, activeAddons: [],
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      appliedCoupon: { couponId: coupon._id, code: coupon.code, name: coupon.name, duration: { type: 'first_payment' }, discountAmount: 20, baseSubtotal: starterPlan.monthlyPrice, recurringSubtotal: starterPlan.monthlyPrice, fullRulesSnapshot: coupon.rules, redeemed: true },
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id }, {});
    await previewRemoveCoupon(req, res);
    const { jsonBody } = getResult();
    assert.equal(jsonBody.recurringBefore, starterPlan.monthlyPrice);
    assert.equal(jsonBody.recurringAfter, starterPlan.monthlyPrice);
    assert.equal(jsonBody.willChangeRecurring, false, 'a first_payment coupon was already not affecting recurring billing — removing it must report no change');
  });

  await test('preview-replace: reports the correct before/after and recurringEligible flag WITHOUT persisting anything', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'PreviewReplace');
    const oldCoupon = await trackedCreate(Coupon, 'Coupon', registry, {
      code: `PREVIEW-REPLACE-OLD-${Date.now()}`, name: 'Old fixture', isActive: true,
      scope: { type: 'global' }, rules: [{ productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 10 }],
      duration: { type: 'lifetime' },
    });
    const newCoupon = await trackedCreate(Coupon, 'Coupon', registry, {
      code: `PREVIEW-REPLACE-NEW-${Date.now()}`, name: 'New fixture', isActive: true,
      scope: { type: 'global' }, rules: [{ productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 40 }],
      duration: { type: 'lifetime' },
    });
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'growth', appStatus: 'active', billingCycle: 'monthly',
      pricePerUser: growthPlan.monthlyPrice, userCount: 1, totalAmount: growthPlan.monthlyPrice - 10, activeAddons: [],
      isPaymentConfirmed: true, paymentStatus: 'payment_completed',
      appliedCoupon: { couponId: oldCoupon._id, code: oldCoupon.code, name: oldCoupon.name, duration: { type: 'lifetime' }, discountAmount: 10, baseSubtotal: growthPlan.monthlyPrice, recurringSubtotal: growthPlan.monthlyPrice - 10, fullRulesSnapshot: oldCoupon.rules, redeemed: true },
    });

    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id }, { couponCode: newCoupon.code });
    await previewReplaceCoupon(req, res);
    const { statusCode, jsonBody } = getResult();
    assert.ok(statusCode < 400, `Expected preview to succeed, got ${statusCode}: ${JSON.stringify(jsonBody)}`);
    assert.equal(jsonBody.recurringBefore, growthPlan.monthlyPrice - 10);
    assert.equal(jsonBody.recurringAfter, growthPlan.monthlyPrice - 40);
    assert.equal(jsonBody.recurringEligible, true);

    const reloaded = await Subscription.findById(subscription._id);
    assert.equal(reloaded.appliedCoupon.code, oldCoupon.code, 'preview must NOT actually replace the coupon');
    assert.equal(reloaded.totalAmount, growthPlan.monthlyPrice - 10, 'preview must NOT actually change totalAmount');

    const redemptions = await CouponRedemption.find({ coupon: newCoupon._id, organization: org._id });
    redemptions.forEach((r) => registry.CouponRedemption.push(r._id));
    assert.equal(redemptions.length, 0, 'preview must NOT record a redemption for the new coupon');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
