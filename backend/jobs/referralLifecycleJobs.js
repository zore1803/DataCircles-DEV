// jobs/referralLifecycleJobs.js
//
// Wires up Referral's PENDING → EXPIRED transition, decided in
// BILLING_DOMAIN_SPECIFICATION.md ("Referral's `expired` state should
// actually be implemented after all" — revising the earlier "pending
// forever is fine" conclusion). A referral invitation that never qualifies
// stops meaningfully communicating "still expecting a future qualification"
// once its organization's referral program's configured expiry window has
// elapsed since it was created. This is invite-level expiry keyed off
// ReferralProgram.expiryDurationDays (per-organization config); a program
// with expiryDurationDays null/0 never expires its referrals, matching the
// field's existing "never expires" default semantics.
//
// This transition does not affect Reward at all — a Reward doesn't exist
// until a Referral reaches 'qualified'.

const cron = require('node-cron');
const Referral = require('../models/Referral');
const ReferralProgram = require('../models/ReferralProgram');

// Runs hourly — an invite-expiry sweep has no reason to run more often than
// the trial-reminder jobs in subscriptionLifecycleJobs.js.
cron.schedule('0 * * * *', async () => {
  try {
    const programs = await ReferralProgram.find({
      expiryDurationDays: { $ne: null, $gt: 0 },
    });

    for (const program of programs) {
      const cutoff = new Date(Date.now() - program.expiryDurationDays * 24 * 60 * 60 * 1000);

      const result = await Referral.updateMany(
        {
          referrerOrganization: program.organization,
          status: 'pending',
          createdAt: { $lt: cutoff },
        },
        { $set: { status: 'expired' } }
      );

      if (result.modifiedCount > 0) {
        console.log(
          `[referralLifecycleJobs] Expired ${result.modifiedCount} pending referral(s) for org ${program.organization}`
        );
      }
    }
  } catch (err) {
    console.error('[referralLifecycleJobs] Referral expiry job error:', err);
  }
});

module.exports = {};
