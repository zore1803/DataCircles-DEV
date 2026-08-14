// scripts/verifyCouponAtUpgrade.js
//
// Fixture-based verification for Plan Upgrade Stage 5 per-item pricing —
// oldTotal/newTotal (both already computed via calculateInvoice()) now
// receive a real coupon modifier built from each side's own line items
// against the frozen appliedCoupon.fullRulesSnapshot. No changes to
// calculateCommercialAdjustments()/calculatePlanUpgradeProration() — this
// verifies the caller-side wiring in updateSubscription's upgrade path.
//
// Drives the REAL exports.updateSubscription handler end to end (mockReqRes
// pattern, same as verifyRenewalVoidReReserve.js). WRITES disposable
// documents and deletes them after — do NOT point this at a production DB.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyCouponAtUpgrade.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const Coupon = require('../models/Coupon');
const CommercialTransaction = require('../models/CommercialTransaction');

const razorpayClient = require('../config/razorpay');
razorpayClient.orders.create = async (params) => ({ id: `order_fixture_stub_${Date.now()}`, amount: params.amount });

const couponController = require('../controllers/couponController');
const { updateSubscription } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], Coupon: [], CommercialTransaction: [] };
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
  await CommercialTransaction.deleteMany({ _id: { $in: registry.CommercialTransaction } });
  await Coupon.deleteMany({ _id: { $in: registry.Coupon } });
  await Subscription.deleteMany({ _id: { $in: registry.Subscription } });
  await User.deleteMany({ _id: { $in: registry.User } });
  await Organization.deleteMany({ _id: { $in: registry.Organization } });
}

async function trackedCreate(Model, key, registry, doc) {
  const created = await Model.create(doc);
  registry[key].push(created._id);
  return created;
}

function mockReqRes(user, body) {
  let statusCode = 200;
  let jsonBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { jsonBody = body; return this; },
  };
  const req = { user, body };
  return { req, res, getResult: () => ({ statusCode, jsonBody }) };
}

async function createRealCoupon(registry, rules) {
  const { req, res, getResult } = { ...mockReqRes(null, {
    code: `UPG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Upgrade Fixture Coupon', scope: { type: 'global' }, rules, duration: { type: 'lifetime' },
  }) };
  req.superAdmin = { _id: new mongoose.Types.ObjectId() };
  await couponController.createCoupon(req, res);
  const { statusCode, jsonBody } = getResult();
  assert.equal(statusCode, 201, `Expected 201 creating coupon, got ${statusCode}: ${JSON.stringify(jsonBody)}`);
  registry.Coupon.push(jsonBody.coupon._id);
  return jsonBody.coupon;
}

async function makeOrgAndUser(registry, label) {
  const org = await trackedCreate(Organization, 'Organization', registry, { name: `${label} Org`, code: `${label.toLowerCase()}-${Date.now()}` });
  const user = await trackedCreate(User, 'User', registry, {
    name: `${label} User`,
    email: `${label.toLowerCase()}-${Date.now()}@example.test`,
    phone: `9${String(Date.now()).slice(-9)}`,
    organization: org._id,
    role: 'admin',
    auth0Id: `${label.toLowerCase()}-${Date.now()}`,
  });
  return { org, user };
}

// Builds an already-paid Starter subscription with a real appliedCoupon
// snapshot (hand-constructed here, not via signup — Brief 1 already proved
// the signup writer produces this shape correctly; this fixture targets the
// upgrade-path CONSUMER of that snapshot, not the writer again).
async function makeStarterSubscription(registry, org, starterPlan, fullRulesSnapshot, discountAmount) {
  return trackedCreate(Subscription, 'Subscription', registry, {
    organization: org._id,
    planName: 'starter',
    appStatus: 'active',
    billingCycle: 'monthly',
    pricePerUser: starterPlan.monthlyPrice,
    userCount: 1,
    totalAmount: starterPlan.monthlyPrice - discountAmount,
    isPaymentConfirmed: true,
    paymentStatus: 'payment_completed',
    activeAddons: [],
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    appliedCoupon: fullRulesSnapshot ? {
      code: 'FIXTURE', name: 'Fixture', duration: { type: 'lifetime' },
      discountAmount, baseSubtotal: starterPlan.monthlyPrice, recurringSubtotal: starterPlan.monthlyPrice - discountAmount,
      fullRulesSnapshot,
    } : undefined,
  });
}

async function driveUpgrade(org, user, planId) {
  const { req, res, getResult } = mockReqRes(
    { organization: org._id, _id: user._id },
    { planId, billingCycle: 'monthly', addons: [] }
  );
  await updateSubscription(req, res);
  const { statusCode, jsonBody } = getResult();
  if (statusCode >= 400) throw new Error(`updateSubscription returned ${statusCode}: ${JSON.stringify(jsonBody)}`);
  return jsonBody;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('Plan Upgrade Stage 5 — per-item coupon pricing\n');

  const starterPlan = await PlanConfig.findOne({ planId: 'starter', isActive: true });
  const growthPlan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
  assert.ok(starterPlan && growthPlan, 'Expected active "starter" and "growth" PlanConfigs');

  await test('CP3 exact scenario: coupon scoped to old plan (Starter) only, upgrade to a plan it does NOT cover (Growth) — discount applies pre-upgrade, cleanly absent post-upgrade', async (registry) => {
    const fullRulesSnapshot = [{ productType: 'plan', productKey: 'starter', discountType: 'fixed', discountValue: 20 }];
    const { org, user } = await makeOrgAndUser(registry, 'CP3');
    const subscription = await makeStarterSubscription(registry, org, starterPlan, fullRulesSnapshot, 20);

    const body = await driveUpgrade(org, user, 'growth');

    // oldRecurringTotal must reflect the Starter discount (100 - 20 = 80),
    // newRecurringTotal must reflect Growth's FULL price (coupon doesn't cover it).
    assert.equal(body.oldRecurringTotal, starterPlan.monthlyPrice - 20, 'Old total must reflect the Starter-scoped coupon discount');
    assert.equal(body.newRecurringTotal, growthPlan.monthlyPrice, 'New total must be Growth\'s FULL price — the coupon does not cover Growth (CP3)');

    const ct = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'UPGRADE' });
    if (ct) registry.CommercialTransaction.push(ct._id);
  });

  await test('coupon scoped to BOTH old and new plan, different rates — each side uses its OWN rate, not blended', async (registry) => {
    const fullRulesSnapshot = [
      { productType: 'plan', productKey: 'starter', discountType: 'fixed', discountValue: 20 },
      { productType: 'plan', productKey: 'growth', discountType: 'fixed', discountValue: 45 },
    ];
    const { org, user } = await makeOrgAndUser(registry, 'BothPlans');
    const subscription = await makeStarterSubscription(registry, org, starterPlan, fullRulesSnapshot, 20);

    const body = await driveUpgrade(org, user, 'growth');

    assert.equal(body.oldRecurringTotal, starterPlan.monthlyPrice - 20, 'Old side must use the Starter-specific discount (20)');
    assert.equal(body.newRecurringTotal, growthPlan.monthlyPrice - 45, 'New side must use the Growth-specific discount (45), not the old rate');

    const ct = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'UPGRADE' });
    if (ct) registry.CommercialTransaction.push(ct._id);
  });

  await test('coupon scoped ONLY to an add-on — plan proration completely unaffected, no accidental cross-item discount', async (registry) => {
    const fullRulesSnapshot = [{ productType: 'addon', productKey: 'seat', discountType: 'fixed', discountValue: 30 }];
    const { org, user } = await makeOrgAndUser(registry, 'AddonScopedOnly');
    const subscription = await makeStarterSubscription(registry, org, starterPlan, fullRulesSnapshot, 0);
    // No add-ons active — this coupon has nothing to match on EITHER side.

    const body = await driveUpgrade(org, user, 'growth');

    assert.equal(body.oldRecurringTotal, starterPlan.monthlyPrice, 'Old total must be full price — an add-on-scoped coupon must not discount the plan');
    assert.equal(body.newRecurringTotal, growthPlan.monthlyPrice, 'New total must be full price — same isolation on the new side');

    const ct = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'UPGRADE' });
    if (ct) registry.CommercialTransaction.push(ct._id);
  });

  await test('no appliedCoupon at all — equivalence/regression check, identical to pre-change behavior', async (registry) => {
    const { org, user } = await makeOrgAndUser(registry, 'NoCoupon');
    const subscription = await makeStarterSubscription(registry, org, starterPlan, null, 0);

    const body = await driveUpgrade(org, user, 'growth');

    assert.equal(body.oldRecurringTotal, starterPlan.monthlyPrice, 'No coupon: old total must be exactly the raw Starter price, unchanged from before this work');
    assert.equal(body.newRecurringTotal, growthPlan.monthlyPrice, 'No coupon: new total must be exactly the raw Growth price, unchanged from before this work');

    const ct = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'UPGRADE' });
    if (ct) registry.CommercialTransaction.push(ct._id);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
