// scripts/verifySubscriptionActivatedEvent.js
//
// Fixture-based verification for the new SUBSCRIPTION_ACTIVATED event —
// found missing during live QA ("Subscribed to Growth" fires at mandate-
// REQUEST time, then nothing ever marked real confirmation). Proves
// SUBSCRIPTION_ACTIVATED fires exactly once, at reconcileMandate()'s real
// activation transition — not on a repeat idempotent call (webhook
// re-delivery, or the token/payment handlers both calling reconcileMandate
// for the same subscription).
//
// WRITES disposable documents and deletes them after — do NOT point this at
// a production database.
//
// Run with: CONFIRM_TEST_DB=yes node scripts/verifySubscriptionActivatedEvent.js

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const BillingEvent = require('../models/BillingEvent');
const { reconcileMandate } = require('../controllers/subscriptionController');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script CREATES and DELETES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { Organization: [], User: [], Subscription: [], BillingEvent: [] };
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
  await Subscription.deleteMany({ _id: { $in: registry.Subscription } });
  await User.deleteMany({ _id: { $in: registry.User } });
  await Organization.deleteMany({ _id: { $in: registry.Organization } });
}

async function trackedCreate(Model, key, registry, doc) {
  const created = await Model.create(doc);
  registry[key].push(created._id);
  return created;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('SUBSCRIPTION_ACTIVATED — the previously-missing real-confirmation event\n');

  await test('reconcileMandate emits SUBSCRIPTION_ACTIVATED exactly once, not on a repeat idempotent call', async (registry) => {
    const org = await trackedCreate(Organization, 'Organization', registry, { name: 'ActivatedEventOrg', code: `actevt-${Date.now()}` });
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'growth', appStatus: 'trial', billingCycle: 'monthly',
      pricePerUser: 450, userCount: 1, totalAmount: 450, isPaymentConfirmed: false,
      registrationLinkId: `inv_fixture_${Date.now()}`, mandateStatus: 'pending', paymentStatus: 'pending_payment',
    });

    // Simulated field mutation to the AND-gate's true state, same pattern
    // verifyTrialConversionCAW.js already uses for reconcileMandate.
    subscription.mandateTokenId = 'token_fixture_activated';
    subscription.mandateStatus = 'confirmed';
    subscription.paymentStatus = 'payment_completed';

    // First call — the real activation transition.
    await reconcileMandate(subscription);
    const afterFirst = await Subscription.findById(subscription._id);
    assert.equal(afterFirst.appStatus, 'active', 'Expected activation on the first reconcileMandate call');

    const eventsAfterFirst = await BillingEvent.find({ subscription: subscription._id, eventType: 'SUBSCRIPTION_ACTIVATED' });
    eventsAfterFirst.forEach((e) => registry.BillingEvent.push(e._id));
    assert.equal(eventsAfterFirst.length, 1, 'Expected exactly one SUBSCRIPTION_ACTIVATED event after the real activation');

    // Second call — simulates a duplicate/out-of-order webhook re-delivery
    // calling reconcileMandate again for an ALREADY-active subscription.
    await reconcileMandate(afterFirst);
    const eventsAfterSecond = await BillingEvent.find({ subscription: subscription._id, eventType: 'SUBSCRIPTION_ACTIVATED' });
    eventsAfterSecond.forEach((e) => { if (!registry.BillingEvent.some((id) => String(id) === String(e._id))) registry.BillingEvent.push(e._id); });
    assert.equal(eventsAfterSecond.length, 1, 'A repeat idempotent reconcileMandate call must NOT emit a second SUBSCRIPTION_ACTIVATED event');
  });

  await test('reconcileMandate clears isTrialActive atomically with isPaymentConfirmed (regression — found via live QA: a trial->paid CAW conversion left isTrialActive true forever, silently routing every later upgrade/downgrade through the wrong checkout branch)', async (registry) => {
    const org = await trackedCreate(Organization, 'Organization', registry, { name: 'TrialActiveClearOrg', code: `trialclear-${Date.now()}` });
    const subscription = await trackedCreate(Subscription, 'Subscription', registry, {
      organization: org._id, planName: 'starter', appStatus: 'trial', billingCycle: 'monthly',
      pricePerUser: 250, userCount: 1, totalAmount: 250, isPaymentConfirmed: false,
      isTrialActive: true, trialUsed: true,
      registrationLinkId: `inv_fixture_${Date.now()}`, mandateStatus: 'pending', paymentStatus: 'pending_payment',
      razorpaySubscriptionId: undefined, razorpayPlanId: undefined,
    });
    assert.equal(subscription.isTrialActive, true, 'sanity: fixture starts as a real, still-trialing subscription converting to paid');

    subscription.mandateTokenId = 'token_fixture_trialclear';
    subscription.mandateStatus = 'confirmed';
    subscription.paymentStatus = 'payment_completed';
    await reconcileMandate(subscription);

    const reloaded = await Subscription.findById(subscription._id);
    assert.equal(reloaded.isPaymentConfirmed, true, 'isPaymentConfirmed must be true after real activation');
    assert.equal(reloaded.isTrialActive, false, 'isTrialActive must be false the instant a CAW subscription genuinely activates — leaving it true broke isExistingActiveSub on the frontend, which silently skipped the real upgrade/downgrade checkout path');

    const event = await BillingEvent.findOne({ subscription: subscription._id, eventType: 'SUBSCRIPTION_ACTIVATED' });
    if (event) registry.BillingEvent.push(event._id);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
