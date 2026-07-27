// scripts/backfillCAWPeriodAndTrial.js
//
// One-time backfill for subscriptions that reached appStatus='active' via
// reconcileMandate BEFORE this session's two fixes (period-date
// initialization + trial cleanup) existed. Going forward, reconcileMandate
// handles both at activation time — this script only repairs the handful of
// subscriptions activated in the gap before that code existed.
//
// For each affected subscription:
//   - currentPeriodStart/currentPeriodEnd/nextBillingDate: initialized using
//     the REAL activation timestamp already recorded in appStatusHistory
//     (the `to: 'active'` entry's `at`), not "now" — this is more accurate
//     for a historical record than reconcileMandate's own live-activation
//     logic (which correctly uses "now" because for it, now IS the
//     activation moment).
//   - isTrialActive/trialEnd: same clearing reconcileMandate now does, using
//     that same historical timestamp for trialEnd instead of "now".
//
// Run with: CONFIRM_TEST_DB=yes node scripts/backfillCAWPeriodAndTrial.js
//           (add --apply to actually write; without it, DRY RUN only)

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Subscription = require('../models/Subscription');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error('❌ Refusing to run: this script MODIFIES documents. Set CONFIRM_TEST_DB=yes first.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

function computePeriodEnd(start, billingCycle) {
  const end = new Date(start);
  if (billingCycle === 'monthly') {
    end.setMonth(end.getMonth() + 1);
  } else {
    end.setFullYear(end.getFullYear() + 1);
  }
  return end;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected. Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no writes)'}\n`);

  // Only CAW subscriptions (mandateTokenId present) that are active but
  // missing period fields and/or still trial-flagged — the exact gap this
  // session's fixes close going forward.
  const affected = await Subscription.find({
    appStatus: 'active',
    mandateTokenId: { $exists: true, $ne: null },
    $or: [
      { currentPeriodStart: { $exists: false } },
      { currentPeriodStart: null },
      { isTrialActive: true },
    ],
  });

  console.log(`Found ${affected.length} affected subscription(s).\n`);

  for (const sub of affected) {
    const activatedEntry = (sub.appStatusHistory || [])
      .slice()
      .reverse()
      .find((h) => h.to === 'active');
    const activatedAt = activatedEntry?.at || sub.updatedAt || new Date();

    const changes = {};
    if (!sub.currentPeriodStart) {
      const periodEnd = computePeriodEnd(activatedAt, sub.billingCycle);
      changes.currentPeriodStart = activatedAt;
      changes.currentPeriodEnd = periodEnd;
      changes.nextBillingDate = periodEnd;
    }
    if (sub.isTrialActive) {
      changes.isTrialActive = false;
      changes.trialEnd = activatedAt;
    }

    console.log(`Subscription ${sub._id} (org ${sub.organization}):`);
    console.log(`  activatedAt (from appStatusHistory): ${activatedAt.toISOString()}`);
    console.log(`  changes: ${JSON.stringify(changes, null, 2)}`);

    if (APPLY) {
      Object.assign(sub, changes);
      await sub.save();
      console.log('  -> saved');
    } else {
      console.log('  -> DRY RUN, not saved (pass --apply to write)');
    }
    console.log('');
  }

  console.log(`Done. ${affected.length} subscription(s) ${APPLY ? 'updated' : 'would be updated (dry run)'}.`);
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('FAIL', e);
  await mongoose.disconnect();
  process.exit(1);
});
