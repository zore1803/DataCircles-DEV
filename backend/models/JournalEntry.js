// models/JournalEntry.js
//
// One row of a Journal's Ledger. "opening" is synthesized from the Journal
// document itself (see journalController.getJournalLedger) rather than
// stored here — this collection only holds transactions recorded AFTER
// creation. Nothing writes "payin"/"payout" entries yet (that UI lands in
// a follow-up pass); the schema exists now so the Ledger endpoint has a
// real query to run against from day one instead of needing a migration
// later.
const mongoose = require("mongoose");

const journalEntrySchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    journal: { type: mongoose.Schema.Types.ObjectId, ref: "Journal", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    type: { type: String, enum: ["payin", "payout"], required: true },
    date: { type: Date, default: Date.now },

    // Loose by design — Customer/Vendor picker isn't wired up yet, so this
    // just carries whatever label the Pay In/Pay Out form collects.
    partyType: { type: String, enum: ["Customer", "Vendor", ""], default: "" },
    partyName: { type: String, default: "" },

    amount: { type: Number, required: true, min: 0 },
    paymentType: { type: String, default: "" }, // UPI / Cash / Card / Net Banking / Cheque / EMI
    bank: { type: String, default: "" },
    referenceId: { type: String, default: "" }, // UTR / payment reference
    notes: { type: String, default: "" },
    internalNotes: { type: String, default: "" },

    // Running balance of the parent Journal immediately after this entry —
    // stored (not recomputed) so the Ledger can render instantly without
    // replaying every prior entry.
    balanceAfter: { type: Number, required: true },

    isClosingEntry: { type: Boolean, default: false },
  },
  { timestamps: true }
);

journalEntrySchema.index({ organization: 1, journal: 1, date: 1 });

module.exports = mongoose.model("JournalEntry", journalEntrySchema);
