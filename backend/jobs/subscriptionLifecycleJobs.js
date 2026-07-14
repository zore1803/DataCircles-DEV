// jobs/subscriptionLifecycleJobs.js
//
// Single source of truth for all subscription-related cron jobs.
// Replaces jobs/subscriptionJobs.js and utils/trialExpiryJob.js — both
// of those files are deleted; this one supersedes them entirely.
//
// Covers:
//   1. Trial ending reminders (48h and 24h before trialEnd) — emails only,
//      no status change.
//   2. Trial expiry (trialEnd has passed) — status change to 'expired'
//      AND sends the trial-expired email.
//   3. Scheduled cancellations taking effect at period end — status
//      change to 'cancelled' (no email yet; deferred per project decision
//      to handle Razorpay-triggered email notifications later).
//
// Mount once in server.js:  require('./jobs/subscriptionLifecycleJobs');

const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { setAppStatus } = require('../controllers/subscriptionController');
const {
  sendTrialEndingEmail,
  sendTrialExpiredEmail,
} = require('../utils/trialEmails');
const { emitBillingEvent } = require('../utils/billingEvents');

const HOUR_MS = 60 * 60 * 1000;

// Finds the admin/creator user for an organization to email. Since a
// trial is started by whoever signed up (the org creator, role: 'admin'),
// emailing the first admin found is the right target — there's no
// separate "subscription owner" concept in this codebase to look up instead.
async function getOrgAdminUser(organizationId) {
  return User.findOne({ organization: organizationId, role: 'admin' });
}

// ------------------------------------------------------------------
// Job 1: Trial ending reminders (48h and 24h before trialEnd)
// Runs every hour. Each subscription gets each reminder AT MOST ONCE,
// tracked via trialReminder48hSent / trialReminder24hSent flags.
// ------------------------------------------------------------------
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();

    const window48hStart = new Date(now.getTime() + 47 * HOUR_MS);
    const window48hEnd = new Date(now.getTime() + 49 * HOUR_MS);

    const needs48hReminder = await Subscription.find({
      appStatus: 'trial',
      trialEnd: { $gte: window48hStart, $lte: window48hEnd },
      trialReminder48hSent: { $ne: true },
    });

    for (const subscription of needs48hReminder) {
      try {
        const user = await getOrgAdminUser(subscription.organization);
        const organization = await Organization.findById(subscription.organization);
        if (user) {
          await sendTrialEndingEmail(user, organization, subscription.trialEnd, 48);
        }
        subscription.trialReminder48hSent = true;
        await subscription.save();
        console.log(`[subscriptionLifecycleJobs] Sent 48h reminder for org ${subscription.organization}`);
      } catch (err) {
        console.error(`[subscriptionLifecycleJobs] Failed 48h reminder for org ${subscription.organization}:`, err);
      }
    }

    const window24hStart = new Date(now.getTime() + 23 * HOUR_MS);
    const window24hEnd = new Date(now.getTime() + 25 * HOUR_MS);

    const needs24hReminder = await Subscription.find({
      appStatus: 'trial',
      trialEnd: { $gte: window24hStart, $lte: window24hEnd },
      trialReminder24hSent: { $ne: true },
    });

    for (const subscription of needs24hReminder) {
      try {
        const user = await getOrgAdminUser(subscription.organization);
        const organization = await Organization.findById(subscription.organization);
        if (user) {
          await sendTrialEndingEmail(user, organization, subscription.trialEnd, 24);
        }
        subscription.trialReminder24hSent = true;
        await subscription.save();
        console.log(`[subscriptionLifecycleJobs] Sent 24h reminder for org ${subscription.organization}`);
      } catch (err) {
        console.error(`[subscriptionLifecycleJobs] Failed 24h reminder for org ${subscription.organization}:`, err);
      }
    }
  } catch (err) {
    console.error('[subscriptionLifecycleJobs] Trial reminder job error:', err);
  }
});

// ------------------------------------------------------------------
// Job 2: Trial expiry — status change + expired email
// ------------------------------------------------------------------
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();

    const expiredTrials = await Subscription.find({
      appStatus: 'trial',
      trialEnd: { $lt: now },
    });

    console.log(`[subscriptionLifecycleJobs] Trial expiry check: found ${expiredTrials.length} expired trial(s)`);

    for (const subscription of expiredTrials) {
      try {
        subscription.isTrialActive = false;
        setAppStatus(subscription, 'expired', 'trial period ended (cron)');
        await subscription.save();

        await emitBillingEvent({
          organization: subscription.organization,
          subscription: subscription._id,
          eventType: 'TRIAL_ENDED',
          status: 'completed',
          after: subscription,
        });

        const user = await getOrgAdminUser(subscription.organization);
        const organization = await Organization.findById(subscription.organization);
        if (user) {
          await sendTrialExpiredEmail(user, organization);
        }

        console.log(`[subscriptionLifecycleJobs] Expired trial for org ${subscription.organization}`);
      } catch (err) {
        console.error(`[subscriptionLifecycleJobs] Failed to expire trial for org ${subscription.organization}:`, err);
      }
    }
  } catch (err) {
    console.error('[subscriptionLifecycleJobs] Trial expiry job error:', err);
  }
});

// ------------------------------------------------------------------
// Job 3: Scheduled cancellations taking effect at period end
// (No email yet — Razorpay-triggered email notifications are deferred
// until that flow is tested properly, per project decision.)
// ------------------------------------------------------------------
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();

    const subscriptionsToFinalize = await Subscription.find({
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { $lt: now },
      appStatus: { $in: ['active', 'past_due'] },
    });

    console.log(`[subscriptionLifecycleJobs] Period-end check: found ${subscriptionsToFinalize.length} subscription(s) to finalize cancellation`);

    for (const subscription of subscriptionsToFinalize) {
      subscription.cancelledAt = subscription.cancelledAt || now;
      setAppStatus(subscription, 'cancelled', 'scheduled cancellation took effect at period end (cron)');
      await subscription.save();

      await emitBillingEvent({
        organization: subscription.organization,
        subscription: subscription._id,
        eventType: 'SUBSCRIPTION_CANCELLED',
        status: 'completed',
        after: subscription,
      });

      console.log(`[subscriptionLifecycleJobs] Finalized cancellation for org ${subscription.organization}`);
    }
  } catch (err) {
    console.error('[subscriptionLifecycleJobs] Period-end cancellation job error:', err);
  }
});

module.exports = {};
