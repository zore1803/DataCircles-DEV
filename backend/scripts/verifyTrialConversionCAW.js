// scripts/verifyTrialConversionCAW.js
//
// Fixture-based verification for the Phase 4D-5 migration: trial->paid
// conversion (updateSubscription's !isPaymentConfirmed branch) now acquires
// a Charge-at-Will Registration Link instead of a legacy Razorpay
// Subscription. WRITES disposable documents (Organization/User/Subscription)
// and deletes them after — do NOT point this at a production database.
//
// Drives the REAL exports.updateSubscription handler (not a copy of its
// logic), against the REAL Razorpay test-mode key already configured in
// .env — this makes a live createRegistrationLink() API call.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifyTrialConversionCAW.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const BillingInvoice = require('../models/BillingInvoice');
const { updateSubscription } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], BillingInvoice: [] };
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
  await Subscription.deleteMany({ _id: { $in: registry.Subscription } });
  await User.deleteMany({ _id: { $in: registry.User } });
  await Organization.deleteMany({ _id: { $in: registry.Organization } });
}

// Builds a mock req/res pair around the real Express handler — same pattern
// verifyRenewalWebhookReconciliation.js uses for handleWebhook.
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

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB for verification. Running Phase 4D-5 fixtures...\n');

  await test('trial org has no mandateTokenId before conversion (baseline)', async (registry) => {
    const plan = await PlanConfig.findOne({ planId: 'growth', isActive: true });
    assert.ok(plan, 'Expected an active "growth" PlanConfig to already exist in this DB');

    const org = await Organization.create({ name: 'CAW Verify Fixture Org', code: `caw-verify-${Date.now()}` });
    registry.Organization.push(org._id);
    const user = await User.create({
      name: 'CAW Verify Fixture User',
      email: `caw-verify-${Date.now()}@example.test`,
      phone: `9${String(Date.now()).slice(-9)}`,
      organization: org._id,
      role: 'admin',
      auth0Id: `caw-verify-fixture-${Date.now()}`,
    });
    registry.User.push(user._id);
    const trialSub = await Subscription.create({
      organization: org._id,
      planName: 'growth',
      appStatus: 'trial',
      status: 'created',
      billingCycle: 'monthly',
      pricePerUser: plan.monthlyPrice,
      userCount: 1,
      totalAmount: plan.monthlyPrice,
      isPaymentConfirmed: false,
      paymentStatus: 'pending_payment',
      isTrialActive: true,
      trialStart: new Date(),
    });
    registry.Subscription.push(trialSub._id);

    assert.equal(trialSub.mandateTokenId, undefined, 'Baseline: trial subscription must have no mandateTokenId');
    assert.equal(trialSub.registrationLinkId, undefined, 'Baseline: trial subscription must have no registrationLinkId');

    const subCountBefore = await Subscription.countDocuments({ organization: org._id });
    assert.equal(subCountBefore, 1, 'Baseline: exactly one Subscription document for this org');

    // --- Run the actual migrated code path ---
    const { req, res, getResult } = mockReqRes(user, {
      planId: 'growth',
      billingCycle: 'monthly',
      addons: [],
    });
    await updateSubscription(req, res);
    const { statusCode, jsonBody } = getResult();

    if (statusCode && statusCode >= 400) {
      throw new Error(`updateSubscription returned ${statusCode}: ${JSON.stringify(jsonBody)}`);
    }

    assert.equal(jsonBody.success, true, 'Expected success:true');
    assert.ok(jsonBody.registrationLink?.shortUrl, 'Expected a real registrationLink.shortUrl in the response');
    assert.ok(jsonBody.registrationLink?.id, 'Expected a real registrationLink.id');
    console.log(`    -> Registration Link created live: ${jsonBody.registrationLink.id} (${jsonBody.registrationLink.shortUrl})`);

    const afterDoc = await Subscription.findById(trialSub._id);
    assert.equal(afterDoc.mandateStatus, 'pending', 'Expected mandateStatus=pending after conversion');
    assert.ok(afterDoc.registrationLinkId, 'Expected registrationLinkId to be persisted');
    assert.equal(afterDoc.razorpaySubscriptionId, undefined, 'Legacy razorpaySubscriptionId must NOT be set');
    assert.equal(afterDoc.razorpayPlanId, undefined, 'Legacy razorpayPlanId must NOT be set');
    // Nested-object schema fields (models/Subscription.js:150,177) — setting
    // `= null` casts to an empty subdocument rather than a literal null
    // (pre-existing Mongoose behavior, identical to what the legacy code this
    // replaced already relied on); check for absence of scheduled data
    // instead of strict null.
    assert.equal(afterDoc.pendingUpdate?.planName, undefined, 'pendingUpdate must have no scheduled plan data');
    assert.equal(afterDoc.pendingUpgrade?.planName, undefined, 'pendingUpgrade must have no scheduled plan data');

    // --- Single-Subscription-document invariant ---
    const subCountAfter = await Subscription.countDocuments({ organization: org._id });
    assert.equal(subCountAfter, 1, 'Trial->Paid must mutate the existing Subscription in place, never create a second one');
    assert.equal(String(afterDoc._id), String(trialSub._id), 'The updated document must be the SAME document as the original trial subscription');

    const invoice = await BillingInvoice.findOne({ subscription: trialSub._id });
    if (invoice) registry.BillingInvoice.push(invoice._id);
    assert.ok(invoice, 'Expected a BillingInvoice to have been written for this conversion');
    assert.equal(invoice.reason, 'NEW_SUBSCRIPTION');

    // --- Simulate the token.confirmed + payment.captured webhook sequence ---
    // (Simulated field mutation, not a driven webhook request — Step 5 asks
    // to "simulate the resulting sequence and confirm mandateTokenId ends up
    // set / isPaymentConfirmed reaches active" ; the webhook HTTP-signature
    // path itself was already fixture-verified for CAW in
    // verifyRenewalWebhookReconciliation.js and is unmodified by this
    // migration, so it is not re-driven here.)
    const { reconcileMandate } = require('../controllers/subscriptionController');
    afterDoc.mandateTokenId = 'token_verify_fixture_simulated';
    afterDoc.mandateStatus = 'confirmed';
    afterDoc.paymentStatus = 'payment_completed';
    await reconcileMandate(afterDoc);

    const finalDoc = await Subscription.findById(trialSub._id);
    assert.equal(finalDoc.isPaymentConfirmed, true, 'Expected isPaymentConfirmed=true after simulated mandate confirmation + capture');
    assert.equal(finalDoc.appStatus, 'active', 'Expected appStatus=active after simulated mandate confirmation + capture');
    assert.equal(finalDoc.mandateTokenId, 'token_verify_fixture_simulated', 'Expected mandateTokenId to be set');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
})();
