// scripts/backfillMissingBillingPeriod.js
//
// One-time migration for CAW subscriptions activated before the
// reconcileMandate() fix (subscriptionController.js) that initializes
// currentPeriodStart/currentPeriodEnd/nextBillingDate at activation.
// Without this, any proration calculation (upgrade, add-on purchase)
// throws "subscription billing period not initialized" (invoiceEngine.js's
// new guard) instead of silently producing NaN and a misleading Razorpay
// "amount is required" error.
//
// Uses the FIRST appStatusHistory entry transitioning to 'active' as the
// activation timestamp when available (more accurate than createdAt, which
// can predate actual payment by however long the mandate took to confirm).
// Falls back to createdAt otherwise.
//
// DRY RUN by default — prints what it WOULD change. Pass --apply to write.
//
// Run with: node scripts/backfillMissingBillingPeriod.js [--apply]

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Subscription = require('../models/Subscription');
const { addBillingCycle } = require('../utils/renewalEngine');

const apply = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(apply ? 'Running in APPLY mode — will write changes.' : 'Running in DRY RUN mode — pass --apply to write.');

  const broken = await Subscription.find({
    appStatus: { $in: ['trial', 'active', 'past_due'] },
    $or: [
      { currentPeriodStart: { $exists: false } },
      { currentPeriodStart: null },
      { currentPeriodEnd: { $exists: false } },
      { currentPeriodEnd: null },
    ],
  });

  console.log(`Found ${broken.length} subscription(s) with a missing billing period.\n`);

  for (const sub of broken) {
    const activationEntry = (sub.appStatusHistory || []).find((h) => h.to === 'active');
    const activatedAt = activationEntry?.at || sub.createdAt || new Date();
    const periodEnd = addBillingCycle(activatedAt, sub.billingCycle || 'monthly');

    console.log(`Subscription ${sub._id} (org ${sub.organization}):`);
    console.log(`  currentPeriodStart -> ${activatedAt.toISOString()} (source: ${activationEntry ? 'appStatusHistory' : 'createdAt'})`);
    console.log(`  currentPeriodEnd   -> ${periodEnd.toISOString()}`);
    console.log(`  nextBillingDate    -> ${periodEnd.toISOString()}`);

    if (apply) {
      sub.currentPeriodStart = activatedAt;
      sub.currentPeriodEnd = periodEnd;
      sub.nextBillingDate = periodEnd;
      await sub.save();
      console.log('  -> saved.');
    }
    console.log('');
  }

  console.log(apply ? 'Done — changes written.' : 'Dry run complete — re-run with --apply to write these changes.');
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('FATAL', e);
  await mongoose.disconnect();
  process.exit(1);
});
