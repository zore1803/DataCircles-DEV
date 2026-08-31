// utils/eInvoiceMapper.js
//
// Pure, side-effect-free mapper: DataCircles Invoice → GSTN IRP payload
// (schema v1.1). Building this offline is safe — the field shape is a
// published spec, no IRP connection needed. Once IRIS Sandbox credentials
// are in place, only providers/iris/irisProvider.js needs wiring.
//
// Deliberately kept as one exported function `invoiceToEinvoicePayload` with
// no external I/O — the caller (eInvoiceService) is responsible for fetching
// invoice/seller/buyer/settings and passing them in. That makes it trivial
// to unit-test with plain-object fixtures.
//
// Tax math note: we don't have a shared computeDocument util — the existing
// PDF generators inline the same formulas. This mapper reproduces those
// formulas (subtotal → discount → taxable → GST split) in ONE place so the
// tax numbers frozen onto the EInvoice snapshot come from a single source
// of truth. If a future refactor extracts a shared util, this mapper switches
// to it — the current arrangement is honest about where the math lives.

const { getStateCode } = require("./stateCodeMap");

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Snapshots the line's tax computation. Mirrors the formulas in
// backend/utils/generatePdf.js so the numbers we send to IRP match what the
// PDF already shows customers.
function computeLineTax(line, transactionType) {
  const qty = Number(line.quantity) || 0;
  const rate = Number(line.rate) || 0;
  const gstRate = Number(line.gstRate) || 0;
  const taxInclusive = !!line.taxInclusive;

  // Subtotal before per-line discount
  const subtotal = qty * rate;

  // Discount can be a flat amount or percentage
  let disc = 0;
  const discVal = Number(line.discount) || 0;
  if (line.discountType === "percentage") disc = (subtotal * discVal) / 100;
  else disc = discVal;
  disc = Math.min(disc, subtotal);

  const gross = subtotal - disc;

  // If the rate already includes GST, back it out to get the taxable value.
  const taxable = taxInclusive && gstRate > 0
    ? gross / (1 + gstRate / 100)
    : gross;

  let cgst = 0, sgst = 0, igst = 0;
  if (gstRate > 0) {
    if (transactionType === "inter") {
      igst = (taxable * gstRate) / 100;
    } else {
      cgst = (taxable * gstRate) / 200;
      sgst = (taxable * gstRate) / 200;
    }
  }

  return {
    subtotal: round2(subtotal),
    discount: round2(disc),
    taxableValue: round2(taxable),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    totalItemValue: round2(taxable + cgst + sgst + igst),
    gstRate,
    unitPriceForIrp: taxInclusive && gstRate > 0 ? round2(rate / (1 + gstRate / 100)) : round2(rate),
  };
}

// Item.primaryUnit is stored like "NOS NUMBERS" / "KGS KILOGRAMS" — IRP wants
// only the 3-letter UQC prefix. This is the split rule agreed in Phase 1.
function toUQC(unit) {
  if (!unit) return "NOS";
  const first = String(unit).trim().split(/\s+/)[0].toUpperCase();
  return first || "NOS";
}

/**
 * Build the IRP-schema-v1.1 JSON envelope for an invoice.
 *
 * @param {object} args
 * @param {object} args.invoice   Fully-populated Invoice document (items[] resolved).
 * @param {object} args.seller    { legalName, gstin, addr1, addr2, loc, pin, stateName }
 * @param {object} args.buyer     { legalName, gstin, addr1, addr2, loc, pin, stateName, posStateName }
 * @param {object} args.settings  { supplyType, reverseCharge, docType }
 * @returns {{ payload: object, totals: object, warnings: string[], errors: string[] }}
 */
function invoiceToEinvoicePayload({ invoice, seller, buyer, settings = {} }) {
  const warnings = [];
  const errors = [];

  const supplyType = settings.supplyType || "B2B";
  const reverseCharge = !!settings.reverseCharge;
  const docType = settings.docType || "INV";

  // ── Required-field validation (Phase 6 step 7) ────────────────────────
  if (!seller?.gstin) errors.push("Seller GSTIN is missing");
  if (!seller?.legalName) errors.push("Seller legal name is missing");
  if (!seller?.pin) errors.push("Seller PIN code is missing");
  if (!seller?.loc) errors.push("Seller city/location is missing");
  if (!seller?.stateName) errors.push("Seller state is missing");

  if (!buyer?.legalName) errors.push("Buyer legal name is missing");
  if (!buyer?.pin) errors.push("Buyer PIN code is missing");
  if (!buyer?.loc) errors.push("Buyer city/location is missing");
  if (!buyer?.stateName) errors.push("Buyer state is missing");

  if (!invoice?.invoiceNumber) errors.push("Invoice number is missing");
  if (!invoice?.date) errors.push("Invoice date is missing");
  if (!Array.isArray(invoice?.items) || invoice.items.length === 0) {
    errors.push("Invoice has no line items");
  }

  const sellerStcd = getStateCode(seller?.stateName);
  const buyerStcd = getStateCode(buyer?.stateName);
  const posStcd = getStateCode(buyer?.posStateName || buyer?.stateName);
  if (!sellerStcd) errors.push(`Cannot resolve seller state code from "${seller?.stateName}"`);
  if (!buyerStcd) errors.push(`Cannot resolve buyer state code from "${buyer?.stateName}"`);

  // Per-line HSN + Unit are IRP-mandatory
  (invoice?.items || []).forEach((it, idx) => {
    if (!it.hsn) errors.push(`Line ${idx + 1} ("${it.name}") is missing HSN/SAC`);
  });

  // ── Line items (Phase 6 step 5-6) ─────────────────────────────────────
  const transactionType = invoice?.transactionType || "intra";
  let totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0, totalItemValue = 0;

  const itemList = (invoice?.items || []).map((line, idx) => {
    const tax = computeLineTax(line, transactionType);
    totalTaxable += tax.taxableValue;
    totalCgst += tax.cgst;
    totalSgst += tax.sgst;
    totalIgst += tax.igst;
    totalItemValue += tax.totalItemValue;

    return {
      SlNo: String(idx + 1),
      PrdDesc: line.name,
      IsServc: line.isService ? "Y" : "N",
      HsnCd: line.hsn || "",
      Qty: Number(line.quantity) || 0,
      Unit: toUQC(line.unit || line.primaryUnit),
      UnitPrice: tax.unitPriceForIrp,
      TotAmt: round2(tax.subtotal),
      Discount: tax.discount,
      AssAmt: tax.taxableValue,
      GstRt: tax.gstRate,
      IgstAmt: tax.igst,
      CgstAmt: tax.cgst,
      SgstAmt: tax.sgst,
      CesRt: 0,
      CesAmt: 0,
      CesNonAdvlAmt: 0,
      StateCesRt: 0,
      StateCesAmt: 0,
      StateCesNonAdvlAmt: 0,
      OthChrg: 0,
      TotItemVal: tax.totalItemValue,
    };
  });

  const grandTotal = round2(totalItemValue);

  // ── IRP envelope (schema v1.1) ────────────────────────────────────────
  const payload = {
    Version: "1.1",
    TranDtls: {
      TaxSch: "GST",
      SupTyp: supplyType,
      RegRev: reverseCharge ? "Y" : "N",
      IgstOnIntra: "N",
    },
    DocDtls: {
      Typ: docType,
      No: invoice?.invoiceNumber || "",
      Dt: invoice?.date ? new Date(invoice.date).toLocaleDateString("en-GB").replace(/\//g, "/") : "",
    },
    SellerDtls: {
      Gstin: seller?.gstin || "",
      LglNm: seller?.legalName || "",
      Addr1: seller?.addr1 || "",
      Addr2: seller?.addr2 || "",
      Loc: seller?.loc || "",
      Pin: Number(seller?.pin) || 0,
      Stcd: sellerStcd || "",
    },
    BuyerDtls: {
      Gstin: buyer?.gstin || "URP", // URP = Unregistered person (IRP convention)
      LglNm: buyer?.legalName || "",
      Pos: posStcd || buyerStcd || "",
      Addr1: buyer?.addr1 || "",
      Addr2: buyer?.addr2 || "",
      Loc: buyer?.loc || "",
      Pin: Number(buyer?.pin) || 0,
      Stcd: buyerStcd || "",
    },
    ItemList: itemList,
    ValDtls: {
      AssVal: round2(totalTaxable),
      CgstVal: round2(totalCgst),
      SgstVal: round2(totalSgst),
      IgstVal: round2(totalIgst),
      CesVal: 0,
      StCesVal: 0,
      Discount: 0,
      OthChrg: 0,
      RndOffAmt: 0,
      TotInvVal: grandTotal,
    },
  };

  // Sanity: warn if grand total drifts significantly from Invoice.amount
  // (edits after issuance can put them out of sync — the mapper is the
  // source of truth for what actually gets sent to IRP).
  const stored = Number(invoice?.amount) || 0;
  if (stored && Math.abs(stored - grandTotal) > 1) {
    warnings.push(
      `Computed grand total (${grandTotal}) differs from stored Invoice.amount (${stored}) by more than ₹1 — sending the computed value.`
    );
  }

  const totals = {
    taxableValue: round2(totalTaxable),
    cgst: round2(totalCgst),
    sgst: round2(totalSgst),
    igst: round2(totalIgst),
    totalTax: round2(totalCgst + totalSgst + totalIgst),
    grandTotal,
  };

  return { payload, totals, warnings, errors };
}

module.exports = { invoiceToEinvoicePayload, computeLineTax, toUQC };
