// scripts/checkScheduledChangeDuplicates.js
//
// Pre-deploy safety check for Edit 8's partial unique indexes on
// ScheduledChange ({subscription:1}, unique, partialFilterExpression:
// {status:'PENDING', type: t}) for t in PLAN_CHANGE/BILLING_CYCLE_CHANGE/
// CANCELLATION. Same pattern as the earlier BUG-002 (Subscription) and
// CommercialTransaction partial-index pre-checks: group by the columns the
// index covers, filter for count > 1, report violations.
//
// READ-ONLY. Zero writes — no .create/.save/.updateOne/.deleteOne calls
// anywhere in this file. Safe to run directly against production. Kept as
// its own script, separate from verifyScheduledChangeRenewal.js (which
// writes and deletes disposable documents), specifically so a script meant
// for real data can never be confused with one meant for a test database.
//
// Run with: MONGO_URI=<real db> node scripts/checkScheduledChangeDuplicates.js
// Exits 1 if any violation is found (index creation would fail), 0 otherwise.

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const ScheduledChange = require('../models/ScheduledChange');

const INDEXED_TYPES = ['PLAN_CHANGE', 'BILLING_CYCLE_CHANGE', 'CANCELLATION'];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected (read-only check)');
  console.log(`Checking for PENDING ScheduledChange duplicates per (subscription, type) for: ${INDEXED_TYPES.join(', ')}\n`);

  const violations = await ScheduledChange.aggregate([
    { $match: { status: 'PENDING', type: { $in: INDEXED_TYPES } } },
    { $group: { _id: { subscription: '$subscription', type: '$type' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (violations.length === 0) {
    console.log('✅ Zero violations. Index creation for Edit 8 should succeed cleanly.');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.error(`❌ Found ${violations.length} (subscription, type) pair(s) with more than one PENDING record:`);
  for (const v of violations) {
    console.error(
      `  subscription=${v._id.subscription} type=${v._id.type} count=${v.count} ids=[${v.ids.join(', ')}]`
    );
  }
  console.error('\nIndex creation will fail against this data. Report this — do not force it through.');
  await mongoose.disconnect();
  process.exit(1);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
