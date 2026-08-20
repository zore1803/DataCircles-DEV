// models/Journal.js
//
// Basic accounting Journal (e.g. "HDFC Bank", "Cash Counter", "Business
// Loan") — a named ledger the user can Pay In / Pay Out against. This is
// deliberately the simplest possible shape for the first pass: the user
// never enters Debit/Credit directly, only an opening balance + direction,
// and (later) Pay In/Pay Out actions. `currentBalance` is the single
// running balance shown on the Journals list and used as the starting
// point for the Ledger; it starts equal to the signed opening balance and
// will be adjusted by Pay In/Pay Out once that's built.
const mongoose = require("mongoose");

const JOURNAL_CATEGORIES = ["Bank", "Cash", "Loan", "Credit Card", "Petty Cash", "Other"];

const journalSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    name: { type: String, required: true, trim: true },
    category: { type: String, enum: [...JOURNAL_CATEGORIES, ""], default: "" },
    date: { type: Date, default: Date.now },
    description: { type: String, default: "" },

    // Opening balance is entered as an unsigned amount + explicit direction
    // (matching the quick-drawer's Debit/Credit toggle) so the user never
    // has to think in signed numbers. `currentBalance` is what's actually
    // displayed/used everywhere else, and is what Pay In/Pay Out will move.
    openingBalance: { type: Number, default: 0, min: 0 },
    balanceType: { type: String, enum: ["Debit", "Credit"], default: "Debit" },
    currentBalance: { type: Number, default: 0 },

    status: { type: String, enum: ["active", "cancelled"], default: "active" },
  },
  { timestamps: true }
);

journalSchema.index({ organization: 1, updatedAt: -1 });
journalSchema.index({ organization: 1, status: 1 });

journalSchema.statics.CATEGORIES = JOURNAL_CATEGORIES;

module.exports = mongoose.model("Journal", journalSchema);
