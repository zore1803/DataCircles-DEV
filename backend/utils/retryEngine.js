// utils/retryEngine.js
//
// Retry Engine — Phase 4C Slice 1. Decides whether another renewal attempt
// should occur for ONE subscription and, if so, invokes the Renewal Engine
// exactly once. Not wired into any cron/scheduler — callable, not running.
//
// Step 0 (IMPLEMENTATION_PLAN_V1.md, Phase 4C): `retrying` is documentation
// shorthand, not a persisted Subscription.appStatus value. Subscription stays
// `past_due` throughout the retry window; retry progress lives on the
// existing `CommercialTransaction{type:'RENEWAL'}.attemptCount` field
// (already on the schema since Phase 1, reused here, not a new counter).
//
// Ownership, per BILLING_DOMAIN_SPECIFICATION.md Chapter 3.5 (line 841) and
// Chapter 9 (RT1/RT2): Retry Engine owns `past_due -> active` (on success)
// and decides retry eligibility/exhaustion. `past_due -> suspended` is a
// SEPARATE scheduler job (Chapter 7 Job 3, "Suspension") — exhausting
// retries here does not suspend anything; that's a different job's write,
// not built or touched by this file.
//
// Policy values, taken verbatim from CAW_BILLING_DESIGN.md §9, not invented:
//   maxAttempts = 3, retryIntervals = [24h, 72h, 120h] (offsets from the
//   first failure — this reading is not explicitly disambiguated in the
//   spec, flagged already in the Phase 4C design subsection; taken as given
//   here, not re-litigated).
//
// Does NOT duplicate pricing/invoice/BillingCycle/repair-forward/
// ScheduledChange logic — calls renewSubscription() exactly once and only
// interprets its returned outcome.

const { setAppStatus } = require('../controllers/subscriptionController');
const CommercialTransaction = require('../models/CommercialTransaction');
const { renewSubscription } = require('./renewalEngine');

const MAX_ATTEMPTS = 3;
const RETRY_INTERVALS_MS = [24, 72, 120].map((h) => h * 60 * 60 * 1000);

function mostRecentPastDueAt(subscription) {
  const history = subscription.appStatusHistory || [];
  const entries = history.filter((h) => h.to === 'past_due');
  if (entries.length === 0) return null;
  return entries.reduce((latest, e) => (e.at > latest ? e.at : latest), entries[0].at);
}

/**
 * @param {Object} params
 * @param {Object} params.subscription - a Subscription document, appStatus
 *   expected to be 'past_due' (checked here, not assumed by the caller).
 * @param {Function} params.chargeMandateFn - forwarded unchanged to
 *   renewSubscription() — same injected-charge contract as the Renewal Engine.
 * @returns {Promise<RetryResult>}
 */
async function retryRenewal({ subscription, chargeMandateFn }) {
  // Eligibility — Step 2. Only rules explicitly supported by the
  // specification; nothing invented.
  if (subscription.appStatus !== 'past_due') {
    return { outcome: 'NOT_ELIGIBLE', reason: 'NOT_PAST_DUE' };
  }

  const commercialTransaction = await CommercialTransaction.findOne({
    organization: subscription.organization,
    subscription: subscription._id,
    type: 'RENEWAL',
    status: 'PRICED', // the exact state Slice 3's PAST_DUE branch leaves it in
  });
  if (!commercialTransaction) {
    // No pending renewal transaction to resume — nothing for this engine to
    // act on (e.g. already resolved by a prior retry, or never a real
    // renewal failure in the first place).
    return { outcome: 'NOT_ELIGIBLE', reason: 'NO_PENDING_RENEWAL_TRANSACTION' };
  }

  const attemptsMade = commercialTransaction.attemptCount || 0;
  if (attemptsMade >= MAX_ATTEMPTS) {
    // Retries exhausted. Per Chapter 7, transitioning to `suspended` is
    // Scheduler Job 3's (Suspension's) responsibility, a separate job from
    // Retry — not performed here. appStatus is left as `past_due`.
    return { outcome: 'RETRIES_EXHAUSTED', attemptsMade };
  }

  const pastDueSince = mostRecentPastDueAt(subscription);
  if (!pastDueSince) {
    // Required data missing from today's schema/state — stop and report,
    // per the brief's explicit instruction, rather than guessing a fallback.
    return {
      outcome: 'NOT_ELIGIBLE',
      reason: 'MISSING_PAST_DUE_TIMESTAMP',
      note: 'appStatusHistory has no {to:"past_due"} entry — cannot compute the retry window without it.',
    };
  }

  const nextRetryAt = new Date(pastDueSince.getTime() + RETRY_INTERVALS_MS[attemptsMade]);
  const now = new Date();
  if (now < nextRetryAt) {
    return { outcome: 'NOT_YET_DUE', attemptsMade, nextRetryAt };
  }

  // Step 4 — retry bookkeeping owned by this engine: increment attemptCount
  // before attempting, reusing the existing field rather than adding a new one.
  commercialTransaction.attemptCount = attemptsMade + 1;
  commercialTransaction.lastAttemptAt = now;
  await commercialTransaction.save();

  // Step 3 — reuse the Renewal Engine exactly once. No duplicated pricing,
  // invoice, BillingCycle, or repair-forward logic — renewSubscription()
  // resumes the existing non-terminal transaction/invoice via its own
  // already-verified R13.5 logic (Slice 2); this engine only decided
  // whether/when to call it.
  const result = await renewSubscription(subscription, { chargeMandateFn });

  // Step 5 — outcome handling.
  if (result.outcome === 'RENEWED') {
    // Chapter 3.5 line 841 / RT1: Retry Engine owns past_due -> active on
    // retry success. renewSubscription() deliberately does not do this
    // itself (verified in Slice 3) — this is this engine's own write.
    setAppStatus(subscription, 'active', 'Retry succeeded');
    await subscription.save();
    return { outcome: 'RETRY_SUCCEEDED', attemptsMade: commercialTransaction.attemptCount };
  }

  if (result.outcome === 'PAST_DUE') {
    const newAttemptsMade = commercialTransaction.attemptCount;
    const retriesRemaining = Math.max(0, MAX_ATTEMPTS - newAttemptsMade);
    return {
      outcome: 'PAST_DUE',
      attemptsMade: newAttemptsMade,
      retriesRemaining,
      nextRetryAt: retriesRemaining > 0
        ? new Date(pastDueSince.getTime() + RETRY_INTERVALS_MS[newAttemptsMade])
        : null,
    };
  }

  // RECONCILIATION_NEEDED / SKIPPED — return immediately, do not retry
  // further, per Chapter 9 RT5/RT8's own reasoning (already applied inside
  // renewSubscription() itself; this engine just forwards the outcome
  // without interpreting or acting on it further).
  return result;
}

module.exports = { retryRenewal };
