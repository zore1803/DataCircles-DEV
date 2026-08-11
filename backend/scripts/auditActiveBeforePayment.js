// scripts/auditActiveBeforePayment.js
//
// READ-ONLY audit against the real dev database for Bug #1 (ACTIVE before
// payment). Finds any Subscription document where appStatus is 'active' but
// isPaymentConfirmed is false — the exact inconsistent state that would make
// deriveSubscriptionUIState() show ACTIVE without a confirmed payment. Also
// checks for orphaned 'reserved' RewardUsage rows (the Bug #2 symptom, to
// confirm no further live instances exist after the retry-idempotency fix)
// and duplicate SUBSCRIPTION_CREATED events per subscription.
//
// Makes NO writes. Safe to run against the real dev database.
//
// Run with: node scripts/auditActiveBeforePayment.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Subscription = require('../models/Subscription');
const RewardUsage = require('../models/RewardUsage');
const BillingEvent = require('../models/BillingEvent');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to: ${mongoose.connection.name}\n`);

  console.log('=== Bug #1: appStatus=active but isPaymentConfirmed=false ===');
  const inconsistent = await Subscription.find({ appStatus: 'active', isPaymentConfirmed: false })
    .select('organization planName appStatus isPaymentConfirmed mandateStatus paymentStatus registrationLinkId razorpaySubscriptionId createdAt updatedAt');
  if (inconsistent.length === 0) {
    console.log('None found — no subscription currently in this state.');
  } else {
    inconsistent.forEach((s) => {
      console.log(JSON.stringify({
        _id: s._id.toString(),
        organization: s.organization?.toString(),
        planName: s.planName,
        appStatus: s.appStatus,
        isPaymentConfirmed: s.isPaymentConfirmed,
        mandateStatus: s.mandateStatus,
        paymentStatus: s.paymentStatus,
        registrationLinkId: s.registrationLinkId,
        razorpaySubscriptionId: s.razorpaySubscriptionId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }, null, 2));
    });
  }

  console.log('\n=== Cross-check: mandateStatus=confirmed but paymentStatus != payment_completed (or vice versa) — a partial AND-gate ===');
  const partialGate = await Subscription.find({
    $or: [
      { mandateStatus: 'confirmed', paymentStatus: { $ne: 'payment_completed' } },
      { paymentStatus: 'payment_completed', mandateStatus: { $ne: 'confirmed' } },
    ],
  }).select('organization appStatus isPaymentConfirmed mandateStatus paymentStatus');
  if (partialGate.length === 0) {
    console.log('None found — the AND-gate has never been left half-satisfied.');
  } else {
    partialGate.forEach((s) => console.log(JSON.stringify({
      _id: s._id.toString(), organization: s.organization?.toString(),
      appStatus: s.appStatus, isPaymentConfirmed: s.isPaymentConfirmed,
      mandateStatus: s.mandateStatus, paymentStatus: s.paymentStatus,
    })));
  }

  console.log('\n=== Bug #2 residual check: orphaned \'reserved\' RewardUsage rows older than 35 minutes (past TTL, should have self-healed) ===');
  const staleReserved = await RewardUsage.find({
    status: 'reserved',
    expiresAt: { $lte: new Date(Date.now() - 5 * 60 * 1000) }, // expired 5+ min ago, TTL is 30 min
  });
  if (staleReserved.length === 0) {
    console.log('None found.');
  } else {
    staleReserved.forEach((u) => console.log(JSON.stringify({
      _id: u._id.toString(), reward: u.reward?.toString(), subscription: u.subscription?.toString(),
      context: u.context, expiresAt: u.expiresAt,
    })));
  }

  console.log('\n=== Duplicate SUBSCRIPTION_CREATED events per subscription (residual, should be zero going forward after the retry fix) ===');
  const dupes = await BillingEvent.aggregate([
    { $match: { eventType: 'SUBSCRIPTION_CREATED', subscription: { $ne: null } } },
    { $group: { _id: '$subscription', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  if (dupes.length === 0) {
    console.log('None found.');
  } else {
    dupes.forEach((d) => console.log(JSON.stringify({ subscription: d._id.toString(), count: d.count })));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
