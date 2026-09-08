// utils/dedupeLock.js
// Serializes the read-decide-write section of duplicate detection for submissions that resolve to
// the same CRM record. See models/SubmissionLock.js for why this is a lock rather than a unique
// index.
const SubmissionLock = require("../models/SubmissionLock");

const MAX_ATTEMPTS = 20;
const BASE_DELAY_MS = 120;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalize(v) {
  return String(v || "").trim().toLowerCase();
}

function domainOf(website) {
  return normalize(website).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

/**
 * Purpose: Derive the key that two submissions must share for one to be a duplicate of the other.
 *   Deliberately mirrors what duplicateDetectionService actually matches on, strongest signal
 *   first — locking on a signal the detector ignores would serialize the wrong requests, and
 *   locking on nothing would leave the race open.
 * Inputs: organization, module ("Contact"|"Company"|"Vendor"), payload (CRM-schema-keyed)
 * Outputs: String key, or null when the payload carries no signal the detector could match on
 *   (in which case findDuplicates returns [] anyway and there is nothing to serialize).
 * Side effects: none
 */
function dedupeKeyFor(organization, module, payload) {
  if (!payload) return null;
  let signal = null;

  if (module === "Contact") {
    // findContactDuplicates matches on email alone.
    signal = normalize(payload.email);
  } else if (module === "Company") {
    // findCompanyDuplicates prefers gstin, then website domain, then falls back to name-only.
    signal = normalize(payload.gstin) || domainOf(payload.website) || normalize(payload.name);
  } else if (module === "Vendor") {
    signal = normalize(payload.gstin) || normalize(payload.name);
  }

  return signal ? `${organization}:${module}:${signal}` : null;
}

/**
 * Purpose: Run `fn` while holding an exclusive lock on `key`, so two concurrent submissions for the
 *   same record cannot both pass duplicate detection before either has written.
 * Inputs: key (String|null — null runs `fn` unlocked), fn (async () => T)
 * Outputs: Promise<T> — whatever `fn` returns
 * Side effects: one SubmissionLock insert and delete per call
 * Errors thrown: propagates anything `fn` throws (the lock is still released)
 * Known callers: submissionService.processModuleBucket, submissionService.handleRelatedCompany
 */
async function withDedupeLock(key, fn) {
  if (!key) return fn();

  let held = false;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      await SubmissionLock.create({ key });
      held = true;
      break;
    } catch (err) {
      // 11000 = duplicate key: someone else holds this key right now. Anything else is a real
      // failure and must not be swallowed into a silent unlocked run.
      if (err?.code !== 11000) throw err;
      // Jitter so a burst released at once doesn't immediately re-collide in lockstep.
      await sleep(BASE_DELAY_MS + Math.floor(Math.random() * BASE_DELAY_MS));
    }
  }

  // Contention outlasted the retry budget (~3s). Proceed WITHOUT the lock rather than rejecting:
  // losing a visitor's submission is a worse outcome than the duplicate this was guarding against,
  // and that duplicate still surfaces in the review queue for a human to resolve.
  if (!held) return fn();

  try {
    return await fn();
  } finally {
    // deleteOne rather than a TTL wait — the next queued submission should proceed immediately.
    await SubmissionLock.deleteOne({ key }).catch(() => {});
  }
}

module.exports = { dedupeKeyFor, withDedupeLock };
