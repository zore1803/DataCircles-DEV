// scripts/verifyRewardConsumptionWebhook.js
//
// Fixture-based verification for an open question raised during the
// referral/coupon architecture audit: does utils/referralRewards.js's
// consumeReservation() actually fire end-to-end on a real, driven
// payment.captured webhook for an add-on purchase, flipping a real
// RewardUsage document reserved -> consumed? Prior to this script, this was
// only "correct by code inspection," never observed to succeed.
//
// Drives the REAL exports.handleWebhook entry point (signature verification
// included) against the addon-purchase branch of the legacy
// handlePaymentCaptured() — same driving pattern as
// verifyRenewalWebhookReconciliation.js. WRITES disposable documents and
// deletes them after each fixture — do NOT point this at a production DB.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyRewardConsumptionWebhook.js

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const Reward = require('../models/Reward');
const RewardUsage = require('../models/RewardUsage');
const CommercialTransaction = require('../models/CommercialTransaction');
const SubscriptionPayment = require('../models/SubscriptionPayment');

// This test environment's Razorpay keys 401 on the live Plans API (findOrCreateRazorpayPlan
// inside addonManagement.js, called unconditionally by the addon-settlement branch under
// test). That call is orthogonal to what's actually being verified here — reward
// reservation/consumption — so it's stubbed at the shared config/razorpay.js singleton,
// not inside production code. subscriptions.update is already non-fatal on failure in the
// real code (wrapped in its own try/catch), but stubbing it too avoids noisy 401 logs.
const razorpayClient = require('../config/razorpay');
razorpayClient.plans.create = async () => ({ id: `plan_fixture_stub_${Date.now()}` });
razorpayClient.subscriptions.update = async () => ({ id: 'sub_fixture_stub_unused', status: 'active' });

const { handleWebhook } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], Subscription: [], Reward: [], RewardUsage: [], CommercialTransaction: [], SubscriptionPayment: [] };
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
  await SubscriptionPayment.deleteMany({ _id: { $in: registry.SubscriptionPayment } });
  await CommercialTransaction.deleteMany({ _id: { $in: registry.CommercialTransaction } });
  await RewardUsage.deleteMany({ _id: { $in: registry.RewardUsage } });
  await Reward.deleteMany({ _id: { $in: registry.Reward } });
  await Subscription.deleteMany({ _id: { $in: registry.Subscription } });
  await Organization.deleteMany({ _id: { $in: registry.Organization } });
}

async function trackedCreate(Model, key, registry, doc) {
  const created = await Model.create(doc);
  registry[key].push(created._id);
  return created;
}

// Builds a real, correctly-signed webhook request/response pair, exactly as
// Razorpay would send it — exercises exports.handleWebhook's actual
// signature-verification path, not a bypass around it.
function buildPaymentCapturedCall({ orderId, amountPaise, paymentId }) {
  const body = {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: orderId,
          amount: amountPaise,
          status: 'captured',
          method: 'card',
        },
      },
    },
  };
  const rawBody = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  const req = {
    headers: { 'x-razorpay-signature': signature, 'x-razorpay-event-id': `evt_reward_fixture_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` },
    rawBody,
    body,
  };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
  return { req, res };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('Reward reservation/consumption end-to-end verification (real driven webhook)\n');

  await test('A reserved RewardUsage flips to consumed when its matching add-on payment.captured webhook is driven for real', async (registry) => {
    const plan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
    assert.ok(plan, 'Expected an active "growth" PlanConfig to already exist in this DB');

    const org = await trackedCreate(Organization, 'Organization', registry, {
      name: 'Reward Consumption Fixture Org',
      code: `reward-verify-${Date.now()}`,
    });

    const orderId = `order_reward_fixture_${Date.now()}`;
    const paymentId = `pay_reward_fixture_${Date.now()}`;
    const prorationAmount = 199; // rupees

    const reward = await trackedCreate(Reward, 'Reward', registry, {
      organization: org._id,
      source: 'MANUAL',
      rewardType: 'fixed',
      rewardValue: 50,
    });

    const rewardUsage = await trackedCreate(RewardUsage, 'RewardUsage', registry, {
      reward: reward._id,
      status: 'reserved',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    const subscription = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id,
      planName: 'growth',
      appStatus: 'active',
      billingCycle: 'monthly',
      pricePerUser: plan.monthlyPrice,
      userCount: 1,
      totalAmount: plan.monthlyPrice,
      isPaymentConfirmed: true,
      paymentStatus: 'payment_completed',
      activeAddons: [],
      pendingAddonAddition: {
        addonKey: 'extra_seat',
        quantity: 1,
        pricePerUnit: prorationAmount,
        prorationAmount,
        orderId,
        createdAt: new Date(),
        referralRewardUsageId: rewardUsage._id,
      },
    });

    // Baseline — confirm the reservation is genuinely 'reserved' before the
    // webhook fires, so a later 'consumed' read is meaningful, not a fluke.
    const baseline = await RewardUsage.findById(rewardUsage._id);
    assert.equal(baseline.status, 'reserved', 'Baseline: reward usage must start reserved');
    assert.equal(baseline.consumedAt, undefined, 'Baseline: must have no consumedAt yet');

    // --- Drive the REAL webhook entry point, signature verification included ---
    const { req, res } = buildPaymentCapturedCall({ orderId, amountPaise: prorationAmount * 100, paymentId });
    await handleWebhook(req, res);
    assert.equal(res.statusCode, 200, `handleWebhook must return 200, got ${res.statusCode} (${JSON.stringify(res.body)})`);

    // --- The actual claim under test ---
    const afterWebhook = await RewardUsage.findById(rewardUsage._id);
    assert.equal(afterWebhook.status, 'consumed', 'consumeReservation() must have flipped this RewardUsage to consumed via the real webhook path');
    assert.ok(afterWebhook.consumedAt, 'consumedAt must be set');

    // --- Confirm the addon was actually activated too (sanity that this was
    // a genuine settlement, not an early-return no-op that happened to not
    // touch RewardUsage) ---
    const afterSub = await Subscription.findById(subscription._id);
    // Nested-object schema field: `= undefined` casts to an empty subdocument
    // rather than a literal undefined (same Mongoose behavior already noted in
    // verifyTrialConversionCAW.js) — check for absence of scheduled data instead.
    assert.equal(afterSub.pendingAddonAddition?.addonKey, undefined, 'pendingAddonAddition must have no scheduled add-on data after settlement');
    assert.equal(afterSub.pendingAddonAddition?.orderId, undefined, 'pendingAddonAddition.orderId must be cleared after settlement');
    assert.equal(afterSub.activeAddons.length, 1, 'add-on must actually be applied to activeAddons');

    const payment = await SubscriptionPayment.findOne({ subscription: subscription._id });
    if (payment) registry.SubscriptionPayment.push(payment._id);
    assert.ok(payment, 'Expected a SubscriptionPayment record to have been written');

    // --- Idempotency check, same class of question this audit already asked
    // for other webhook paths: does a duplicate delivery double-fire consumption? ---
    const { req: req2, res: res2 } = buildPaymentCapturedCall({ orderId, amountPaise: prorationAmount * 100, paymentId });
    await handleWebhook(req2, res2);
    const afterSecondDelivery = await RewardUsage.findById(rewardUsage._id);
    assert.equal(afterSecondDelivery.status, 'consumed', 'must remain consumed, not re-processed');
    assert.equal(
      afterSecondDelivery.consumedAt.getTime(),
      afterWebhook.consumedAt.getTime(),
      'consumedAt must not be overwritten by a duplicate delivery — proves the atomic status-guard actually held on a second real call, not just in theory'
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
