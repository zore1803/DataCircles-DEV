// Payment allocation engine.
//
// One payment (a receipt from a customer, or a payment made to a vendor) is
// split across one or more open documents. Credit/IN payments settle
// Invoices; Debit/OUT payments settle Purchase bills. The two directions run
// through the exact same code path — only the model and its total field
// differ, which is what DOC_CONFIG below captures.
//
// Design note: allocating pushes a real subdocument into the target
// document's own `payments[]` array, the same array
// invoiceController.addInvoicePayment / purchaseController.addPurchasePayment
// write to. That's deliberate — every Paid/Pending figure in the app is
// already computed from that array, so allocations show up everywhere with
// no other file needing to change. The PaymentAllocation row alongside it is
// the link back to the parent Payment, and holds the subdoc's _id so the push
// can be undone.

const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const Purchase = require("../models/Purchase");
const Deal = require("../models/Deal");
const Payment = require("../models/Payment");
const PaymentAllocation = require("../models/PaymentAllocation");
// Payment.party is a refPath pointing at one of these three, so mongoose has
// to have all three registered before it can populate it. Required here
// rather than left to whatever else happened to load first — a script or job
// that only pulls in this service would otherwise fail on
// MissingSchemaError.
require("../models/Company");
require("../models/Contact");
require("../models/Vendor");

// Money comparisons use a 1-paisa tolerance throughout, matching the existing
// controllers (`amountDue + 0.01`).
const EPSILON = 0.01;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const sumPayments = (payments) =>
  (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

// Payment.paymentType and the documents' payments[].paymentMethod are
// different enums: paymentType is a subset (Card/Cash/Cheque/EMI/Net
// Banking/UPI) of paymentMethod (which adds NEFT/RTGS/IMPS/TDS/Other), so
// every paymentType is already a valid paymentMethod. Anything unrecognised
// falls back to "Other" rather than failing the subdoc's enum validation.
const VALID_METHODS = new Set([
  "Cash", "UPI", "Net Banking", "Cheque", "Card",
  "NEFT", "RTGS", "IMPS", "EMI", "TDS", "Other",
]);
const toPaymentMethod = (paymentType) =>
  VALID_METHODS.has(paymentType) ? paymentType : "Other";

// Per-document-type differences, so allocate()/reverse() stay direction-blind.
const DOC_CONFIG = {
  Invoice: {
    model: Invoice,
    direction: "IN",
    // Invoice.amount is the document total; Purchase uses grandTotal.
    totalOf: (doc) => Number(doc.amount) || 0,
    numberOf: (doc) => doc.invoiceNumber,
    dateOf: (doc) => doc.date || doc.createdAt,
    // Mirrors invoiceController.addInvoicePayment's status transitions.
    statusFor: (doc, totalPaid) => {
      const total = Number(doc.amount) || 0;
      if (totalPaid >= total - EPSILON) return "Paid";
      if (totalPaid > 0) return "Partially Paid";
      return doc.status;
    },
  },
  Purchase: {
    model: Purchase,
    direction: "OUT",
    totalOf: (doc) => Number(doc.grandTotal || doc.subtotal) || 0,
    numberOf: (doc) => doc.purchaseNumber,
    dateOf: (doc) => doc.purchaseDate || doc.createdAt,
    // Mirrors purchaseController.statusForPaidAmount, including the terminal
    // Cancelled rule and Draft-stays-Draft-at-zero.
    statusFor: (doc, totalPaid) => {
      if (doc.status === "Cancelled") return doc.status;
      const total = Number(doc.grandTotal) || 0;
      if (totalPaid >= total - EPSILON && total > 0) return "Paid";
      if (totalPaid > 0) return "Partial";
      return doc.status === "Draft" ? "Draft" : "Pending";
    },
  },
};

const docTypeForDirection = (direction) =>
  direction === "IN" ? "Invoice" : "Purchase";

// ---------------------------------------------------------------------------
// Reading open documents
// ---------------------------------------------------------------------------

// Invoices belong to a Deal, and the Deal is what carries the customer
// (company or contact) — there is no direct Invoice to Company link. So for a
// customer we resolve their deals first, then the invoices on those deals.
async function invoiceQueryForParty(orgId, partyType, partyId) {
  const dealFilter = { organization: orgId };
  if (partyType === "Company") dealFilter.company = partyId;
  else if (partyType === "Contact") dealFilter.contact = partyId;
  else return null;

  const deals = await Deal.find(dealFilter).select("_id").lean();
  return { organization: orgId, deal: { $in: deals.map((d) => d._id) } };
}

// Every not-fully-settled document for this party, with how much each one
// still owes. Cancelled purchases are excluded — they cannot be paid — but
// nothing else is filtered on status: an invoice sitting at "Draft" that
// carries a real balance is still a legitimate allocation target, and status
// strings vary too much across the app to be trusted as the source of truth.
// The money is.
async function getOpenDocuments({ orgId, direction, partyType, partyId }) {
  const documentType = docTypeForDirection(direction);
  const cfg = DOC_CONFIG[documentType];

  let filter;
  if (documentType === "Invoice") {
    filter = await invoiceQueryForParty(orgId, partyType, partyId);
    if (!filter) return { documentType, documents: [] };
  } else {
    filter = { organization: orgId, vendor: partyId, status: { $ne: "Cancelled" } };
  }

  const docs = await cfg.model.find(filter).lean();

  const documents = docs
    .map((doc) => {
      const total = round2(cfg.totalOf(doc));
      const paid = round2(sumPayments(doc.payments));
      const due = round2(total - paid);
      return {
        _id: doc._id,
        documentType,
        number: cfg.numberOf(doc) || "",
        date: cfg.dateOf(doc),
        dueDate: doc.dueDate || null,
        status: doc.status,
        total,
        paid,
        due,
      };
    })
    .filter((d) => d.due > EPSILON)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return { documentType, documents };
}

// Every open document in the org, whoever it belongs to, each tagged with its
// party name. Credit is the organization's money once received, so it can
// settle ANY customer's invoice — which means the natural way to find the
// target is to search invoices directly (by number, or by the company on
// them) rather than to pick a party first and drill in.
async function getAllOpenDocuments({ orgId, direction }) {
  const documentType = docTypeForDirection(direction);
  const cfg = DOC_CONFIG[documentType];

  if (documentType === "Invoice") {
    const invoices = await cfg.model
      .find({ organization: orgId })
      // An invoice's customer hangs off its Deal — there's no direct link.
      .populate({
        path: "deal",
        select: "title company contact",
        populate: [
          { path: "company", select: "name" },
          { path: "contact", select: "name" },
        ],
      })
      .lean();

    return {
      documentType,
      documents: invoices
        .map((doc) => {
          const total = round2(cfg.totalOf(doc));
          const paid = round2(sumPayments(doc.payments));
          const party =
            doc.deal?.company?.name || doc.deal?.contact?.name || doc.deal?.title || "Unknown customer";
          const partyType = doc.deal?.company ? "Company" : doc.deal?.contact ? "Contact" : null;
          const partyId = doc.deal?.company?._id || doc.deal?.contact?._id || null;
          return {
            _id: doc._id,
            documentType,
            number: cfg.numberOf(doc) || "",
            date: cfg.dateOf(doc),
            dueDate: doc.dueDate || null,
            status: doc.status,
            partyName: party,
            partyType,
            partyId,
            total,
            paid,
            due: round2(total - paid),
          };
        })
        .filter((d) => d.due > EPSILON)
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    };
  }

  const purchases = await cfg.model
    .find({ organization: orgId, status: { $ne: "Cancelled" } })
    .populate("vendor", "name companyName")
    .lean();

  return {
    documentType,
    documents: purchases
      .map((doc) => {
        const total = round2(cfg.totalOf(doc));
        const paid = round2(sumPayments(doc.payments));
        return {
          _id: doc._id,
          documentType,
          number: cfg.numberOf(doc) || "",
          date: cfg.dateOf(doc),
          dueDate: null,
          status: doc.status,
          partyName: doc.vendor?.companyName || doc.vendor?.name || "Unknown vendor",
          partyType: "Vendor",
          partyId: doc.vendor?._id || null,
          total,
          paid,
          due: round2(total - paid),
        };
      })
      .filter((d) => d.due > EPSILON)
      .sort((a, b) => new Date(a.date) - new Date(b.date)),
  };
}

// ---------------------------------------------------------------------------
// Applying allocations
// ---------------------------------------------------------------------------

class AllocationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AllocationError";
    this.statusCode = 400;
  }
}

// Validates a requested split without writing anything: right document type
// for the direction, documents actually belong to this org, no line exceeds
// what its document still owes, no duplicate lines, and the split does not
// exceed the payment amount. Returns the loaded documents so the caller does
// not have to re-fetch them.
async function validateAllocations({ orgId, direction, amount, allocations }) {
  const documentType = docTypeForDirection(direction);
  const cfg = DOC_CONFIG[documentType];

  const cleaned = [];
  const seen = new Set();

  for (const raw of allocations) {
    const docId = raw.documentId || raw.document || raw._id;
    const allocAmount = round2(raw.amount);

    if (!mongoose.isValidObjectId(docId)) {
      throw new AllocationError("An allocation is missing a valid document reference.");
    }
    if (!Number.isFinite(allocAmount) || allocAmount <= 0) {
      throw new AllocationError("Every allocation must be greater than 0.");
    }
    if (raw.documentType && raw.documentType !== documentType) {
      const expected = documentType === "Invoice" ? "invoices" : "purchase bills";
      const label = direction === "IN" ? "Credit" : "Debit";
      throw new AllocationError(`A ${label} payment can only be allocated to ${expected}.`);
    }
    const key = String(docId);
    if (seen.has(key)) {
      throw new AllocationError("The same document appears twice in the allocation — combine those lines.");
    }
    seen.add(key);
    cleaned.push({ documentId: docId, amount: allocAmount });
  }

  const totalAllocated = round2(cleaned.reduce((s, a) => s + a.amount, 0));
  const paymentAmount = round2(amount);
  if (totalAllocated > paymentAmount + EPSILON) {
    throw new AllocationError(
      `Allocations total ₹${totalAllocated.toFixed(2)}, which is more than the payment of ₹${paymentAmount.toFixed(2)}.`
    );
  }

  const docs = await cfg.model.find({
    _id: { $in: cleaned.map((a) => a.documentId) },
    organization: orgId,
  });

  if (docs.length !== cleaned.length) {
    throw new AllocationError("One or more of the selected documents could not be found.");
  }

  const byId = new Map(docs.map((d) => [String(d._id), d]));

  for (const alloc of cleaned) {
    const doc = byId.get(String(alloc.documentId));
    const due = round2(cfg.totalOf(doc) - sumPayments(doc.payments));
    if (alloc.amount > due + EPSILON) {
      const label = cfg.numberOf(doc) || String(doc._id).slice(-6);
      throw new AllocationError(
        `₹${alloc.amount.toFixed(2)} allocated to ${label} exceeds its remaining balance of ₹${due.toFixed(2)}.`
      );
    }
  }

  return { documentType, cleaned, docs: byId, totalAllocated };
}

// Writes a validated split: one payments[] subdoc per target document (so all
// the existing Paid/Pending math picks it up), one PaymentAllocation row
// linking it back, and the running total on the Payment itself.
//
// Standalone Mongo deployments have no transactions available here, so a
// mid-way failure is undone by reversing whatever already landed — the same
// reversal path used when a payment is deleted.
async function applyAllocations({ orgId, userId, payment, allocations }) {
  if (!Array.isArray(allocations) || allocations.length === 0) {
    return { allocations: [], totalAllocated: 0 };
  }

  const { documentType, cleaned, docs } = await validateAllocations({
    orgId,
    direction: payment.direction,
    amount: round2(payment.amount) - round2(payment.allocatedAmount || 0),
    allocations,
  });

  const cfg = DOC_CONFIG[documentType];
  const written = [];

  try {
    for (const alloc of cleaned) {
      const doc = docs.get(String(alloc.documentId));
      const alreadyPaid = sumPayments(doc.payments);

      doc.payments.push({
        amount: alloc.amount,
        paymentDate: payment.paymentDate || new Date(),
        paymentMethod: toPaymentMethod(payment.paymentType),
        reference: payment.reference || "",
        notes: payment.notes || "",
        internalNotes: "",
        recordedBy: userId,
        recordedAt: new Date(),
      });

      const subdoc = doc.payments[doc.payments.length - 1];
      doc.status = cfg.statusFor(doc, alreadyPaid + alloc.amount);

      // validateModifiedOnly for the same reason the payment controllers use
      // it: older documents can carry legacy field values that would fail a
      // full re-validation, and none of that is what we are touching here.
      await doc.save({ validateModifiedOnly: true });

      const record = await PaymentAllocation.create({
        payment: payment._id,
        documentType,
        document: doc._id,
        documentPaymentId: subdoc._id,
        amount: alloc.amount,
        organization: orgId,
        user: userId,
      });

      written.push(record);
    }
  } catch (err) {
    // Roll back the partial split so the documents are not left holding
    // payments that no Payment record accounts for.
    for (const record of written) {
      try {
        await reverseAllocation(record);
      } catch (rollbackErr) {
        console.error("Allocation rollback failed:", rollbackErr);
      }
    }
    throw err;
  }

  const totalAllocated = round2(written.reduce((s, a) => s + a.amount, 0));
  payment.allocatedAmount = round2((Number(payment.allocatedAmount) || 0) + totalAllocated);
  await payment.save({ validateModifiedOnly: true });

  return { allocations: written, totalAllocated };
}

// ---------------------------------------------------------------------------
// Reversing
// ---------------------------------------------------------------------------

// Pulls the subdoc this allocation pushed back out of its document, restores
// the document's status from what is left, and deletes the allocation row.
async function reverseAllocation(record) {
  const cfg = DOC_CONFIG[record.documentType];
  if (!cfg) return;

  const doc = await cfg.model.findOne({
    _id: record.document,
    organization: record.organization,
  });

  if (doc && record.documentPaymentId) {
    const subdoc = doc.payments.id(record.documentPaymentId);
    if (subdoc) {
      subdoc.deleteOne();
      doc.status = cfg.statusFor(doc, sumPayments(doc.payments));
      await doc.save({ validateModifiedOnly: true });
    }
  }

  await PaymentAllocation.deleteOne({ _id: record._id });
}

// Undoes every allocation on a payment — called when the payment itself is
// deleted, so the invoices/bills it settled go back to showing that balance
// as outstanding instead of silently keeping a phantom payment.
async function reverseAllocationsForPayment(paymentId) {
  const records = await PaymentAllocation.find({ payment: paymentId });
  for (const record of records) {
    await reverseAllocation(record);
  }
  return records.length;
}

// Allocations already recorded against one document, for display alongside
// its own payments list.
async function getAllocationsForDocument({ orgId, documentType, documentId }) {
  return PaymentAllocation.find({
    organization: orgId,
    documentType,
    document: documentId,
  })
    .populate("payment", "amount paymentDate paymentType reference direction")
    .lean();
}

// ---------------------------------------------------------------------------
// Credit balances
// ---------------------------------------------------------------------------

// Unallocated money per party — a customer who paid more than their open
// invoices covered, or a vendor we are in advance with. This is the
// "2k of a 10k receipt is still sitting there" figure, and it is what a later
// allocation draws down.
async function getCreditBalances({ orgId, direction = null, partyType = null, partyId = null }) {
  const filter = { organization: orgId };
  if (direction) filter.direction = direction;
  if (partyType && partyId) {
    filter.partyType = partyType;
    filter.party = partyId;
  }

  // Deliberately NOT using .populate() here. `party` is a refPath, and a
  // lean populate that misses (the company/contact/vendor was deleted after
  // the payment was recorded) returns null with the original id gone — which
  // would make real unapplied money vanish from this list, the one place it
  // is visible. Names are resolved in a second batched pass instead, so a
  // dangling reference costs the label and nothing else.
  const payments = await Payment.find(filter).lean();

  const buckets = new Map();

  for (const p of payments) {
    const unallocated = round2((Number(p.amount) || 0) - (Number(p.allocatedAmount) || 0));
    if (unallocated <= EPSILON) continue;

    // Fall back to the legacy `vendor` pointer for rows written before
    // partyType/party existed.
    const type = p.partyType || (p.vendor ? "Vendor" : null);
    const rawId = p.party || p.vendor;
    if (!type || !rawId) continue;

    const id = String(rawId);
    const key = `${type}:${id}`;

    if (!buckets.has(key)) {
      buckets.set(key, {
        partyType: type,
        partyId: id,
        partyName: "",
        direction: p.direction,
        creditBalance: 0,
        payments: [],
      });
    }

    const bucket = buckets.get(key);
    bucket.creditBalance = round2(bucket.creditBalance + unallocated);
    bucket.payments.push({
      _id: p._id,
      amount: round2(p.amount),
      allocatedAmount: round2(p.allocatedAmount),
      unallocatedAmount: unallocated,
      paymentDate: p.paymentDate,
      reference: p.reference || "",
    });
  }

  // Resolve display names, one query per party type rather than per payment.
  const MODELS = {
    Company: require("../models/Company"),
    Contact: require("../models/Contact"),
    Vendor: require("../models/Vendor"),
  };

  const byType = new Map();
  for (const bucket of buckets.values()) {
    if (!byType.has(bucket.partyType)) byType.set(bucket.partyType, []);
    byType.get(bucket.partyType).push(bucket.partyId);
  }

  const names = new Map();
  await Promise.all(
    Array.from(byType.entries()).map(async ([type, ids]) => {
      const Model = MODELS[type];
      if (!Model) return;
      const docs = await Model.find({ _id: { $in: ids } }).select("name companyName").lean();
      for (const d of docs) {
        names.set(`${type}:${String(d._id)}`, d.companyName || d.name || "Unnamed");
      }
    })
  );

  for (const bucket of buckets.values()) {
    const key = `${bucket.partyType}:${bucket.partyId}`;
    // A party record that no longer exists still has its money shown — the
    // balance is real even when the contact card behind it is gone.
    bucket.partyName = names.get(key) || "Deleted party";
    bucket.orphaned = !names.has(key);
  }

  return Array.from(buckets.values()).sort((a, b) => b.creditBalance - a.creditBalance);
}

// Spends a party's accumulated credit balance against their open documents.
//
// The credit can be spread over several earlier payments (three ₹2,000
// overpayments are ₹6,000 of credit), while an allocation always belongs to
// ONE payment. So each requested line is drawn from the party's unallocated
// payments oldest-first, splitting across payments where a single one can't
// cover it. That FIFO order matters: it retires the oldest money first, which
// is what makes a credit balance age out predictably.
async function applyCreditBalance({ orgId, userId, partyType, partyId, direction, allocations }) {
  if (!Array.isArray(allocations) || allocations.length === 0) {
    throw new AllocationError("At least one allocation is required.");
  }

  // Validate the whole request against the documents BEFORE drawing anything
  // down, so a bad line can't leave a half-spent credit balance behind.
  const totalRequested = round2(
    allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
  );

  const payments = await Payment.find({
    organization: orgId,
    partyType,
    party: partyId,
    direction,
  })
    .sort({ paymentDate: 1, createdAt: 1 });

  const withCredit = payments.filter(
    (p) => round2((Number(p.amount) || 0) - (Number(p.allocatedAmount) || 0)) > EPSILON
  );

  const available = round2(
    withCredit.reduce(
      (sum, p) => sum + ((Number(p.amount) || 0) - (Number(p.allocatedAmount) || 0)),
      0
    )
  );

  if (totalRequested > available + EPSILON) {
    throw new AllocationError(
      `₹${totalRequested.toFixed(2)} requested but only ₹${available.toFixed(2)} of credit is available.`
    );
  }

  // Re-uses the same per-document checks (belongs to org, within its balance,
  // right type for the direction) that a fresh payment goes through.
  await validateAllocations({ orgId, direction, amount: available, allocations });

  const applied = [];
  let paymentIndex = 0;

  for (const line of allocations) {
    let remaining = round2(line.amount);

    while (remaining > EPSILON) {
      const payment = withCredit[paymentIndex];
      if (!payment) {
        throw new AllocationError("Ran out of credit while applying — refresh and try again.");
      }

      const paymentCredit = round2(
        (Number(payment.amount) || 0) - (Number(payment.allocatedAmount) || 0)
      );
      if (paymentCredit <= EPSILON) {
        paymentIndex += 1;
        continue;
      }

      const take = round2(Math.min(paymentCredit, remaining));
      const result = await applyAllocations({
        orgId,
        userId,
        payment,
        allocations: [{ documentId: line.documentId || line.document, amount: take }],
      });

      applied.push(...result.allocations);
      remaining = round2(remaining - take);
      if (round2(paymentCredit - take) <= EPSILON) paymentIndex += 1;
    }
  }

  return {
    applied,
    totalApplied: round2(applied.reduce((s, a) => s + a.amount, 0)),
    remainingCredit: round2(available - totalRequested),
  };
}

module.exports = {
  AllocationError,
  applyCreditBalance,
  DOC_CONFIG,
  docTypeForDirection,
  getOpenDocuments,
  getAllOpenDocuments,
  validateAllocations,
  applyAllocations,
  reverseAllocation,
  reverseAllocationsForPayment,
  getAllocationsForDocument,
  getCreditBalances,
  round2,
  sumPayments,
};
