// models/SubmissionLock.js
// A short-lived mutual-exclusion token used to serialize concurrent form submissions that would
// resolve to the SAME CRM record.
//
// Why a lock and NOT a unique index on (organization, email):
//   1. Duplicates are a legitimate outcome here. "Keep Both Records" (duplicateResolutionService
//      .keepSeparate) deliberately creates a second Contact with the same email — a unique index
//      would permanently break that feature.
//   2. Ten (organization, email) groups in the live database already hold more than one Contact,
//      so the index could not be built without a data migration.
//   3. Contacts are also created by the authenticated CRM UI, where an org may intentionally keep
//      two people on one shared mailbox. A schema-wide constraint is far wider than the problem.
//
// The bug being fixed is not "duplicates exist" — it is that duplicate DETECTION reads before it
// writes, so simultaneous submissions each see an empty result and every one of them creates a
// record. Measured before this: 100 identical simultaneous submissions produced 94 Contacts and
// 85 Companies, with zero errors. Serializing just the read-decide-write section per dedupe key
// lets the second submission actually SEE the first and raise a review, which is the intended
// behaviour — without forbidding duplicates that a human deliberately asks for.
const mongoose = require("mongoose");
const { Schema } = mongoose;

const submissionLockSchema = new Schema({
  // `${organization}:${module}:${normalized dedupe value}` — see utils/dedupeLock.dedupeKeyFor.
  key: { type: String, required: true, unique: true },
  // TTL safety net so a crashed process cannot deadlock a key forever. The normal path deletes the
  // lock in a `finally`; Mongo's TTL monitor only sweeps about once a minute, so this is a backstop
  // for abnormal termination, never the mechanism the happy path relies on.
  createdAt: { type: Date, default: Date.now, expires: 60 },
});

module.exports = mongoose.model("SubmissionLock", submissionLockSchema);
