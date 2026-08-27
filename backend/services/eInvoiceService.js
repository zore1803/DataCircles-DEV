// services/eInvoiceService.js
//
// Orchestration layer for e-invoice generation. Sits between the controller
// (HTTP concerns) and providers/iris/irisProvider.js (network concerns), and
// owns the EInvoice-per-attempt lifecycle (Phase 8 / Option B cardinality).
//
// Deliberately provider-agnostic: it depends only on the four-method
// interface documented in providers/iris/irisProvider.js. Adding a second
// provider later is a one-line change in resolveProvider().
//
// Safety rule per Phase-1 note: if credentials are missing, generate/cancel
// still create an EInvoice row and record a FAILED attempt with a readable
// failureReason. We never fabricate a successful IRN. Existing invoice
// creation / editing / PDF flows are NEVER touched from here.

const Invoice = require("../models/Invoice");
const EInvoice = require("../models/EInvoice");
const Company = require("../models/Company");
const Branding = require("../models/Branding");
const DocumentSettings = require("../models/DocumentSettings");
const { invoiceToEinvoicePayload } = require("../utils/eInvoiceMapper");
const irisProvider = require("../providers/iris/irisProvider");

function resolveProvider() {
  // Only IRIS today; kept as an explicit switch so adding ClearTax/etc.
  // later is a single case.
  const name = (process.env.EINVOICE_PROVIDER || "IRIS").toUpperCase();
  switch (name) {
    case "IRIS": return irisProvider;
    default:
      throw new Error(`Unknown e-invoice provider: ${name}`);
  }
}

// ── Fixture-building helpers ─────────────────────────────────────────
// Kept separate from the mapper so the mapper stays a pure function.

async function buildSellerContext(organizationId) {
  const branding = await Branding.findOne({ organization: organizationId }).lean();
  if (!branding) return null;
  return {
    legalName: branding.companyName || "",
    gstin: branding.gstin || "",
    addr1: branding.address || "",
    addr2: "",
    loc: branding.city || "",
    pin: branding.pincode || "",
    stateName: branding.state || "",
  };
}

async function buildBuyerContext(invoice) {
  // Invoice.deal → Deal.company gives the buyer. Fall back to the invoice's
  // own snapshotted billing/shipping addresses if the company link is stale.
  const buyerCompany = invoice.deal?.company
    ? await Company.findById(invoice.deal.company).lean()
    : null;

  const bill = invoice.billingAddress || buyerCompany?.billingAddress || {};
  const ship = invoice.shippingAddress || (buyerCompany?.shippingAddresses || [])[0] || bill;

  return {
    legalName: buyerCompany?.name || invoice.deal?.title || "Customer",
    gstin: invoice.receiverGSTIN || buyerCompany?.gstin || "",
    addr1: bill.addressLine1 || "",
    addr2: bill.addressLine2 || "",
    loc: bill.city || "",
    pin: bill.pincode || "",
    stateName: bill.state || "",
    posStateName: ship.state || bill.state || "",
  };
}

async function buildSettingsContext(organizationId) {
  const docs = await DocumentSettings.findOne({ organization: organizationId }).lean();
  const d = docs?.eInvoiceDefaults || {};
  return {
    supplyType: d.supplyType || "B2B",
    reverseCharge: !!d.reverseCharge,
    docType: "INV",
  };
}

// ── Duplicate-generation guard (Phase 11) ────────────────────────────
// If there's already a GENERATED or PROCESSING attempt for this invoice,
// refuse a new call — the caller should retrieve/cancel instead. This is the
// server-side backstop; the frontend should also disable the button.
async function assertNotAlreadyGeneratedOrInFlight(invoiceId) {
  const latest = await EInvoice.findOne({ invoice: invoiceId })
    .sort({ attemptNumber: -1 })
    .lean();
  if (!latest) return;
  if (latest.lifecycleStatus === "GENERATED") {
    const err = new Error(`Invoice already has an active IRN (${latest.irn}). Cancel it before generating a new one.`);
    err.code = "ALREADY_GENERATED";
    throw err;
  }
  if (latest.lifecycleStatus === "PROCESSING") {
    const err = new Error("An e-invoice generation is already in progress for this invoice.");
    err.code = "ALREADY_IN_PROGRESS";
    throw err;
  }
}

async function nextAttemptNumber(invoiceId) {
  const last = await EInvoice.findOne({ invoice: invoiceId })
    .sort({ attemptNumber: -1 })
    .select("attemptNumber _id")
    .lean();
  return { attemptNumber: (last?.attemptNumber || 0) + 1, previousAttempt: last?._id || null };
}

// ── Build + validate payload (public helper, used by controller.preview too) ─
async function buildAndValidate(invoiceId) {
  const invoice = await Invoice.findById(invoiceId)
    .populate({ path: "deal", populate: { path: "company" } })
    .lean();
  if (!invoice) {
    const err = new Error("Invoice not found");
    err.code = "INVOICE_NOT_FOUND";
    throw err;
  }
  const [seller, buyer, settings] = await Promise.all([
    buildSellerContext(invoice.organization),
    buildBuyerContext(invoice),
    buildSettingsContext(invoice.organization),
  ]);
  const built = invoiceToEinvoicePayload({ invoice, seller, buyer, settings });
  return { invoice, seller, buyer, settings, ...built };
}

// ── Generate (Phase 7) ───────────────────────────────────────────────
async function generate({ invoiceId, user, organizationId }) {
  await assertNotAlreadyGeneratedOrInFlight(invoiceId);

  const { invoice, payload, totals, errors } = await buildAndValidate(invoiceId);
  const { attemptNumber, previousAttempt } = await nextAttemptNumber(invoiceId);

  const provider = resolveProvider();
  const environment = (process.env.EINVOICE_ENVIRONMENT || "SANDBOX").toUpperCase();

  // Base record — created up-front so failure paths still leave an audit row.
  const record = await EInvoice.create({
    invoice: invoice._id,
    deal: invoice.deal?._id || invoice.deal || null,
    invoiceNumber: invoice.invoiceNumber,
    customer: {
      name: invoice.deal?.company?.name || invoice.deal?.title || "",
      gstin: invoice.receiverGSTIN || invoice.deal?.company?.gstin || "",
    },
    amount: totals.grandTotal,
    date: invoice.date,
    lifecycleStatus: "PROCESSING",
    provider: provider.name,
    environment,
    payloadSnapshot: payload,
    totalsSnapshot: totals,
    attemptNumber,
    previousAttempt,
    user: user?.id,
    organization: organizationId,
  });

  // Fail-fast on validation errors from the mapper (Phase 10).
  if (errors.length) {
    record.lifecycleStatus = "FAILED";
    record.failureCode = "VALIDATION_FAILED";
    record.failureReason = errors.join("; ");
    await record.save();
    await Invoice.findByIdAndUpdate(invoice._id, { latestEInvoice: record._id });
    return { record, ok: false };
  }

  // Fail-safe on missing provider config (Phase-1 rule: no fake success).
  if (!provider.isConfigured || !provider.isConfigured()) {
    record.lifecycleStatus = "FAILED";
    record.failureCode = "PROVIDER_NOT_CONFIGURED";
    record.failureReason =
      `${provider.name} ${environment} credentials are not configured. ` +
      `Set EINVOICE_${environment}_* env vars in the backend before generating an IRN.`;
    await record.save();
    await Invoice.findByIdAndUpdate(invoice._id, { latestEInvoice: record._id });
    return { record, ok: false };
  }

  // Provider call (Phase 5 wiring pending) — until then this throws
  // NotImplementedError and we record a FAILED attempt honestly.
  try {
    const irpResponse = await provider.generateIRN(payload);
    record.lifecycleStatus = "GENERATED";
    record.irn = irpResponse.irn || "";
    record.ackNo = irpResponse.ackNo || "";
    record.ackDate = irpResponse.ackDate || null;
    record.signedInvoice = irpResponse.signedInvoice || "";
    record.signedQRCode = irpResponse.signedQRCode || "";
    record.providerRequestId = irpResponse.providerRequestId || "";
    record.generatedAt = new Date();
    await record.save();
    await Invoice.findByIdAndUpdate(invoice._id, { latestEInvoice: record._id });
    return { record, ok: true };
  } catch (err) {
    record.lifecycleStatus = "FAILED";
    record.failureCode = err.code || "PROVIDER_ERROR";
    record.failureReason = err.message || String(err);
    await record.save();
    await Invoice.findByIdAndUpdate(invoice._id, { latestEInvoice: record._id });
    return { record, ok: false };
  }
}

// ── Retrieve (Phase 11) ──────────────────────────────────────────────
// After a network failure the user must NOT just click Generate again — the
// IRP may have already issued an IRN. This looks up the actual portal state.
async function retrieve({ invoiceId, organizationId }) {
  const invoice = await Invoice.findById(invoiceId).lean();
  if (!invoice) {
    const err = new Error("Invoice not found");
    err.code = "INVOICE_NOT_FOUND";
    throw err;
  }
  const provider = resolveProvider();
  const environment = (process.env.EINVOICE_ENVIRONMENT || "SANDBOX").toUpperCase();

  const irpResponse = await provider.getIRN({
    docType: "INV",
    docNo: invoice.invoiceNumber,
    docDate: invoice.date,
  });
  if (!irpResponse || !irpResponse.irn) return { record: null, ok: false };

  const record = await EInvoice.create({
    invoice: invoice._id,
    deal: invoice.deal || null,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    date: invoice.date,
    lifecycleStatus: "GENERATED",
    provider: provider.name,
    environment,
    irn: irpResponse.irn,
    ackNo: irpResponse.ackNo || "",
    ackDate: irpResponse.ackDate || null,
    signedInvoice: irpResponse.signedInvoice || "",
    signedQRCode: irpResponse.signedQRCode || "",
    providerRequestId: irpResponse.providerRequestId || "",
    generatedAt: new Date(),
    organization: organizationId,
  });
  await Invoice.findByIdAndUpdate(invoice._id, { latestEInvoice: record._id });
  return { record, ok: true };
}

// ── Cancel (Phase 12) ────────────────────────────────────────────────
async function cancel({ invoiceId, reason, remarks }) {
  const latest = await EInvoice.findOne({ invoice: invoiceId })
    .sort({ attemptNumber: -1 });
  if (!latest) {
    const err = new Error("No e-invoice found for this invoice");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (latest.lifecycleStatus !== "GENERATED") {
    const err = new Error(`Cannot cancel — current status is ${latest.lifecycleStatus}`);
    err.code = "INVALID_STATE";
    throw err;
  }

  const provider = resolveProvider();
  try {
    const irpResponse = await provider.cancelIRN({ irn: latest.irn, reason, remarks });
    latest.lifecycleStatus = "CANCELLED";
    latest.cancelledAt = new Date();
    latest.cancellationReason = reason || "";
    latest.cancellationRemarks = remarks || "";
    latest.providerRequestId = irpResponse?.providerRequestId || latest.providerRequestId;
    await latest.save();
    return { record: latest, ok: true };
  } catch (err) {
    // Cancellation failure is NOT terminal — keep the record GENERATED and
    // surface the error so the user can retry with a different reason code.
    return { record: latest, ok: false, error: err.message || String(err), code: err.code };
  }
}

// ── History (Phase 15 audit trail) ───────────────────────────────────
async function history({ invoiceId, organizationId }) {
  return EInvoice.find({ invoice: invoiceId, organization: organizationId })
    .sort({ attemptNumber: 1 })
    .lean();
}

module.exports = {
  buildAndValidate,
  generate,
  retrieve,
  cancel,
  history,
  resolveProvider,
};
