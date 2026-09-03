/*
 * documentTemplates.js â€” Template Registry
 *
 * Single source of truth for invoice/document rendering.
 *
 * Both sides render from this module:
 *   - Frontend live preview (InvoiceLivePreview.jsx) via dangerouslySetInnerHTML
 *   - Backend PDF (utils/htmlDocumentPdf.js) via headless Chrome
 *
 * â”€â”€ How to add a new template â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 *   1. Create  shared/templates/MyTemplate.js  exporting:
 *        export const blurb = "Short description shown in the template picker.";
 *        export const css   = `...your scoped CSS...`;
 *        export function html(ctx) { return `...your HTML...`; }
 *
 *   2. Import it here (one line) and add it to REGISTRY (one line).
 *
 *   That's it. The template picker, backend enums and blurb text all derive
 *   from REGISTRY automatically â€” no other files need touching.
 *
 * â”€â”€ Template context object â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 *   ctx = {
 *     // Computed document figures (from computeDocument)
 *     t,               // { isTax, isInterState, rows, grossTaxable, totalCGST,
 *                      //   totalSGST, totalIGST, grandTotal, amountInWords,
 *                      //   totalQty, rows, hsnRows, documentDiscount, ... }
 *     // Raw document (Mongo doc or live form state)
 *     doc,
 *     // Organisation and bank details
 *     org, bank,
 *     // Helpers
 *     esc, fmt, formatDate, formatPostalAddress,
 *     // Resolved values
 *     dealName, docLabel, docNumber, copySubtitle,
 *     notes, terms,
 *     // Pre-built HTML snippets
 *     discountRow,     // "" when no discount
 *     hsnRows,         // HSN/SAC table body rows HTML
 *     itemRows,        // Items table body rows HTML (standard columns)
 *     qrBlock,         // UPI QR code block HTML or ""
 *     upiId,           // UPI VPA string or ""
 *   }
 */

// â”€â”€ Template imports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import * as Classic      from "./templates/Classic.js";
import * as Modern       from "./templates/Modern.js";
import * as Minimal      from "./templates/Minimal.js";
import * as Elegant      from "./templates/Elegant.js";
import * as Compact      from "./templates/Compact.js";
import * as Corporate    from "./templates/Corporate.js";
import * as Vibrant      from "./templates/Vibrant.js";
import * as Mono         from "./templates/Mono.js";
import * as Vintage      from "./templates/Vintage.js";
import * as Professional from "./templates/Professional.js";
import * as Landscape    from "./templates/Landscape.js";
import * as Service      from "./templates/Service.js";

// â”€â”€ Registry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//   Key order here determines the order in the template picker.
export const REGISTRY = {
  Classic,
  Modern,
  Minimal,
  Elegant,
  Compact,
  Corporate,
  Vibrant,
  Mono,
  Vintage,
  Professional,
  Landscape,
  Service,
};

export const DOCUMENT_TEMPLATES = Object.keys(REGISTRY);
export const DEFAULT_TEMPLATE   = "Classic";

// â”€â”€ Internal lookup maps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const NUMBER_KEY = {
  tax:             "invoiceNumber",
  performa:        "performaInvoiceNumber",
  quotation:       "quotationNumber",
  deliveryChallan: "deliveryChallanNumber",
  salesReturn:     "returnNumber",
};

const DOC_LABEL = {
  tax:             "Invoice",
  performa:        "Pro Forma Invoice",
  quotation:       "Quotation",
  deliveryChallan: "Delivery Challan",
  salesReturn:     "Sales Return",
};

/* ------------------------------------------------------------------ utils */

function esc(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]
  );
}

const fmt = (n) =>
  (Number(n) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function formatDate(d) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date)) return "";
  const day   = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("default", { month: "short" });
  return `${day} ${month} ${date.getFullYear()}`;
}

/* Renders a postalAddressSchema-shaped object as multi-line text. */
function formatPostalAddress(addr) {
  if (!addr) return "";
  const cityStatePin = [addr.city, addr.state, addr.pincode]
    .filter((v) => v && String(v).trim())
    .join(", ");
  return [addr.addressLine1, addr.addressLine2, cityStatePin, addr.country]
    .filter((v) => v && String(v).trim())
    .join("\n");
}

/* Indian-numbering words. */
export function numberToWords(num) {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
    "Eighty", "Ninety",
  ];

  function toWords(n) {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100)
      return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000)
      return (
        ones[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 ? " " + toWords(n % 100) : "")
      );
    let result = "";
    if (n >= 10000000) { result += toWords(Math.floor(n / 10000000)) + " Crore "; n %= 10000000; }
    if (n >= 100000)   { result += toWords(Math.floor(n / 100000))   + " Lakh ";  n %= 100000;   }
    if (n >= 1000)     { result += toWords(Math.floor(n / 1000))     + " Thousand "; n %= 1000;  }
    if (n > 0) result += toWords(n);
    return result.trim();
  }

  if (!num) return "Zero Rupees Only";
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);
  let words = toWords(integerPart) + " Rupees";
  if (decimalPart > 0) words += " and " + toWords(decimalPart) + " Paise";
  return words + " Only";
}

/* ------------------------------------------------------------ computation */

export const GST_RATES = [0, 5, 12, 18, 28, 40];
export const DEFAULT_UPI_ID = "rzore430@oksbi";

export function splitGst(taxableAmount, gstRate, transactionType = "intra") {
  const rate      = Number(gstRate) || 0;
  const amount    = Number(taxableAmount) || 0;
  const isInterState = transactionType === "inter";
  const halfRate  = rate / 2;
  return {
    isInterState,
    cgstRate: isInterState ? 0 : halfRate,
    sgstRate: isInterState ? 0 : halfRate,
    igstRate: isInterState ? rate : 0,
    cgst:     isInterState ? 0 : (amount * halfRate) / 100,
    sgst:     isInterState ? 0 : (amount * halfRate) / 100,
    igst:     isInterState ? (amount * rate) / 100 : 0,
  };
}

export function computeDocument(doc, type = "tax") {
  const supportsTax  = type !== "deliveryChallan";
  const taxFlagKey   = type === "quotation" ? "isTaxQuotation" : "isTaxInvoice";
  const transactionType = doc.transactionType === "inter" ? "inter" : "intra";
  const isTax        = supportsTax && !!doc[taxFlagKey];

  const baseRows = (doc.items || []).map((it) => {
    const rate     = parseFloat(it.rate) || 0;
    const qty      = parseFloat(it.quantity) || 0;
    const gstRate  = GST_RATES.includes(Number(it.gstRate))
      ? Number(it.gstRate)
      : (GST_RATES.includes(Number(doc.gstRate)) ? Number(doc.gstRate) : 18);
    const unitTaxable = it.taxInclusive ? rate / (1 + gstRate / 100) : rate;
    const sub  = unitTaxable * qty;
    const disc = it.discountType === "percentage"
      ? (sub * (parseFloat(it.discount) || 0)) / 100
      : parseFloat(it.discount) || 0;
    return {
      name:         it.name || it.itemId?.name || "",
      description:  it.description || "",
      hsn:          it.hsn || "",
      rate,
      qty,
      gstRate,
      taxable:      sub - disc,
      discountAmount: disc,
      discountPct:  it.discountType === "percentage"
        ? parseFloat(it.discount) || 0
        : (sub > 0 ? (disc / sub) * 100 : 0),
    };
  });

  const grossTaxable    = baseRows.reduce((s, r) => s + r.taxable, 0);
  const docDiscount     = doc.discount || {};
  const discountValue   = parseFloat(docDiscount.value) || 0;
  const documentDiscount = discountValue > 0
    ? docDiscount.type === "percentage"
      ? (grossTaxable * discountValue) / 100
      : Math.min(discountValue, grossTaxable)
    : 0;
  const netFactor = grossTaxable > 0 ? (grossTaxable - documentDiscount) / grossTaxable : 1;

  const rows = baseRows.map((r) => {
    const taxable = r.taxable * netFactor;
    const gst = isTax
      ? splitGst(taxable, r.gstRate, transactionType)
      : { cgst: 0, sgst: 0, igst: 0, cgstRate: 0, sgstRate: 0, igstRate: 0 };
    const tax = gst.cgst + gst.sgst + gst.igst;
    return { ...r, taxable, ...gst, tax, amount: taxable + tax };
  });

  const hsnMap = {};
  rows.forEach((r) => {
    const key = (r.hsn || "N/A") + "_" + r.gstRate;
    if (!hsnMap[key])
      hsnMap[key] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, hsn: r.hsn, rate: r.gstRate };
    hsnMap[key].taxable += r.taxable;
    hsnMap[key].cgst    += r.cgst;
    hsnMap[key].sgst    += r.sgst;
    hsnMap[key].igst    += r.igst;
  });

  const grandTotal = rows.reduce((s, r) => s + r.amount, 0);

  return {
    isTax,
    transactionType,
    isInterState: transactionType === "inter",
    rows,
    grossTaxable,
    documentDiscount,
    discountValue,
    discountType:  docDiscount.type,
    totalQty:      rows.reduce((s, r) => s + r.qty, 0),
    totalTaxable:  rows.reduce((s, r) => s + r.taxable, 0),
    totalCGST:     rows.reduce((s, r) => s + r.cgst, 0),
    totalSGST:     rows.reduce((s, r) => s + r.sgst, 0),
    totalIGST:     rows.reduce((s, r) => s + r.igst, 0),
    grandTotal,
    hsnRows:       Object.keys(hsnMap).map((k) => hsnMap[k]),
    amountInWords: numberToWords(grandTotal),
  };
}

export function buildUpiUri(doc, options = {}) {
  const { type = "tax", orgDetails, upiId = DEFAULT_UPI_ID, amount } = options;
  const vpa = (upiId || "").trim();
  if (!vpa) return "";

  const total = amount !== undefined ? Number(amount) : computeDocument(doc, type).grandTotal;
  if (!(total > 0)) return "";

  const numberKey = NUMBER_KEY[type] || NUMBER_KEY.tax;
  const params    = new URLSearchParams({
    pa: vpa,
    pn: (orgDetails?.companyName || "Payee").trim(),
    am: total.toFixed(2),
    cu: "INR",
  });
  const ref = doc?.[numberKey];
  if (ref) params.set("tn", `${DOC_LABEL[type] || "Invoice"} ${ref}`);
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

/* ------------------------------------------------------------- base CSS */

const BASE_CSS = `
.dcsheet, .dcsheet * { box-sizing: border-box; }
.dcsheet {
  --accent: #007bff;
  --ink: #000;
  --muted: #444;
  --line: #000;
  --line-w: 1px;
  --pad: 8px;
  --radius: 0px;
  background: #fff;
  color: var(--ink);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11px;
  line-height: 1.35;
  padding: 20px;
  width: 100%;
  max-width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.dcsheet.t-Landscape {
  max-width: 297mm;
  min-height: 210mm;
}
.dcsheet .dc-page-number {
  margin-top: auto;
  padding-top: 10px;
  text-align: right;
  font-size: 9px;
  color: var(--muted, #666);
  font-family: inherit;
  width: 100%;
  border-top: 1px dashed #d1d5db;
}
.is-pdf .dc-page-number {
  display: none !important;
}
.dcsheet .dc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 12px; }
.dcsheet .dc-org { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
.dcsheet .dc-logo { width: 56px; height: 56px; object-fit: contain; flex-shrink: 0; }
.dcsheet .dc-company { font-size: 15px; font-weight: bold; }
.dcsheet .dc-addr { font-size: 10px; white-space: pre-line; max-width: 280px; }
.dcsheet .dc-gstin { font-size: 10px; font-weight: bold; margin-top: 2px; }
.dcsheet .dc-contact { font-size: 10px; }
.dcsheet .dc-title-block { text-align: right; flex-shrink: 0; }
.dcsheet .dc-title { font-size: 13px; font-weight: bold; color: var(--accent); text-transform: uppercase; }
.dcsheet .dc-subtitle { font-size: 10px; font-weight: bold; }

.dcsheet .dc-meta { display: grid; grid-template-columns: 1fr 1fr; border: var(--line-w) solid var(--line); border-radius: var(--radius); overflow: hidden; }
.dcsheet .dc-cust { border-right: var(--line-w) solid var(--line); padding: var(--pad); }
.dcsheet .dc-cust > div { margin-bottom: 4px; }
.dcsheet .dc-label { font-weight: bold; }
.dcsheet .dc-mt { padding-top: 4px; }
.dcsheet .dc-addr-box { min-height: 28px; }
.dcsheet .dc-metagrid { display: grid; grid-template-columns: 1fr 1fr; }
.dcsheet .dc-mcell { border: var(--line-w) solid var(--line); padding: 4px 6px; }
.dcsheet .dc-mcell b { display: block; }
.dcsheet .dc-span2 { grid-column: span 2; }

.dcsheet table { width: 100%; border-collapse: collapse; }
.dcsheet .dc-items { border: var(--line-w) solid var(--line); font-size: 10px; }
.dcsheet .dc-items th { border: var(--line-w) solid var(--line); padding: 4px 6px; font-weight: bold; }
.dcsheet .dc-items td { border: var(--line-w) solid var(--line); padding: 4px 6px; vertical-align: top; }
.dcsheet .c { text-align: center; }
.dcsheet .r { text-align: right; }
.dcsheet .nowrap { white-space: nowrap; }
.dcsheet .dc-item-name { font-weight: bold; }
.dcsheet .dc-item-desc { font-weight: normal; font-size: 9px; color: var(--muted); margin-top: 2px; white-space: pre-line; }

.dcsheet .dc-totals { display: grid; grid-template-columns: 1fr 1fr; border: var(--line-w) solid var(--line); border-top: 0; }
.dcsheet .dc-totals-left { border-right: var(--line-w) solid var(--line); padding: var(--pad); }
.dcsheet .dc-totals-left > div { margin-bottom: 4px; }
.dcsheet .dc-bank-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.dcsheet .dc-bank { min-width: 0; }
.dcsheet .dc-bank > div { margin-bottom: 4px; }
.dcsheet .dc-qr { flex-shrink: 0; text-align: center; width: 104px; }
.dcsheet .dc-qr-img svg { width: 104px; height: 104px; display: block; }
.dcsheet .dc-qr-cap { font-size: 9px; font-weight: bold; margin-top: 2px; }
.dcsheet .dc-totals-right { padding: var(--pad); }
.dcsheet .dc-trow { display: flex; justify-content: space-between; }
.dcsheet .dc-trow.sep { border-bottom: var(--line-w) solid var(--line); padding-bottom: 4px; }
.dcsheet .dc-grand { display: flex; justify-content: space-between; align-items: center; padding-top: 8px; font-size: 14px; font-weight: bold; }
.dcsheet .dc-paid { display: flex; justify-content: flex-end; align-items: center; gap: 4px; padding-top: 8px; }
.dcsheet .dc-tick { color: #16a34a; }

.dcsheet .dc-hsn { border: var(--line-w) solid var(--line); margin-top: 8px; font-size: 10px; }
.dcsheet .dc-hsn th, .dcsheet .dc-hsn td { border: var(--line-w) solid var(--line); padding: 4px 6px; }
.dcsheet .dc-hsn th { font-weight: bold; }
.dcsheet .dc-hsn .tot td { font-weight: bold; }

.dcsheet .dc-footer { display: grid; grid-template-columns: 1fr 180px; border: var(--line-w) solid var(--line); margin-top: 8px; }
.dcsheet .dc-notes { border-right: var(--line-w) solid var(--line); padding: var(--pad); }
.dcsheet .dc-note-body { white-space: pre-line; }
.dcsheet .dc-terms { font-size: 9px; margin-top: 2px; white-space: pre-line; }
.dcsheet .dc-terms div { margin-bottom: 2px; }
.dcsheet .dc-sign { padding: var(--pad); display: flex; flex-direction: column; justify-content: space-between; text-align: right; }
.dcsheet .dc-sign-img { height: 40px; margin-left: auto; object-fit: contain; }
.dcsheet .dc-sign-line { border-top: var(--line-w) solid var(--line); padding-top: 4px; margin-top: 4px; }
`;

/* ------------------------------------------------------------------ build */

/*
 * Returns a self-contained HTML fragment: a <style> block + the document markup.
 * Safe to inject into a page (.dcsheet scope) or into a bare page for printing.
 */
export function buildDocumentHtml(doc, options = {}) {
  const {
    type          = "tax",
    template      = DEFAULT_TEMPLATE,
    orgDetails,
    bankDetails,
    dealName:     dealNameOverride,
    documentNumber,
    upiQrSvg,
    upiId,
    copyType      = "original",
  } = options;

  const COPY_TYPE_LABEL = {
    original:   "ORIGINAL FOR RECIPIENT",
    duplicate:  "DUPLICATE FOR TRANSPORTER",
    triplicate: "TRIPLICATE FOR SUPPLIER",
  };
  const copySubtitle = COPY_TYPE_LABEL[copyType] || COPY_TYPE_LABEL.original;

  const tplName  = DOCUMENT_TEMPLATES.includes(template) ? template : DEFAULT_TEMPLATE;
  const tpl      = REGISTRY[tplName];
  const org      = orgDetails  || {};
  const bank     = bankDetails || {};
  const docLabel = DOC_LABEL[type]  || DOC_LABEL.tax;
  const numberKey = NUMBER_KEY[type] || NUMBER_KEY.tax;

  const t = computeDocument(doc, type);

  const dealName =
    dealNameOverride ||
    doc.deal?.title ||
    doc.deal?.company?.name ||
    doc.deal?.contact?.name ||
    "Customer Name";

  const docNumber = documentNumber ?? doc[numberKey];
  const notes     = (doc.notes ?? "").trim();
  const terms     = (doc.terms ?? "").trim();

  // â”€â”€ Pre-built snippets passed into ctx â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const discountRow = t.documentDiscount > 0
    ? `<div class="dc-trow"><span class="dc-label">Discount${
        t.discountType === "percentage" ? ` (${t.discountValue}%)` : ""
      }</span><span>- &#8377;${fmt(t.documentDiscount)}</span></div>`
    : "";

  const qrBlock = upiQrSvg && t.grandTotal > 0
    ? `<div class="dc-qr">
        <div class="dc-qr-img">${upiQrSvg}</div>
        <div class="dc-qr-cap">Scan to pay</div>
      </div>`
    : "";

  // Standard item rows (used by most templates; unique-layout templates build
  // their own rows inline).
  const itemRows = t.rows.length
    ? t.rows.map((r, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td class="dc-item-name">${esc(r.name) || "&mdash;"}${
          r.description ? `<div class="dc-item-desc">${esc(r.description)}</div>` : ""
        }</td>
        <td class="c">${esc(r.hsn)}</td>
        <td class="r">${fmt(r.rate)}</td>
        <td class="r nowrap">${r.qty} BOX</td>
        <td class="r">${fmt(r.taxable)}</td>
        ${buildItemTaxCells(r, t)}
        <td class="r">${fmt(r.amount)}</td>
      </tr>`).join("")
    : `<tr><td class="c" colspan="8">&nbsp;</td></tr>`;

  // Standard HSN/SAC rows
  const hsnRows = t.hsnRows.map((r) =>
    t.isInterState
      ? `<tr>
          <td class="c">${esc(r.hsn)}</td>
          <td class="c">${fmt(r.taxable)}</td>
          <td class="c">${r.rate}%</td>
          <td class="r">${fmt(r.igst)}</td>
          <td class="c">${fmt(r.igst)}</td>
        </tr>`
      : `<tr>
          <td class="c">${esc(r.hsn)}</td>
          <td class="c">${fmt(r.taxable)}</td>
          <td class="c">${r.rate / 2}%</td>
          <td class="r">${fmt(r.cgst)}</td>
          <td class="c">${r.rate / 2}%</td>
          <td class="r">${fmt(r.sgst)}</td>
          <td class="c">${fmt(r.cgst + r.sgst)}</td>
        </tr>`
  ).join("");

  // â”€â”€ Assemble context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ctx = {
    t, doc, org, bank, upiId,
    esc, fmt, formatDate, formatPostalAddress,
    dealName, docLabel, docNumber, copySubtitle,
    notes, terms,
    discountRow, hsnRows, itemRows, qrBlock,
  };

  const css = BASE_CSS + (tpl.css || "");

  return `<style>${css}</style>
<div class="dcsheet t-${tplName}">
  <div class="dcsheet-body" style="flex:1;">
    ${tpl.html(ctx)}
  </div>
  <div class="dc-page-number">Page 1/1</div>
</div>`;
}

/* Build the per-row tax cells for the standard items table. */
function buildItemTaxCells(r, t) {
  if (!t.isTax) return "";
  return t.isInterState
    ? `<td class="r">${r.igst > 0 ? `${fmt(r.igst)} (${r.igstRate}%)` : ""}</td>`
    : `<td class="r">${r.cgst > 0 ? `${fmt(r.cgst)} (${r.cgstRate}%)` : ""}</td>
       <td class="r">${r.sgst > 0 ? `${fmt(r.sgst)} (${r.sgstRate}%)` : ""}</td>`;
}
