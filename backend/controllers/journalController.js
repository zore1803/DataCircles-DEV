// controllers/journalController.js
//
// Basic Journal CRUD + Ledger read/write. See models/Journal.js / JournalEntry.js.
const mongoose = require("mongoose");
const Journal = require("../models/Journal");
const JournalEntry = require("../models/JournalEntry");

const toSignedBalance = (openingBalance, balanceType) => {
  const amt = Math.abs(Number(openingBalance) || 0);
  return balanceType === "Debit" ? -amt : amt;
};

// The ledger is CHRONOLOGICAL by the entry's own `date` (which the user may set
// to any day — before the journal was created, or in the future), with
// `createdAt` only as a tie-breaker for same-day entries. Because a back-dated
// entry lands in the middle of history, every entry's stored `balanceAfter` and
// the journal's `currentBalance` are rebuilt from the opening balance on every
// insert / delete / close, so the running balance always reconciles.
const replayJournalBalances = async (journal, session) => {
  const query = JournalEntry.find({ journal: journal._id }).sort({ date: 1, createdAt: 1, _id: 1 });
  if (session) query.session(session);
  const entries = await query;

  let running = toSignedBalance(journal.openingBalance, journal.balanceType);
  for (const entry of entries) {
    running += entry.type === "payin" ? entry.amount : -entry.amount;
    if (entry.balanceAfter !== running) {
      entry.balanceAfter = running;
      await entry.save(session ? { session } : undefined);
    }
  }

  journal.currentBalance = running;
  await journal.save(session ? { session } : undefined);
  return running;
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

    // Sorted by last activity: recording a Pay In / Pay Out saves the parent
    // Journal (bumping updatedAt), so the account that just had a transaction
    // rises to the top of the list. Falls back to createdAt for journals that
    // have never been touched since creation.
    const journals = await Journal.find(filter).sort({ updatedAt: -1, createdAt: -1 });
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

      journal.openingBalance = nextOpeningBalance;
      journal.balanceType = nextBalanceType;
      // Re-derive currentBalance (and every entry's balanceAfter) from the new
      // opening balance plus the chronological Pay In/Pay Out history.
      await replayJournalBalances(journal);
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

// Pay In / Pay Out — appends one signed JournalEntry and moves the Journal's
// currentBalance by it in the same transaction, so the two can never drift
// apart. Direction is entirely determined by the caller's `type` (set by
// which button the user clicked) — there is no separate Credit/Debit choice
// on the form itself, matching how openingBalance already works.
exports.addJournalEntry = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { type, date, partyType, partyName, amount, paymentType, bank, referenceId, notes, internalNotes } = req.body;

    if (type !== "payin" && type !== "payout") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "type must be 'payin' or 'payout'" });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Amount must be a number greater than zero" });
    }

    const journal = await Journal.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).session(session);

    if (!journal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Journal not found or access denied" });
    }

    if (journal.status === "cancelled") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Cannot record a transaction against a cancelled journal" });
    }

    // `date` is whatever the user picked — any past date (even before the
    // journal's own creation date) or a future date is allowed. The final
    // balanceAfter is written by the replay below, which slots this entry into
    // its chronological position; the value here is just a provisional seed.
    const [entry] = await JournalEntry.create(
      [
        {
          organization: req.user.organization,
          journal: journal._id,
          user: req.user._id,
          type,
          date: date ? new Date(date) : new Date(),
          partyType: partyType || "",
          partyName: partyName || "",
          amount: parsedAmount,
          paymentType: paymentType || "",
          bank: bank || "",
          referenceId: referenceId || "",
          notes: notes || "",
          internalNotes: internalNotes || "",
          balanceAfter: 0,
        },
      ],
      { session }
    );

    // Rebuild every entry's running balance in date order (the new one may be
    // back-dated into the middle of the ledger) and refresh journal.currentBalance.
    await replayJournalBalances(journal, session);

    await session.commitTransaction();
    session.endSession();

    const savedEntry = await JournalEntry.findById(entry._id);
    res.status(201).json({ entry: savedEntry, journal });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ error: err.message });
  }
};

// Delete one Pay In / Pay Out entry. Every later entry's stored balanceAfter
// is recomputed by replaying from the opening balance, since removing an
// entry from the middle of the ledger shifts every running total after it —
// and the Journal's own currentBalance is reset to match the new last row
// (or the opening balance, if that was the only entry).
exports.deleteJournalEntry = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const journal = await Journal.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).session(session);

    if (!journal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Journal not found or access denied" });
    }

    if (journal.status === "cancelled") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Cannot delete entries from a cancelled journal" });
    }

    const target = await JournalEntry.findOne({
      _id: req.params.entryId,
      journal: journal._id,
      organization: req.user.organization,
    }).session(session);

    if (!target) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Entry not found" });
    }

    if (target.isClosingEntry) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Cannot manually delete a closing settlement entry" });
    }

    await target.deleteOne({ session });

    // Removing an entry shifts every later running total — rebuild them (and
    // journal.currentBalance) in chronological date order.
    await replayJournalBalances(journal, session);

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Entry deleted successfully", journal });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
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

    // Chronological by the entry's own `date` (any past/future date is allowed),
    // with createdAt/_id breaking same-day ties. balanceAfter is kept in sync
    // with this order by replayJournalBalances on every write.
    const entries = await JournalEntry.find({
      journal: journal._id,
      organization: req.user.organization,
    }).sort({ date: 1, createdAt: 1, _id: 1 });

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
        createdAt: e.createdAt,
        type: e.type,
        partyName: e.partyName,
        partyType: e.partyType,
        paymentType: e.paymentType,
        amount: e.amount,
        notes: e.notes || e.internalNotes || "",
        description: e.partyName || (e.type === "payin" ? "Pay In" : "Pay Out"),
        payIn: e.type === "payin" ? e.amount : null,
        payOut: e.type === "payout" ? e.amount : null,
        balance: e.balanceAfter,
        isClosingEntry: e.isClosingEntry || false,
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

// Close Journal — Injects a closing settlement entry to zero the balance,
// saves that state to `closingBalance`, and marks it `settled`.
exports.closeJournal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const journal = await Journal.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).session(session);

    if (!journal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Journal not found or access denied" });
    }

    if (journal.status === "settled") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Journal is already settled" });
    }
    if (journal.status === "cancelled") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Cannot close a cancelled journal" });
    }

    // Make sure currentBalance reflects the chronological ledger before we size
    // the settlement entry against it.
    await replayJournalBalances(journal, session);

    const currentBalance = journal.currentBalance;
    journal.closingBalance = currentBalance;

    if (currentBalance !== 0) {
      // If we are in profit (balance > 0), the settlement is taking money out -> payout
      // If we are in debt (balance < 0), the settlement is putting money in -> payin
      const settlementType = currentBalance > 0 ? "payout" : "payin";
      const settlementAmount = Math.abs(currentBalance);

      await JournalEntry.create(
        [
          {
            organization: req.user.organization,
            journal: journal._id,
            user: req.user._id,
            type: settlementType,
            date: new Date(),
            amount: settlementAmount,
            notes: "Account Closed - Final Settlement",
            isClosingEntry: true,
            balanceAfter: 0,
          },
        ],
        { session }
      );

      journal.currentBalance = 0;
    }

    journal.status = "settled";
    await journal.save({ session });

    await session.commitTransaction();
    session.endSession();
    res.json(journal);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: err.message });
  }
};

// Cancel Journal — simply marks it `cancelled` without a settlement entry.
exports.cancelJournal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const journal = await Journal.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).session(session);

    if (!journal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Journal not found or access denied" });
    }

    if (journal.status === "cancelled") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Journal is already cancelled" });
    }
    if (journal.status === "settled") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Cannot cancel a settled journal" });
    }

    journal.status = "cancelled";
    await journal.save({ session });

    await session.commitTransaction();
    session.endSession();
    res.json(journal);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: err.message });
  }
};

exports.reopenJournal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const journal = await Journal.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).session(session);

    if (!journal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Journal not found or access denied" });
    }

    if (journal.status !== "cancelled" && journal.status !== "settled") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Only cancelled or settled journals can be reopened" });
    }

    // Find and delete the closing entry if it exists. Fetched first (rather
    // than a filter-based deleteOne) so the change-notifier plugin's
    // document-level delete hook fires with a real record to label.
    const closingEntry = await JournalEntry.findOne({
      journal: journal._id,
      isClosingEntry: true
    }).session(session);
    if (closingEntry) {
      await closingEntry.deleteOne({ session });
    }

    // Rebuild the running balances in chronological date order now the closing
    // entry is gone.
    await replayJournalBalances(journal, session);

    journal.closingBalance = null;
    journal.status = "active";
    await journal.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Journal reopened successfully", journal });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: err.message });
  }
};
