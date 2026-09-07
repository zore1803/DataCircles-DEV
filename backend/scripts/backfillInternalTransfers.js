// Backfill: flag historical self-transfer payments, and collapse the
// duplicate "Self Transfer" vendor records the old path created.
//
// Background — a transfer between the organization's own accounts (bank to
// cash, wallet to bank) is recorded as TWO Payment rows: an OUT leg on the
// source and an IN leg on the destination. That is correct for the per-account
// balances, but the payments timeline counted both legs in Total Credit and
// Total Debit, so moving 50,000 between your own accounts added 50,000 to each
// even though no money entered or left the business.
//
// Payment.isInternalTransfer now marks those legs so the KPIs can skip them.
// Rows written before that field existed have nothing to identify them except
// the note text the old code always wrote ("Self Transfer to X" / "Self
// Transfer from X"), which is what this script matches on.
//
// The timeline applies the same note-text fallback at read time, so running
// this is not required for correct totals — it just makes the flag explicit in
// the data instead of re-deriving it on every request.
//
//   node scripts/backfillInternalTransfers.js            # report only
//   node scripts/backfillInternalTransfers.js --apply    # write changes

require("dotenv").config();
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Vendor = require("../models/Vendor");

const APPLY = process.argv.includes("--apply");
const NOTE_PATTERN = /^Self Transfer (to|from) /;
const money = (n) =>
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGO_URI is not set");
  await mongoose.connect(uri);
  console.log(APPLY ? "MODE: apply\n" : "MODE: dry run (pass --apply to write)\n");

  // --- 1. Flag the legs -----------------------------------------------------
  const candidates = await Payment.find({
    notes: { $regex: NOTE_PATTERN },
    isInternalTransfer: { $ne: true },
  }).lean();

  const inLegs = candidates.filter((p) => p.direction === "IN");
  const outLegs = candidates.filter((p) => p.direction === "OUT");
  const sum = (rows) => rows.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  console.log(`self-transfer legs missing the flag: ${candidates.length}`);
  console.log(`  IN  legs: ${inLegs.length}  (Total Credit overstated by ${money(sum(inLegs))})`);
  console.log(`  OUT legs: ${outLegs.length}  (Total Debit  overstated by ${money(sum(outLegs))})`);

  // A transfer should always have both legs. An odd count means one leg
  // failed to post (the two writes were never atomic) — worth surfacing,
  // since that IS a real one-sided movement rather than a paired transfer.
  const byOrg = {};
  for (const p of candidates) {
    const k = String(p.organization);
    byOrg[k] = byOrg[k] || { in: 0, out: 0 };
    byOrg[k][p.direction === "IN" ? "in" : "out"]++;
  }
  const lopsided = Object.entries(byOrg).filter(([, v]) => v.in !== v.out);
  if (lopsided.length) {
    console.log("\n  WARNING — orgs where the two legs don't pair up (a transfer half-posted):");
    for (const [org, v] of lopsided) {
      console.log(`    org ${org}: ${v.in} IN vs ${v.out} OUT`);
    }
  }

  if (APPLY && candidates.length) {
    const res = await Payment.updateMany(
      { notes: { $regex: NOTE_PATTERN }, isInternalTransfer: { $ne: true } },
      { $set: { isInternalTransfer: true } }
    );
    console.log(`\n  flagged ${res.modifiedCount} payment(s)`);
  }

  // --- 2. Collapse the duplicate placeholder vendors ------------------------
  // The old create path ran `new Vendor()` for every leg of every transfer,
  // so the vendor list accumulates one throwaway "Self Transfer" record per
  // leg. Keep the oldest per organization and repoint the rest.
  const placeholders = await Vendor.find({ name: "Self Transfer" }).sort({ createdAt: 1 }).lean();
  const keepByOrg = new Map();
  const redundant = [];
  for (const v of placeholders) {
    const org = String(v.organization);
    if (!keepByOrg.has(org)) keepByOrg.set(org, v);
    else redundant.push(v);
  }

  console.log(`\nplaceholder "Self Transfer" vendors: ${placeholders.length}`);
  console.log(`  keeping ${keepByOrg.size} (one per org), redundant: ${redundant.length}`);

  if (APPLY && redundant.length) {
    for (const v of redundant) {
      const keep = keepByOrg.get(String(v.organization));
      const moved = await Payment.updateMany(
        { vendor: v._id },
        { $set: { vendor: keep._id, party: keep._id } }
      );
      await Vendor.deleteOne({ _id: v._id });
      console.log(`  merged vendor ${v._id} -> ${keep._id} (${moved.modifiedCount} payment(s) repointed)`);
    }
  }

  console.log(APPLY ? "\ndone." : "\nnothing written — re-run with --apply");
  await mongoose.disconnect();
})().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
