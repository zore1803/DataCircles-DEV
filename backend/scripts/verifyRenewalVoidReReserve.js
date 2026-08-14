// scripts/verifyRenewalVoidReReserve.js
//
// Fixture-based verification for RF6 (§3.6b Chapter 19, "a concurrent
// commercial action voids a pending renewal invoice before payment
// resolves") — the void-and-release hook added next to
// subscriptionController.js's existing UPGRADE VOID-on-recycle block. WRITES
// disposable documents and deletes them after each fixture — do NOT point
// this at a production database.
//
// Drives the REAL exports.updateSubscription handler (not a copy of its
// logic) — same mockReqRes pattern as verifyTrialConversionCAW.js.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyRenewalVoidReReserve.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const Reward = require('../models/Reward');
const RewardUsage = require('../models/RewardUsage');
const CommercialTransaction = require('../models/CommercialTransaction');
const BillingInvoice = require('../models/BillingInvoice');

// Same reasoning as verifyRewardConsumptionWebhook.js: this environment's
// Razorpay test keys 401 on live API calls unrelated to what's under test
// here (Order creation for the upgrade's prorated charge). Stubbed on the
// shared config/razorpay.js singleton, script-only, zero production code touched.
const razorpayClient = require('../config/razorpay');
razorpayClient.orders.create = async () => ({ id: `order_fixture_stub_${Date.now()}`, amount: 0 });

const { updateSubscription } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], Reward: [], RewardUsage: [], CommercialTransaction: [], BillingInvoice: [] };
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
  await BillingInvoice.deleteMany({ _id: { $in: registry.BillingInvoice } });
  await CommercialTransaction.deleteMany({ _id: { $in: registry.CommercialTransaction } });
  await RewardUsage.deleteMany({ _id: { $in: registry.RewardUsage } });
  await Reward.deleteMany({ _id: { $in: registry.Reward } });
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

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('RF6 — upgrade voids a pending renewal invoice and releases its reserved reward\n');

  await test('An upgrade request VOIDs a pending RENEWAL transaction, releases its reward with REPLACED_BY_NEW_INVOICE, and re-reserves it for itself', async (registry) => {
    const starterPlan = await PlanConfig.findOne({ planId: 'starter', isActive: true });
    const growthPlan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
    assert.ok(starterPlan && growthPlan, 'Expected active "starter" and "growth" PlanConfigs to exist in this DB');

    const org = await trackedCreate(Organization, 'Organization', registry, {
      name: 'RF6 Fixture Org', code: `rf6-fixture-${Date.now()}`,
    });
    const user = await trackedCreate(User, 'User', registry, {
      name: 'RF6 Fixture User',
      email: `rf6-fixture-${Date.now()}@example.test`,
      phone: `9${String(Date.now()).slice(-9)}`,
      organization: org._id,
      role: 'admin',
      auth0Id: `rf6-fixture-${Date.now()}`,
    });

    const reward = await trackedCreate(Reward, 'Reward', registry, {
      organization: org._id, source: 'MANUAL', rewardType: 'fixed', rewardValue: 40,
    });

    const subscription = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id,
      planName: 'starter',
      appStatus: 'active',
      billingCycle: 'monthly',
      pricePerUser: starterPlan.monthlyPrice,
      userCount: 1,
      totalAmount: starterPlan.monthlyPrice,
      isPaymentConfirmed: true,
      paymentStatus: 'payment_completed',
      activeAddons: [],
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    });

    // Hand-construct the state a real renewal attempt would have already left
    // behind (per verifyRenewalReferralModifier.js's Fixture 1) — a reserved
    // reward and a pending RENEWAL transaction referencing it. Isolating RF6
    // from R8's own reservation logic, which is separately verified.
    const rewardUsage = await trackedCreate(RewardUsage, 'RewardUsage', registry, {
      reward: reward._id,
      subscription: subscription._id,
      status: 'reserved',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    const pendingRenewal = await trackedCreate(CommercialTransaction, 'CommercialTransaction', registry, {
      organization: org._id,
      subscription: subscription._id,
      type: 'RENEWAL',
      status: 'PRICED',
      target: { rewardUsageId: rewardUsage._id, total: starterPlan.monthlyPrice - 40, newPeriodStart: new Date(), newPeriodEnd: new Date() },
    });

    // --- Drive the REAL updateSubscription handler ---
    const { req, res, getResult } = mockReqRes({ organization: org._id, _id: user._id }, {
      planId: 'growth',
      billingCycle: 'monthly',
      addons: [],
    });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = getResult();
    if (statusCode && statusCode >= 400) {
      throw new Error(`updateSubscription returned ${statusCode}: ${JSON.stringify(jsonBody)}`);
    }

    // --- The voided renewal transaction ---
    const reloadedRenewal = await CommercialTransaction.findById(pendingRenewal._id);
    assert.equal(reloadedRenewal.status, 'VOID', 'Pending RENEWAL transaction must be VOIDed by the upgrade request');

    // --- The released reservation ---
    const reloadedOriginalUsage = await RewardUsage.findById(rewardUsage._id);
    assert.equal(reloadedOriginalUsage.status, 'released', 'Original reservation must be released, not left reserved or consumed');
    assert.equal(reloadedOriginalUsage.releaseReason, 'REPLACED_BY_NEW_INVOICE', 'Release reason must be REPLACED_BY_NEW_INVOICE specifically, not TIMEOUT/PAYMENT_FAILED');

    // --- The upgrade's own re-reservation of the same (now-available) reward ---
    const allUsagesForReward = await RewardUsage.find({ reward: reward._id });
    for (const u of allUsagesForReward) {
      if (!registry.RewardUsage.some((id) => String(id) === String(u._id))) registry.RewardUsage.push(u._id);
    }
    const reservedUsages = allUsagesForReward.filter((u) => u.status === 'reserved');
    assert.equal(reservedUsages.length, 1, 'Exactly one live reservation must exist after the upgrade — no double-counting of the same underlying Reward');
    assert.notEqual(String(reservedUsages[0]._id), String(rewardUsage._id), 'The upgrade must have created a NEW RewardUsage row, not resurrected the voided one');

    // --- The new UPGRADE transaction itself ---
    const upgradeTransaction = await CommercialTransaction.findOne({ subscription: subscription._id, type: 'UPGRADE' });
    if (upgradeTransaction) registry.CommercialTransaction.push(upgradeTransaction._id);
    assert.ok(upgradeTransaction, 'Expected an UPGRADE CommercialTransaction to have been created');
    // PRICED -> AWAITING_PAYMENT once the Razorpay order is created, same
    // progression every other CommercialTransaction call site already makes.
    assert.ok(['PRICED', 'AWAITING_PAYMENT'].includes(upgradeTransaction.status), `Expected PRICED or AWAITING_PAYMENT, got ${upgradeTransaction.status}`);

    // --- Sanity: the upgrade actually priced WITH the re-reserved discount applied,
    // not just re-reserved-but-unused ---
    assert.ok(jsonBody?.proratedAmount !== undefined, 'Expected the upgrade response to include a priced proration amount');
    assert.ok(jsonBody?.referralDiscountApplied > 0, `Expected a non-zero referralDiscountApplied reflecting the re-reserved reward, got ${jsonBody?.referralDiscountApplied}`);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
