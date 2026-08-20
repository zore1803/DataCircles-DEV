// controllers/journalController.js
//
// Basic Journal CRUD + Ledger read. Pay In / Pay Out write endpoints are
// intentionally NOT here yet — the JournalEntry model exists so the Ledger
// has something real to query, but nothing creates entries until that UI
// is built in a follow-up pass. See models/Journal.js / JournalEntry.js.
const Journal = require("../models/Journal");
const JournalEntry = require("../models/JournalEntry");

const toSignedBalance = (openingBalance, balanceType) => {
  const amt = Math.abs(Number(openingBalance) || 0);
  return balanceType === "Debit" ? -amt : amt;
};

// Create Journal
exports.createJournal = async (req, res) => {
  try {
    const { name, category, date, description, openingBalance, balanceType } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Journal name is required" });
    }

    const resolvedBalanceType = balanceType === "Credit" ? "Credit" : "Debit";
    const journal = await Journal.create({
      organization: req.user.organization,
      user: req.user._id,
      name: name.trim(),
      category: category || "",
      date: date || Date.now(),
      description: description || "",
      openingBalance: Math.abs(Number(openingBalance) || 0),
      balanceType: resolvedBalanceType,
      currentBalance: toSignedBalance(openingBalance, resolvedBalanceType),
    });

    res.status(201).json(journal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// List Journals for the user's organization
exports.getJournals = async (req, res) => {
  try {
    const { status, category, search, from, to } = req.query;

    const filter = { organization: req.user.organization };
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (search) {
      const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: re }, { category: re }, { description: re }];
    }
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const journals = await Journal.find(filter).sort({ createdAt: -1 });
    res.json(journals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single Journal
exports.getJournalById = async (req, res) => {
  try {
    const journal = await Journal.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!journal) return res.status(404).json({ error: "Journal not found" });
    res.json(journal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Journal (name/category/date/description/opening balance).
// Editing the opening balance re-derives currentBalance from it plus the
// net effect of every recorded entry, so an edit never silently discards
// Pay In/Pay Out history once that exists.
exports.updateJournal = async (req, res) => {
  try {
    const journal = await Journal.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!journal) return res.status(404).json({ error: "Journal not found or access denied" });

    const { name, category, date, description, openingBalance, balanceType, status } = req.body;

    if (name !== undefined) journal.name = name.trim();
    if (category !== undefined) journal.category = category;
    if (date !== undefined) journal.date = date;
    if (description !== undefined) journal.description = description;
    if (status !== undefined) journal.status = status;

    if (openingBalance !== undefined || balanceType !== undefined) {
      const nextBalanceType = balanceType !== undefined
        ? (balanceType === "Credit" ? "Credit" : "Debit")
        : journal.balanceType;
      const nextOpeningBalance = openingBalance !== undefined
        ? Math.abs(Number(openingBalance) || 0)
        : journal.openingBalance;

      const lastEntry = await JournalEntry.findOne({ journal: journal._id }).sort({ createdAt: -1 });
      const netFromEntries = lastEntry
        ? lastEntry.balanceAfter - toSignedBalance(journal.openingBalance, journal.balanceType)
        : 0;

      journal.openingBalance = nextOpeningBalance;
      journal.balanceType = nextBalanceType;
      journal.currentBalance = toSignedBalance(nextOpeningBalance, nextBalanceType) + netFromEntries;
    }

    await journal.save();
    res.json(journal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete Journal (and its ledger entries)
exports.deleteJournal = async (req, res) => {
  try {
    const journal = await Journal.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!journal) return res.status(404).json({ error: "Journal not found or access denied" });

    await JournalEntry.deleteMany({ journal: journal._id, organization: req.user.organization });

    res.json({ message: "Journal deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Ledger — the Opening Balance row is synthesized from the Journal itself
// (never stored as a JournalEntry), followed by every recorded entry in
// date order. Also returns the Credit/Debit/Net/Balance summary the
// Journals list's KPI strip needs, computed the same way client-side
// currently mocks it — done here so it's a single source of truth once
// Pay In/Pay Out start writing real entries.
exports.getJournalLedger = async (req, res) => {
  try {
    const journal = await Journal.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!journal) return res.status(404).json({ error: "Journal not found or access denied" });

    const entries = await JournalEntry.find({
      journal: journal._id,
      organization: req.user.organization,
    }).sort({ date: 1, createdAt: 1 });

    const openingSigned = toSignedBalance(journal.openingBalance, journal.balanceType);

    const rows = [
      {
        _id: `${journal._id}-opening`,
        date: journal.date,
        description: "Opening Balance",
        payIn: null,
        payOut: null,
        balance: openingSigned,
      },
      ...entries.map((e) => ({
        _id: e._id,
        date: e.date,
        description: e.partyName || (e.type === "payin" ? "Pay In" : "Pay Out"),
        payIn: e.type === "payin" ? e.amount : null,
        payOut: e.type === "payout" ? e.amount : null,
        balance: e.balanceAfter,
      })),
    ];

    const totalCredit = entries.filter((e) => e.type === "payin").reduce((sum, e) => sum + e.amount, 0);
    const totalDebit = entries.filter((e) => e.type === "payout").reduce((sum, e) => sum + e.amount, 0);

    res.json({
      journal,
      rows,
      summary: {
        credit: totalCredit,
        debit: totalDebit,
        net: totalCredit - totalDebit,
        balance: journal.currentBalance,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
