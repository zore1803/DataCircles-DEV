// jobs/billingOrchestration.js
//
// Phase 4D Slice 1 — orchestration layer for the Renewal/Retry Engines.
// CALLABLE ONLY. Not registered with node-cron, not required by server.js,
// not scheduled anywhere. Contrast with jobs/subscriptionLifecycleJobs.js,
// which self-registers three `cron.schedule(...)` jobs at require-time —
// deliberately NOT the pattern here; this file exports plain functions the
// caller decides when (or whether) to invoke.
//
// These functions contain NO billing logic of their own — they only select
// which subscriptions are candidates and call the already-built, already-
// verified engines (renewSubscription/retryRenewal) once per subscription,
// isolating one subscription's failure from the rest of the batch.

const Subscription = require('../models/Subscription');
const { renewSubscription } = require('../utils/renewalEngine');
const { retryRenewal } = require('../utils/retryEngine');

/**
 * Renewal orchestration. Finds CAW subscriptions due today.
 * renewSubscription() now applies any due ScheduledChange records itself
 * (Phase 4E) — a subscription with a PENDING change is no longer excluded;
 * it's the normal case this orchestration layer passes through unchanged.
 * Does not retry a failure — a PAST_DUE outcome is simply recorded, per the
 * hard constraint (Retry Engine's job).
 *
 * @param {Object} params
 * @param {Function} params.chargeMandateFn - forwarded unchanged to
 *   renewSubscription() for every subscription in this batch.
 * @param {Date} [params.now] - injectable for fixture-based verification;
 *   defaults to real `new Date()`.
 * @returns {Promise<Array<{subscriptionId, outcome?, error?}>>}
 */
async function runRenewalJob({ chargeMandateFn, now = new Date() } = {}) {
  const dueSubscriptions = await Subscription.find({
    appStatus: 'active',
    mandateTokenId: { $ne: null },
    nextBillingDate: { $lte: now },
  });

  const results = [];
  for (const subscription of dueSubscriptions) {
    try {
      const outcome = await renewSubscription(subscription, { chargeMandateFn });
      results.push({ subscriptionId: subscription._id, outcome: outcome.outcome, detail: outcome });
    } catch (err) {
      // Error isolation — one subscription throwing must never stop the
      // batch. Logged with subscription context, not just a bare message.
      console.error(`[billingOrchestration] runRenewalJob failed for subscription=${subscription._id}:`, err.message);
      results.push({ subscriptionId: subscription._id, error: err.message });
    }
  }
  return results;
}

/**
 * Retry orchestration. Finds every `past_due` subscription and calls
 * retryRenewal() once each. Retry Engine owns all retry policy (eligibility,
 * cadence, exhaustion) — this function owns iteration only, nothing else.
 *
 * @param {Object} params
 * @param {Function} params.chargeMandateFn - forwarded unchanged to
 *   retryRenewal() for every subscription in this batch.
 * @returns {Promise<Array<{subscriptionId, outcome?, error?}>>}
 */
async function runRetryJob({ chargeMandateFn } = {}) {
  const pastDueSubscriptions = await Subscription.find({ appStatus: 'past_due' });

  const results = [];
  for (const subscription of pastDueSubscriptions) {
    try {
      const outcome = await retryRenewal({ subscription, chargeMandateFn });
      results.push({ subscriptionId: subscription._id, outcome: outcome.outcome, detail: outcome });
    } catch (err) {
      console.error(`[billingOrchestration] runRetryJob failed for subscription=${subscription._id}:`, err.message);
      results.push({ subscriptionId: subscription._id, error: err.message });
    }
  }
  return results;
}

/**
 * Suspension orchestration — NOT implemented. Chapter 7's Scheduler Job 3
 * ("Suspension") is a separate responsibility from Retry (Job 2) — finding
 * subscriptions whose grace period has elapsed and transitioning them to
 * `suspended`. Stubbed explicitly, rather than left absent, so ownership of
 * this still-unbuilt piece stays visible rather than silently missing.
 */
async function runSuspensionJob() {
  throw new Error('runSuspensionJob() not implemented — Chapter 7 Scheduler Job 3 (Suspension) is a separate, not-yet-built responsibility. See IMPLEMENTATION_PLAN_V1.md Phase 4D.');
}

module.exports = { runRenewalJob, runRetryJob, runSuspensionJob };
