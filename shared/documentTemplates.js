/*
 * Single source of truth for how an accounting document (invoice / pro forma
 * invoice / quotation / delivery challan) looks.
 *
 * Both sides render from this one module:
 *   - the frontend live preview (InvoiceLivePreview.jsx) injects the returned
 *     fragment directly, and
 *   - the backend PDF generator (utils/htmlDocumentPdf.js) wraps it in a page
 *     and prints it with headless Chrome.
 *
 * Keeping the markup, the CSS and the arithmetic in one place is deliberate:
 * the previous design had a React preview and a PDFKit generator that each
 * reimplemented the layout by hand, and they drifted apart. Anything added
 * here shows up identically in both places.
 *
 * All four templates share the same semantic markup and differ only in CSS,
 * so a data or layout change can never apply to one template and miss another.
 * Every rule is scoped under `.dcsheet` so injecting the fragment into the app
 * cannot leak styles into the surrounding UI.
 */

export const DOCUMENT_TEMPLATES = [
  "Classic",
  "Modern",
  "Minimal",
  "Elegant",
  "Compact",
  "Corporate",
  "Vibrant",
  "Mono",
  "Vintage",
  "Professional",
  "Landscape",
  "Service",
];

export const DEFAULT_TEMPLATE = "Classic";

const NUMBER_KEY = {
  tax: "invoiceNumber",
  performa: "performaInvoiceNumber",
  quotation: "quotationNumber",
  deliveryChallan: "deliveryChallanNumber",
  salesReturn: "returnNumber",
  AiryWhite: "Airy, blue‑accent layout with thin rules – matches your design spec",
};

const DOC_LABEL = {
  tax: "Invoice",
  performa: "Pro Forma Invoice",
  quotation: "Quotation",
  deliveryChallan: "Delivery Challan",
  salesReturn: "Sales Return",
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
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("default", { month: "short" });
  return `${day} ${month} ${date.getFullYear()}`;
}

/* Renders a postalAddressSchema-shaped object (addressLine1, addressLine2,
   city, state, pincode, country) as the multi-line text the address boxes
   expect. Missing/empty fields are dropped rather than leaving blank lines. */
function formatPostalAddress(addr) {
  if (!addr) return "";
  const cityStatePin = [addr.city, addr.state, addr.pincode]
    .filter((v) => v && String(v).trim())
    .join(", ");
  return [addr.addressLine1, addr.addressLine2, cityStatePin, addr.country]
    .filter((v) => v && String(v).trim())
    .join("\n");
}

/* Indian-numbering words, matching the Create/Edit panel's summary line. */
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
    if (n >= 10000000) {
      result += toWords(Math.floor(n / 10000000)) + " Crore ";
      n %= 10000000;
    }
    if (n >= 100000) {
      result += toWords(Math.floor(n / 100000)) + " Lakh ";
      n %= 100000;
    }
    if (n >= 1000) {
      result += toWords(Math.floor(n / 1000)) + " Thousand ";
      n %= 1000;
    }
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

/*
 * Turns a document (either a saved Mongo doc or the in-progress edit form)
 * into the numbers the templates render. Item discounts come off each line
 * first; the document-level discount then applies to that subtotal and is
 * spread back across the lines, so the item table, the HSN summary and the
 * totals block all reconcile with each other instead of disagreeing by the
 * discount.
 */
/*
 * Default payee for the invoice QR. Override per call via the `upiId` option
 * once this becomes an organization setting.
 */
export const DEFAULT_UPI_ID = "rzore430@oksbi";

/*
 * Builds the UPI deep link a payment app reads when the invoice QR is scanned.
 *
 * The scheme is fixed by NPCI: `pa` (payee address/VPA), `pn` (payee name),
 * `am` (amount), `cu` (currency), `tn` (transaction note). Apps like GPay,
 * PhonePe and Paytm prefill the amount and payee from these, so the customer
 * only confirms.
 *
 * The amount is taken from the same computeDocument() total the invoice
 * prints, so the QR can never disagree with the figure on the page. It's sent
 * with exactly two decimals — UPI rejects other formats.
 *
 * Kept here rather than in the callers so the preview and the PDF encode a
 * byte-identical string.
 */
export function buildUpiUri(doc, options = {}) {
  const { type = "tax", orgDetails, upiId = DEFAULT_UPI_ID, amount } = options;
  const vpa = (upiId || "").trim();
  if (!vpa) return "";

  const total =
    amount !== undefined ? Number(amount) : computeDocument(doc, type).grandTotal;
  if (!(total > 0)) return "";

  const numberKey = NUMBER_KEY[type] || NUMBER_KEY.tax;
  const params = new URLSearchParams({
    pa: vpa,
    pn: (orgDetails?.companyName || "Payee").trim(),
    am: total.toFixed(2),
    cu: "INR",
  });
  const ref = doc?.[numberKey];
  if (ref) params.set("tn", `${DOC_LABEL[type] || "Invoice"} ${ref}`);

  // URLSearchParams encodes spaces as "+", which some UPI apps read literally.
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

// All standard Indian GST slabs: 0%, 5%, 12%, 18%, 28% plus the special 40%
// rate that applies to select goods only.
export const GST_RATES = [0, 5, 12, 18, 28, 40];

/*
 * Splits a taxable amount into CGST+SGST (intra-state) or IGST (inter-state)
 * at the given GST rate. Kept as its own function — separate from the rest of
 * the document math — because the CGST/SGST vs IGST choice is a distinct
 * piece of tax logic (which pair applies depends only on transactionType,
 * never on the item or the rest of the totals) and both the frontend live
 * summary and this module's own item/HSN rows need the exact same split.
 *
 * Rule: intra-state splits the rate evenly across CGST + SGST; inter-state
 * charges the full rate as IGST. Never both.
 */
export function splitGst(taxableAmount, gstRate, transactionType = "intra") {
  const rate = Number(gstRate) || 0;
  const amount = Number(taxableAmount) || 0;
  const isInterState = transactionType === "inter";
  const halfRate = rate / 2;
  return {
    isInterState,
    cgstRate: isInterState ? 0 : halfRate,
    sgstRate: isInterState ? 0 : halfRate,
    igstRate: isInterState ? rate : 0,
    cgst: isInterState ? 0 : (amount * halfRate) / 100,
    sgst: isInterState ? 0 : (amount * halfRate) / 100,
    igst: isInterState ? (amount * rate) / 100 : 0,
  };
}

export function computeDocument(doc, type = "tax") {
  const supportsTax = type !== "deliveryChallan";
  const taxFlagKey = type === "quotation" ? "isTaxQuotation" : "isTaxInvoice";
  const transactionType = doc.transactionType === "inter" ? "inter" : "intra";
  const isTax = supportsTax && !!doc[taxFlagKey];

  const baseRows = (doc.items || []).map((it) => {
    const rate = parseFloat(it.rate) || 0;
    const qty = parseFloat(it.quantity) || 0;
    const gstRate = GST_RATES.includes(Number(it.gstRate))
      ? Number(it.gstRate)
      : (GST_RATES.includes(Number(doc.gstRate)) ? Number(doc.gstRate) : 18);
    // When the item's rate already includes GST (carried over from the
    // catalog Item/variant's own taxInclusive flag), extract the taxable
    // value from it instead of taxing the tax-inclusive price again.
    const unitTaxable = it.taxInclusive ? rate / (1 + gstRate / 100) : rate;
    const sub = unitTaxable * qty;
    const disc =
      it.discountType === "percentage"
        ? (sub * (parseFloat(it.discount) || 0)) / 100
        : parseFloat(it.discount) || 0;
    return {
      name: it.name || it.itemId?.name || "",
      description: it.description || "",
      hsn: it.hsn || "",
      rate,
      qty,
      gstRate,
      taxable: sub - disc,
      discountAmount: disc,
      discountPct: it.discountType === "percentage" ? parseFloat(it.discount) || 0 : (sub > 0 ? (disc / sub) * 100 : 0),
    };
  });

  const grossTaxable = baseRows.reduce((s, r) => s + r.taxable, 0);
  const docDiscount = doc.discount || {};
  const discountValue = parseFloat(docDiscount.value) || 0;
  const documentDiscount =
    discountValue > 0
      ? docDiscount.type === "percentage"
        ? (grossTaxable * discountValue) / 100
        : Math.min(discountValue, grossTaxable)
      : 0;
  const netFactor =
    grossTaxable > 0 ? (grossTaxable - documentDiscount) / grossTaxable : 1;

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
    hsnMap[key].cgst += r.cgst;
    hsnMap[key].sgst += r.sgst;
    hsnMap[key].igst += r.igst;
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
    discountType: docDiscount.type,
    totalQty: rows.reduce((s, r) => s + r.qty, 0),
    totalTaxable: rows.reduce((s, r) => s + r.taxable, 0),
    totalCGST: rows.reduce((s, r) => s + r.cgst, 0),
    totalSGST: rows.reduce((s, r) => s + r.sgst, 0),
    totalIGST: rows.reduce((s, r) => s + r.igst, 0),
    grandTotal,
    hsnRows: Object.keys(hsnMap).map((k) => hsnMap[k]),
    amountInWords: numberToWords(grandTotal),
  };
}

/* ----------------------------------------------------------------- styles */

/*
 * One base stylesheet plus a per-template override block. The markup below is
 * identical for every template — only these rules change — which is what keeps
 * the designs from drifting apart in content. Adding a template means adding a
 * block here plus its name to DOCUMENT_TEMPLATES — and, because the backend is
 * CommonJS and can't import this module, to the `style` enums in the document
 * models and the TEMPLATES list in DocumentTemplateSettings.
 */
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
/* The encoder emits a viewBox-only <svg>; pin the rendered size here so the
   module stays crisp in print instead of inheriting an arbitrary width. */
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

const TEMPLATE_CSS = {
  // Formal, fully-ruled GST invoice — the long-standing default.
  Classic: ``,

  // Colour-forward: solid accent header band, ruled-free item rows with zebra
  // striping, and the totals lifted into a tinted card.
  Modern: `
.dcsheet.t-Modern {
  --accent: #0085FF;
  --line: #D8DEE7;
  --radius: 10px;
  --pad: 10px;
  font-family: "Segoe UI", Arial, Helvetica, sans-serif;
}
.dcsheet.t-Modern .dc-header {
  background: var(--accent);
  color: #fff;
  padding: 14px 16px;
  border-radius: var(--radius);
  margin-bottom: 10px;
}
.dcsheet.t-Modern .dc-title, .dcsheet.t-Modern .dc-subtitle { color: #fff; }
.dcsheet.t-Modern .dc-title { font-size: 16px; letter-spacing: .5px; }
.dcsheet.t-Modern .dc-meta { border-color: var(--line); }
.dcsheet.t-Modern .dc-cust, .dcsheet.t-Modern .dc-mcell { border-color: var(--line); }
.dcsheet.t-Modern .dc-mcell { border-width: 0 0 1px 1px; }
.dcsheet.t-Modern .dc-items { border-color: var(--line); border-radius: var(--radius); overflow: hidden; margin-top: 10px; }
.dcsheet.t-Modern .dc-items th {
  background: #F1F6FC; color: #24303F; border: 0; border-bottom: 1px solid var(--line);
  text-transform: uppercase; font-size: 9px; letter-spacing: .4px;
}
.dcsheet.t-Modern .dc-items td { border: 0; border-bottom: 1px solid #EDF1F6; }
.dcsheet.t-Modern .dc-items tbody tr:nth-child(even) td { background: #FAFCFF; }
.dcsheet.t-Modern .dc-totals { border: 0; margin-top: 10px; gap: 10px; }
.dcsheet.t-Modern .dc-totals-left { border: 1px solid var(--line); border-radius: var(--radius); }
.dcsheet.t-Modern .dc-totals-right { background: #F1F6FC; border-radius: var(--radius); }
.dcsheet.t-Modern .dc-grand { color: var(--accent); }
.dcsheet.t-Modern .dc-hsn { border-color: var(--line); border-radius: var(--radius); overflow: hidden; }
.dcsheet.t-Modern .dc-hsn th { background: #F1F6FC; border-color: var(--line); }
.dcsheet.t-Modern .dc-hsn td { border-color: #EDF1F6; }
.dcsheet.t-Modern .dc-footer { border-color: var(--line); border-radius: var(--radius); }
.dcsheet.t-Modern .dc-notes { border-color: var(--line); }
`,

  // Stripped back: no fills or boxes, hairline rules only, airy spacing and
  // quiet uppercase labels.
  Minimal: `
.dcsheet.t-Minimal {
  --accent: #111;
  --line: #E3E3E3;
  --muted: #777;
  --pad: 10px;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
}
.dcsheet.t-Minimal .dc-header { border-bottom: 1px solid var(--line); padding-bottom: 16px; margin-bottom: 14px; }
.dcsheet.t-Minimal .dc-title { color: #111; font-weight: 600; letter-spacing: 2px; font-size: 14px; }
.dcsheet.t-Minimal .dc-subtitle { color: var(--muted); font-weight: normal; }
.dcsheet.t-Minimal .dc-meta { border: 0; }
.dcsheet.t-Minimal .dc-cust { border-right: 0; padding-left: 0; }
.dcsheet.t-Minimal .dc-mcell { border: 0; padding: 4px 6px 8px 0; }
.dcsheet.t-Minimal .dc-mcell > span:first-child { color: var(--muted); font-size: 9px; text-transform: uppercase; letter-spacing: .6px; }
.dcsheet.t-Minimal .dc-label { font-weight: 600; }
.dcsheet.t-Minimal .dc-items { border: 0; margin-top: 14px; }
.dcsheet.t-Minimal .dc-items th {
  border: 0; border-bottom: 1px solid #111; padding-left: 0; padding-right: 0;
  text-transform: uppercase; font-size: 9px; letter-spacing: .6px; font-weight: 600;
}
.dcsheet.t-Minimal .dc-items td { border: 0; border-bottom: 1px solid var(--line); padding: 7px 0; }
.dcsheet.t-Minimal .dc-items th + th, .dcsheet.t-Minimal .dc-items td + td { padding-left: 8px; }
.dcsheet.t-Minimal .dc-item-name { font-weight: 600; }
.dcsheet.t-Minimal .dc-totals { border: 0; margin-top: 14px; }
.dcsheet.t-Minimal .dc-totals-left { border-right: 0; padding-left: 0; }
.dcsheet.t-Minimal .dc-totals-right { padding-right: 0; }
.dcsheet.t-Minimal .dc-trow.sep { border-bottom: 1px solid var(--line); padding-bottom: 6px; }
.dcsheet.t-Minimal .dc-grand { border-top: 1px solid #111; margin-top: 6px; padding-top: 8px; }
.dcsheet.t-Minimal .dc-hsn { border: 0; margin-top: 16px; }
.dcsheet.t-Minimal .dc-hsn th { border: 0; border-bottom: 1px solid #111; padding-left: 0; text-transform: uppercase; font-size: 9px; letter-spacing: .6px; }
.dcsheet.t-Minimal .dc-hsn td { border: 0; border-bottom: 1px solid var(--line); padding-left: 0; }
.dcsheet.t-Minimal .dc-footer { border: 0; border-top: 1px solid var(--line); margin-top: 16px; padding-top: 10px; }
.dcsheet.t-Minimal .dc-notes { border-right: 0; padding-left: 0; }
.dcsheet.t-Minimal .dc-sign { padding-right: 0; }
`,

  // Formal and typographic: serif faces, a double rule under a centred
  // masthead, and warm tinted headings.
  Elegant: `
.dcsheet.t-Elegant {
  --accent: #7A5C2E;
  --line: #C9BCA4;
  --ink: #23201B;
  --pad: 10px;
  font-family: Georgia, "Times New Roman", serif;
}
.dcsheet.t-Elegant .dc-header {
  display: block; text-align: center;
  border-bottom: 3px double var(--accent);
  padding-bottom: 14px; margin-bottom: 14px;
}
.dcsheet.t-Elegant .dc-org { display: block; }
.dcsheet.t-Elegant .dc-logo { margin: 0 auto 6px; display: block; }
.dcsheet.t-Elegant .dc-addr { max-width: none; }
.dcsheet.t-Elegant .dc-company { font-size: 20px; letter-spacing: 1px; font-weight: normal; }
.dcsheet.t-Elegant .dc-title-block { text-align: center; margin-top: 10px; }
.dcsheet.t-Elegant .dc-title { color: var(--accent); letter-spacing: 4px; font-size: 14px; font-weight: normal; }
.dcsheet.t-Elegant .dc-subtitle { font-weight: normal; font-style: italic; color: #6B6355; }
.dcsheet.t-Elegant .dc-meta, .dcsheet.t-Elegant .dc-cust,
.dcsheet.t-Elegant .dc-mcell, .dcsheet.t-Elegant .dc-items,
.dcsheet.t-Elegant .dc-items th, .dcsheet.t-Elegant .dc-items td,
.dcsheet.t-Elegant .dc-hsn, .dcsheet.t-Elegant .dc-hsn th,
.dcsheet.t-Elegant .dc-hsn td, .dcsheet.t-Elegant .dc-totals,
.dcsheet.t-Elegant .dc-totals-left, .dcsheet.t-Elegant .dc-footer,
.dcsheet.t-Elegant .dc-notes { border-color: var(--line); }
.dcsheet.t-Elegant .dc-items th, .dcsheet.t-Elegant .dc-hsn th {
  background: #F7F3EA; color: var(--accent);
  text-transform: uppercase; font-size: 9px; letter-spacing: 1px; font-weight: normal;
}
.dcsheet.t-Elegant .dc-label { font-weight: normal; color: var(--accent); text-transform: uppercase; font-size: 9px; letter-spacing: 1px; }
.dcsheet.t-Elegant .dc-grand { border-top: 3px double var(--accent); margin-top: 6px; font-weight: normal; }
/* The double rule reads as a formal ledger divider above two GST lines
   (CGST + SGST); with only one tax line (IGST) it looks like a mistake, so
   collapse it to a plain single rule for that case. */
.dcsheet.t-Elegant .dc-totals-right.dc-tax-single .dc-grand { border-top: 1px solid var(--line); }
.dcsheet.t-Elegant .dc-sign-line { border-top-color: var(--accent); }
`,

  // Dense: smaller type and tighter padding so long item lists stay on one
  // page. Same ruled structure as Classic, just scaled down.
  Compact: `
.dcsheet.t-Compact {
  --accent: #2B3A4A;
  --line: #B9C0C9;
  --pad: 5px;
  font-size: 10px;
  line-height: 1.25;
  padding: 14px;
}
.dcsheet.t-Compact .dc-header { padding-bottom: 8px; }
.dcsheet.t-Compact .dc-logo { width: 42px; height: 42px; }
.dcsheet.t-Compact .dc-company { font-size: 13px; }
.dcsheet.t-Compact .dc-addr, .dcsheet.t-Compact .dc-gstin, .dcsheet.t-Compact .dc-contact { font-size: 9px; }
.dcsheet.t-Compact .dc-title { font-size: 12px; }
.dcsheet.t-Compact .dc-items, .dcsheet.t-Compact .dc-hsn { font-size: 9px; }
.dcsheet.t-Compact .dc-items th, .dcsheet.t-Compact .dc-hsn th { background: #EEF1F5; padding: 3px 4px; }
.dcsheet.t-Compact .dc-items td, .dcsheet.t-Compact .dc-hsn td { padding: 3px 4px; }
.dcsheet.t-Compact .dc-grand { font-size: 12px; padding-top: 5px; }
.dcsheet.t-Compact .dc-terms { font-size: 8px; }
.dcsheet.t-Compact .dc-sign-img { height: 30px; }
`,

  // Business-formal: dark masthead bar with the title reversed out of it, navy
  // table headings and a hairline grid.
  Corporate: `
.dcsheet.t-Corporate {
  --accent: #1B2A41;
  --line: #C6CCD5;
  --radius: 4px;
  --pad: 9px;
  font-family: "Segoe UI", Arial, Helvetica, sans-serif;
}
.dcsheet.t-Corporate .dc-header {
  background: var(--accent);
  color: #fff;
  padding: 12px 14px;
  border-bottom: 3px solid #C8A047;
  margin-bottom: 10px;
}
.dcsheet.t-Corporate .dc-title, .dcsheet.t-Corporate .dc-subtitle { color: #fff; }
.dcsheet.t-Corporate .dc-title { color: #E7C87A; letter-spacing: 2px; }
.dcsheet.t-Corporate .dc-items th, .dcsheet.t-Corporate .dc-hsn th {
  background: var(--accent); color: #fff; border-color: var(--accent);
  text-transform: uppercase; font-size: 9px; letter-spacing: .5px;
}
.dcsheet.t-Corporate .dc-meta, .dcsheet.t-Corporate .dc-cust,
.dcsheet.t-Corporate .dc-mcell, .dcsheet.t-Corporate .dc-items,
.dcsheet.t-Corporate .dc-items td, .dcsheet.t-Corporate .dc-hsn,
.dcsheet.t-Corporate .dc-hsn td, .dcsheet.t-Corporate .dc-totals,
.dcsheet.t-Corporate .dc-totals-left, .dcsheet.t-Corporate .dc-footer,
.dcsheet.t-Corporate .dc-notes { border-color: var(--line); }
.dcsheet.t-Corporate .dc-label { color: var(--accent); }
.dcsheet.t-Corporate .dc-totals-right { background: #F3F5F8; }
.dcsheet.t-Corporate .dc-grand { color: var(--accent); border-top: 2px solid var(--accent); margin-top: 6px; }
.dcsheet.t-Corporate .dc-sign-line { border-top-color: var(--accent); }
`,

  // High-contrast colour: emerald accents, rounded corners, tinted section
  // headings — reads well on screen and in colour print.
  Vibrant: `
.dcsheet.t-Vibrant {
  --accent: #0E9F6E;
  --line: #CFE7DD;
  --radius: 12px;
  --pad: 10px;
  font-family: "Segoe UI", Arial, Helvetica, sans-serif;
}
.dcsheet.t-Vibrant .dc-header {
  border-bottom: 4px solid var(--accent);
  padding-bottom: 12px; margin-bottom: 12px;
}
.dcsheet.t-Vibrant .dc-title {
  background: var(--accent); color: #fff;
  padding: 4px 10px; border-radius: 999px; display: inline-block;
  letter-spacing: 1px;
}
.dcsheet.t-Vibrant .dc-subtitle { color: #6B7B76; }
.dcsheet.t-Vibrant .dc-meta { border-color: var(--line); }
.dcsheet.t-Vibrant .dc-cust, .dcsheet.t-Vibrant .dc-mcell { border-color: var(--line); }
.dcsheet.t-Vibrant .dc-cust { background: #F3FBF7; }
.dcsheet.t-Vibrant .dc-items { border-color: var(--line); border-radius: var(--radius); overflow: hidden; margin-top: 10px; }
.dcsheet.t-Vibrant .dc-items th {
  background: var(--accent); color: #fff; border: 0;
  text-transform: uppercase; font-size: 9px; letter-spacing: .5px;
}
.dcsheet.t-Vibrant .dc-items td { border: 0; border-bottom: 1px solid var(--line); }
.dcsheet.t-Vibrant .dc-totals { border: 0; margin-top: 10px; gap: 10px; }
.dcsheet.t-Vibrant .dc-totals-left { border: 1px solid var(--line); border-radius: var(--radius); }
.dcsheet.t-Vibrant .dc-totals-right { background: #EAF7F1; border-radius: var(--radius); }
.dcsheet.t-Vibrant .dc-grand { color: var(--accent); }
.dcsheet.t-Vibrant .dc-hsn { border-color: var(--line); border-radius: var(--radius); overflow: hidden; }
.dcsheet.t-Vibrant .dc-hsn th { background: #EAF7F1; border-color: var(--line); color: #0B6B4B; }
.dcsheet.t-Vibrant .dc-hsn td { border-color: var(--line); }
.dcsheet.t-Vibrant .dc-footer { border-color: var(--line); border-radius: var(--radius); }
.dcsheet.t-Vibrant .dc-notes { border-color: var(--line); }
`,

  Modern: `
.dcsheet.t-Modern {
  --accent: #0b5ed7;
  --line: #dcdcdc;
  --ink: #111;
  --muted: #555;
  --pad: 6px;
  --radius: 0px;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10.5px;
  padding: 24px;
}
.dcsheet.t-Modern .dc-header { border: 0; padding-bottom: 10px; align-items: flex-start; }
.dcsheet.t-Modern .dc-title { color: var(--accent); font-size: 12px; letter-spacing: 2px; }
.dcsheet.t-Modern .dc-subtitle { color: var(--muted); font-weight: normal; font-size: 8.5px; text-transform: uppercase; letter-spacing: .5px; }
.dcsheet.t-Modern .dc-logo { width: 90px; height: auto; }
.dcsheet.t-Modern .dc-company { font-size: 15px; font-weight: bold; margin-bottom: 4px; }
.dcsheet.t-Modern .dc-addr { font-size: 9.5px; color: var(--ink); max-width: 320px; }
.dcsheet.t-Modern .dc-gstin { font-size: 9.5px; margin-top: 3px; }
.dcsheet.t-Modern .dc-contact { font-size: 9.5px; margin-top: 2px; }

/* meta + address block: no boxes, plain text, generous line spacing */
.dcsheet.t-Modern .dc-meta { display: block; border: 0; margin-top: 14px; }
.dcsheet.t-Modern .dc-cust-row { display: flex; gap: 24px; }
.dcsheet.t-Modern .dc-cust { border: 0; padding: 0; display: block; }
.dcsheet.t-Modern .dc-cust > div, .dcsheet.t-Modern .dc-addr-col > div { margin-bottom: 3px; }
.dcsheet.t-Modern .dc-label { font-weight: bold; }
.dcsheet.t-Modern .dc-addr-box { min-height: 0; margin-bottom: 8px; }
.dcsheet.t-Modern .dc-metagrid { display: block; margin-top: 10px; }
.dcsheet.t-Modern .dc-mcell { border: 0; display: inline-block; padding: 0 24px 4px 0; }
.dcsheet.t-Modern .dc-mcell span { font-weight: bold; }
.dcsheet.t-Modern .dc-mcell b { display: inline; font-weight: normal; margin-left: 3px; }
.dcsheet.t-Modern .dc-span2 { display: none; }

/* items table: hairline rules only, no header fill, no vertical borders */
.dcsheet.t-Modern .dc-items { border: 0; border-top: 1px solid var(--ink); font-size: 9.5px; margin-top: 14px; }
.dcsheet.t-Modern .dc-items th { border: 0; border-bottom: 1px solid var(--ink); padding: 5px 4px; font-weight: bold; }
.dcsheet.t-Modern .dc-items td { border: 0; border-bottom: 1px solid var(--line); padding: 6px 4px; }
.dcsheet.t-Modern .dc-item-name { font-weight: bold; }
.dcsheet.t-Modern .dc-item-desc { font-size: 9px; color: var(--muted); margin-top: 3px; }

/* totals: right-aligned, no borders, bold grand total with rule above */
.dcsheet.t-Modern .dc-totals { display: block; border: 0; margin-top: 10px; }
.dcsheet.t-Modern .dc-totals-left { border: 0; padding: 0; }
.dcsheet.t-Modern .dc-totals-right { padding: 0; max-width: 260px; margin-left: auto; }
.dcsheet.t-Modern .dc-trow { padding: 2px 0; }
.dcsheet.t-Modern .dc-trow.sep { border: 0; }
.dcsheet.t-Modern .dc-grand { border-top: 1px solid var(--ink); margin-top: 4px; padding-top: 6px; font-size: 16px; font-weight: bold; }

/* bank + QR row: comes after totals, left-aligned, no card/box styling */
.dcsheet.t-Modern .dc-bank-row { margin-top: 0; align-items: flex-start; }
.dcsheet.t-Modern .dc-bank .dc-label { margin-bottom: 3px; }
.dcsheet.t-Modern .dc-bank > div { margin-bottom: 2px; }
.dcsheet.t-Modern .dc-qr-img svg { width: 80px; height: 80px; }
.dcsheet.t-Modern .dc-qr-cap { display: none; }

/* HSN summary: thin rules, no shaded header */
.dcsheet.t-Modern .dc-hsn { border: 0; border-top: 1px solid var(--ink); font-size: 9.5px; }
.dcsheet.t-Modern .dc-hsn th { border: 0; border-bottom: 1px solid var(--ink); }
.dcsheet.t-Modern .dc-hsn td { border: 0; border-bottom: 1px solid var(--line); }

/* footer: flex layout for bank and signature side by side */
.dcsheet.t-Modern .dc-footer { display: flex; justify-content: space-between; align-items: flex-end; border: 0; margin-top: 20px; }
.dcsheet.t-Modern .dc-notes { border: 0; padding: 0; max-width: 40%; }
.dcsheet.t-Modern .dc-terms { font-size: 8.5px; margin-top: 4px; }
.dcsheet.t-Modern .dc-sign { padding: 0; margin-top: 0; display: block; text-align: right; }
.dcsheet.t-Modern .dc-sign-img { max-height: 40px; margin-left: auto; object-fit: contain; }
.dcsheet.t-Modern .dc-sign-line { border: 0; margin-top: 4px; font-size: 9px; }
`,
  Professional: `
.dcsheet.t-Professional {
  --accent: #2f6fed;
  --line: #e0e0e0;
  --muted: #666;
  --pad: 12px;
  font-family: Arial, Helvetica, sans-serif;
  padding: 0;
  position: relative;
}
.dcsheet.t-Professional .dc-header {
  border-top: 8px solid var(--accent);
  padding: 20px 24px 10px;
  margin: 0;
}
.dcsheet.t-Professional .dc-title { color: var(--accent); letter-spacing: 1px; font-size: 16px; }
.dcsheet.t-Professional .dc-subtitle { color: var(--muted); font-size: 9px; margin-top: 4px; }
.dcsheet.t-Professional .dc-company { font-size: 15px; font-weight: bold; margin-bottom: 4px; }
.dcsheet.t-Professional .dc-addr { max-width: 280px; font-size: 10px; color: #333; }
.dcsheet.t-Professional .dc-gstin { font-size: 10px; margin-top: 6px; }

.dcsheet.t-Professional .dc-prof-meta {
  display: flex;
  background: #f7f8fa;
  border-radius: 6px;
  margin: 10px 24px;
  padding: 16px;
}
.dcsheet.t-Professional .dc-prof-meta > div { flex: 1; }
.dcsheet.t-Professional .dc-prof-meta .dc-label { color: var(--muted); font-weight: normal; font-size: 10px; margin-bottom: 6px; }
.dcsheet.t-Professional .dc-prof-name { font-weight: bold; font-size: 12px; margin-bottom: 4px; }
.dcsheet.t-Professional .dc-prof-grid { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; font-size: 10px; }

.dcsheet.t-Professional .dc-items {
  border: 0;
  margin: 16px 24px 0;
  width: calc(100% - 48px);
}
.dcsheet.t-Professional .dc-items th {
  border: 0; border-bottom: 1px solid var(--line);
  color: var(--muted); text-transform: uppercase; font-size: 9px;
  padding: 6px 4px;
}
.dcsheet.t-Professional .dc-items td {
  border: 0; border-bottom: 1px solid var(--line);
  padding: 8px 4px;
}

.dcsheet.t-Professional .dc-totals {
  display: block; border: 0; margin: 10px 24px;
}
.dcsheet.t-Professional .dc-totals-left { border: 0; padding: 0; }
.dcsheet.t-Professional .dc-totals-right { padding: 0; max-width: 280px; margin-left: auto; }
.dcsheet.t-Professional .dc-trow { padding: 3px 0; }
.dcsheet.t-Professional .dc-trow.sep { border: 0; }
.dcsheet.t-Professional .dc-grand {
  border-top: 1px solid #111;
  margin-top: 6px; padding-top: 8px;
  font-size: 14px; color: #111;
}

.dcsheet.t-Professional .dc-bank-row { margin-top: 0; align-items: flex-start; }
.dcsheet.t-Professional .dc-bank { font-size: 10px; }
.dcsheet.t-Professional .dc-bank .dc-label { font-weight: bold; margin-bottom: 4px; }
.dcsheet.t-Professional .dc-bank-grid { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; }

.dcsheet.t-Professional .dc-footer { display: flex; justify-content: space-between; align-items: flex-end; border: 0; margin: 20px 24px; }
.dcsheet.t-Professional .dc-notes { border: 0; padding: 0; max-width: 50%; }
.dcsheet.t-Professional .dc-sign { padding: 0; margin-top: 0; display: block; text-align: right; }
.dcsheet.t-Professional .dc-sign-img { max-height: 40px; margin-left: auto; object-fit: contain; }
.dcsheet.t-Professional .dc-sign-line { border-top: 1px solid var(--line); margin-top: 4px; padding-top: 4px; font-size: 9px; }
`,
  Landscape: `
.dcsheet.t-Landscape {
  --ink: #222;
  --line: #333;
  --muted: #555;
  --accent: #2f6fed;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10px;
  padding: 12px;
  background: #fff;
  color: var(--ink);
}
.dcsheet.t-Landscape .ls-page {
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.dcsheet.t-Landscape .ls-header-row {
  position: relative;
  text-align: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
}
.dcsheet.t-Landscape .ls-title {
  color: var(--accent);
  font-weight: bold;
  font-size: 15px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.dcsheet.t-Landscape .ls-copy {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 8.5px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.dcsheet.t-Landscape .ls-meta-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  border-bottom: 1px solid var(--line);
}
.dcsheet.t-Landscape .ls-meta-col {
  padding: 10px 12px;
  border-right: 1px solid var(--line);
}
.dcsheet.t-Landscape .ls-meta-col:last-child {
  border-right: 0;
}
.dcsheet.t-Landscape .ls-comp-name { font-weight: bold; font-size: 12px; margin-bottom: 3px; }
.dcsheet.t-Landscape .ls-cust-title { font-size: 9px; color: var(--muted); text-transform: uppercase; margin-bottom: 4px; }
.dcsheet.t-Landscape .ls-cust-name { font-weight: bold; font-size: 11px; margin-bottom: 4px; }
.dcsheet.t-Landscape .ls-meta-grid { display: grid; grid-template-columns: auto 1fr; gap: 3px 8px; font-size: 9.5px; }

.dcsheet.t-Landscape .ls-items-wrap {
  border-bottom: 1px solid var(--line);
  min-height: 250px;
  display: flex;
  flex-direction: column;
}
.dcsheet.t-Landscape .ls-items {
  width: 100%;
  flex: 1;
  border-collapse: collapse;
}
.dcsheet.t-Landscape .ls-items th {
  border: 1px solid var(--line);
  padding: 6px 8px;
  font-size: 9px;
  background: #f8f9fa;
  text-transform: uppercase;
  font-weight: bold;
}
.dcsheet.t-Landscape .ls-items td {
  border-left: 1px solid var(--line);
  border-right: 1px solid var(--line);
  border-top: 0;
  border-bottom: 0;
  padding: 6px 8px;
  font-size: 9.5px;
}
.dcsheet.t-Landscape .ls-filler-row {
  height: 100%;
}
.dcsheet.t-Landscape .ls-filler-row td {
  border-top: 0;
  border-bottom: 0;
}

.dcsheet.t-Landscape .ls-totals-row {
  display: grid;
  grid-template-columns: 1fr 280px;
  border-bottom: 1px solid var(--line);
}
.dcsheet.t-Landscape .ls-totals-left {
  padding: 10px 12px;
  border-right: 1px solid var(--line);
  font-size: 9.5px;
}
.dcsheet.t-Landscape .ls-totals-right {
  display: flex;
  flex-direction: column;
}
.dcsheet.t-Landscape .ls-trow {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid var(--line);
  font-size: 9.5px;
}
.dcsheet.t-Landscape .ls-trow:last-child {
  border-bottom: 0;
}
.dcsheet.t-Landscape .ls-trow.grand {
  font-weight: bold;
  font-size: 12px;
  background: #fafafa;
}

.dcsheet.t-Landscape .ls-footer-row {
  display: grid;
  grid-template-columns: 1fr 280px;
  padding: 10px 12px;
}
.dcsheet.t-Landscape .ls-sign-block {
  text-align: right;
}
.dcsheet.t-Landscape .ls-sign-img {
  max-height: 45px;
  margin-left: auto;
  object-fit: contain;
}

.dcsheet.t-Landscape .dc-hsn {
  width: 100%;
  border-collapse: collapse;
  border-bottom: 1px solid var(--line);
}
.dcsheet.t-Landscape .dc-hsn th,
.dcsheet.t-Landscape .dc-hsn td {
  border: 1px solid var(--line);
  padding: 5px 8px;
  font-size: 9px;
}
.dcsheet.t-Landscape .dc-hsn th {
  background: #f8f9fa;
  font-size: 8.5px;
  font-weight: bold;
}
.dcsheet.t-Landscape .dc-hsn tr.tot td {
  font-weight: bold;
  background: #fafafa;
}
`,
  Service: `
.dcsheet.t-Service {
  --ink: #111;
  --muted: #666;
  --blue: #2f6fed;
  --line: #e5e7eb;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10px;
  padding: 24px;
  background: #fff;
  color: var(--ink);
}
.dcsheet.t-Service .srv-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}
.dcsheet.t-Service .srv-title {
  font-size: 18px;
  font-weight: bold;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: #111;
}
.dcsheet.t-Service .srv-subtitle {
  font-size: 8.5px;
  color: var(--muted);
  text-transform: uppercase;
  margin-top: 4px;
}
.dcsheet.t-Service .srv-company {
  font-size: 17px;
  font-weight: bold;
  margin-bottom: 2px;
}
.dcsheet.t-Service .srv-gstin {
  font-weight: bold;
  font-size: 10px;
  margin-bottom: 4px;
}
.dcsheet.t-Service .srv-addr {
  font-size: 10px;
  color: #444;
  max-width: 280px;
}

.dcsheet.t-Service .srv-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}
.dcsheet.t-Service .srv-meta-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 16px;
  font-size: 10px;
  text-align: right;
}

.dcsheet.t-Service .srv-items {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
}
.dcsheet.t-Service .srv-items th {
  background: var(--blue);
  color: #fff;
  font-weight: bold;
  text-transform: uppercase;
  font-size: 9px;
  padding: 8px 10px;
  border: 0;
}
.dcsheet.t-Service .srv-items td {
  padding: 10px;
  border: 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 10px;
}

.dcsheet.t-Service .srv-totals-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-top: 16px;
  margin-top: 8px;
}
.dcsheet.t-Service .srv-trow {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 3px 0;
  font-size: 10px;
}
.dcsheet.t-Service .srv-grand {
  font-size: 14px;
  font-weight: bold;
  color: #111;
  margin-top: 4px;
}

.dcsheet.t-Service .srv-footer-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 32px;
  font-size: 10px;
}
.dcsheet.t-Service .srv-bank-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 12px;
  font-size: 9.5px;
}
`,
  Vintage: `
/* ── outer shell ── */
.dcsheet.t-Vintage { display: flex; flex-direction: column; font-size: 10px; padding: 12px; border: 0; }
/* ── inner page box ── */
.dcsheet.t-Vintage .vt-page { display: flex; flex-direction: column; flex: 1; border: 1px solid var(--ink); overflow: hidden; min-height: 1000px; }
/* ── title bar ── */
.dcsheet.t-Vintage .vt-title { text-align: center; font-size: 13px; font-weight: bold; letter-spacing: 1px; padding: 7px 12px; border-bottom: 1px solid var(--ink); position: relative; }
.dcsheet.t-Vintage .vt-title .vt-copy { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 8px; font-weight: normal; color: var(--muted); }
/* ── company + meta row ── */
.dcsheet.t-Vintage .vt-org-row { display: grid; grid-template-columns: 1fr auto; border-bottom: 1px solid var(--ink); }
.dcsheet.t-Vintage .vt-org { padding: 10px 12px; }
.dcsheet.t-Vintage .vt-org .dc-company { font-size: 13px; font-weight: bold; margin-bottom: 3px; }
.dcsheet.t-Vintage .vt-meta { border-left: 1px solid var(--ink); display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; min-width: 260px; }
.dcsheet.t-Vintage .vt-mcell { padding: 7px 10px; font-size: 9px; }
.dcsheet.t-Vintage .vt-mcell:nth-child(even) { border-left: 1px solid var(--ink); }
.dcsheet.t-Vintage .vt-mcell:nth-child(n+3) { border-top: 1px solid var(--ink); }
.dcsheet.t-Vintage .vt-mcell span { display: block; color: var(--muted); font-size: 8px; margin-bottom: 2px; }
.dcsheet.t-Vintage .vt-mcell b { font-size: 10px; }
/* ── customer + shipping row ── */
.dcsheet.t-Vintage .vt-cust-row { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--ink); }
.dcsheet.t-Vintage .vt-cust-col { padding: 10px 12px; }
.dcsheet.t-Vintage .vt-cust-col:first-child { border-right: 1px solid var(--ink); }
.dcsheet.t-Vintage .vt-cust-col .vt-col-title { font-size: 8px; font-weight: bold; text-transform: uppercase; color: var(--muted); letter-spacing: 0.5px; margin-bottom: 4px; }
.dcsheet.t-Vintage .vt-cust-col .vt-cust-name { font-weight: bold; font-size: 11px; margin-bottom: 2px; }
/* ── items table ── */
.dcsheet.t-Vintage .vt-items-wrap { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.dcsheet.t-Vintage .dc-items { flex: 1; border: 0; margin: 0; width: 100%; }
.dcsheet.t-Vintage .vt-filler-row { height: 100%; }
.dcsheet.t-Vintage .vt-filler-row td { border-top: 0; border-bottom: 0; }
.dcsheet.t-Vintage .dc-items th { background: #f5f5f5; border-color: var(--ink); border-top: 0; }
.dcsheet.t-Vintage .dc-items th:first-child { border-left: 0; }
.dcsheet.t-Vintage .dc-items th:last-child { border-right: 0; }
.dcsheet.t-Vintage .dc-items td { border-top: 0; border-bottom: 0; border-color: var(--ink); }
.dcsheet.t-Vintage .dc-items td:first-child { border-left: 0; }
.dcsheet.t-Vintage .dc-items td:last-child { border-right: 0; }
.dcsheet.t-Vintage .dc-items tbody tr:nth-child(even) { background: #fafafa; }
/* ── totals row ── */
.dcsheet.t-Vintage .vt-totals { display: flex; justify-content: space-between; align-items: flex-start; border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink); padding: 10px 12px; gap: 12px; }
.dcsheet.t-Vintage .vt-totals-left { font-size: 9px; color: var(--muted); }
.dcsheet.t-Vintage .vt-totals-left b { color: var(--ink); font-size: 10px; }
.dcsheet.t-Vintage .vt-totals-right { min-width: 220px; }
.dcsheet.t-Vintage .dc-trow { display: flex; justify-content: space-between; padding: 2px 0; font-size: 10px; }
.dcsheet.t-Vintage .dc-grand { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; border-top: 1px solid var(--ink); margin-top: 4px; padding-top: 4px; }
.dcsheet.t-Vintage .dc-paid { display: flex; justify-content: flex-end; align-items: center; gap: 4px; color: green; font-size: 10px; font-weight: bold; margin-top: 4px; }
.dcsheet.t-Vintage .dc-tick { font-size: 14px; }
/* ── HSN table ── */
.dcsheet.t-Vintage .dc-hsn { margin: 0; border: 0; border-bottom: 1px solid var(--ink); }
.dcsheet.t-Vintage .dc-hsn th, .dcsheet.t-Vintage .dc-hsn td { border-color: var(--ink); }
.dcsheet.t-Vintage .vt-bottom { display: flex; flex-direction: column; }
/* ── footer: bank | signature ── */
.dcsheet.t-Vintage .vt-footer { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--ink); }
.dcsheet.t-Vintage .vt-bank { padding: 0; border-right: 1px solid var(--ink); font-size: 9px; }
.dcsheet.t-Vintage .vt-bank .vt-col-title { font-size: 8px; font-weight: bold; text-transform: uppercase; color: var(--muted); letter-spacing: 0.5px; padding: 7px 12px; border-bottom: 1px solid var(--ink); }
.dcsheet.t-Vintage .vt-bank-grid { display: grid; grid-template-columns: auto 1fr; }
.dcsheet.t-Vintage .vt-bank-cell { padding: 5px 10px; }
.dcsheet.t-Vintage .vt-bank-cell.lbl { color: var(--muted); font-size: 8px; white-space: nowrap; }
.dcsheet.t-Vintage .vt-bank-cell.val { font-weight: bold; }
.dcsheet.t-Vintage .vt-sign { padding: 12px; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; text-align: right; font-size: 9px; min-height: 100px; }
.dcsheet.t-Vintage .vt-sign-img-wrap { overflow: hidden; display: flex; align-items: center; justify-content: center; height: 70px; width: 180px; }
.dcsheet.t-Vintage .vt-sign-img-wrap img { transform: scale(2.2); max-height: 100%; width: 100%; object-fit: contain; }
/* ── notes/terms ── */
.dcsheet.t-Vintage .vt-notes-row { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--ink); font-size: 9px; }
.dcsheet.t-Vintage .vt-notes-col { padding: 10px 12px; }
.dcsheet.t-Vintage .vt-notes-col:first-child { border-right: 1px solid var(--ink); }
`,
};

/* ------------------------------------------------------------------ build */

/*
 * Returns a self-contained HTML fragment: a scoped <style> block plus the
 * document markup. Safe to inject into a page (all rules sit under `.dcsheet`)
 * and equally safe to drop into a bare page for printing.
 */
export function buildDocumentHtml(doc, options = {}) {
  const {
    type = "tax",
    template = DEFAULT_TEMPLATE,
    orgDetails,
    bankDetails,
    dealName: dealNameOverride,
    documentNumber,
    // Pre-encoded UPI QR (see buildUpiUri) and the VPA to print under it.
    upiQrSvg,
    upiId,
    // Which physical copy this render represents — the standard Indian GST
    // invoice practice of printing "ORIGINAL FOR RECIPIENT" / "DUPLICATE FOR
    // TRANSPORTER" / "TRIPLICATE FOR SUPPLIER" as the only difference between
    // otherwise-identical copies of the same document.
    copyType = "original",
  } = options;

  const COPY_TYPE_LABEL = {
    original: "ORIGINAL FOR RECIPIENT",
    duplicate: "DUPLICATE FOR TRANSPORTER",
    triplicate: "TRIPLICATE FOR SUPPLIER",
  };
  const copySubtitle = COPY_TYPE_LABEL[copyType] || COPY_TYPE_LABEL.original;

  const tpl = DOCUMENT_TEMPLATES.includes(template) ? template : DEFAULT_TEMPLATE;
  const org = orgDetails || {};
  const bank = bankDetails || {};
  const docLabel = DOC_LABEL[type] || DOC_LABEL.tax;
  const numberKey = NUMBER_KEY[type] || NUMBER_KEY.tax;

  const t = computeDocument(doc, type);

  const dealName =
    dealNameOverride ||
    doc.deal?.title ||
    doc.deal?.company?.name ||
    doc.deal?.contact?.name ||
    "Customer Name";

  const docNumber = documentNumber ?? doc[numberKey];

  // Notes and terms are per-document free text; the footer block collapses to
  // nothing when both are empty rather than printing placeholder boilerplate.
  const notes = (doc.notes ?? "").trim();
  const terms = (doc.terms ?? "").trim();

  // Tax-off documents show no GST/CGST/SGST/IGST anywhere — no columns, no
  // totals rows, no HSN tax summary — regardless of whether a GSTIN happens
  // to be on file; only doc.isTaxInvoice/isTaxQuotation (t.isTax) decides.
  // When tax IS on: intra-state documents split GST into CGST + SGST (two
  // columns); inter-state ones charge the full rate as IGST (one column) —
  // never both, per splitGst(). The item table, its column count and the
  // HSN summary below all follow whichever pair applies to this document.
  const taxCols = t.isTax ? (tpl === "Professional" || tpl === "Landscape" ? 1 : (t.isInterState ? 1 : 2)) : 0;
  const itemColCount = 6 + taxCols + 1; // #, Item, HSN, Rate, Qty, Taxable, [tax cols], Amount

  const itemTaxCells = (r) => {
    if (!t.isTax) return "";
    // Each row's own rate (r.igstRate/cgstRate/sgstRate, set by splitGst()
    // from that item's own gstRate) — not a single document-level rate —
    // since different items on the same document can carry different GST
    // slabs.
    if (tpl === "Landscape") {
      const ratePct = (r.igstRate || 0) + (r.cgstRate || 0) + (r.sgstRate || 0);
      return `<td class="r">${fmt(r.tax)} (${ratePct}%)</td>`;
    }
    if (tpl === "Professional") {
      return `<td class="r">${r.tax > 0 ? fmt(r.tax) : ""}</td>`;
    }
    if (tpl === "Vintage") {
      return t.isInterState
        ? `<td class="r">${fmt(r.igst)} (${r.igstRate}%)</td>`
        : `<td class="r">${fmt(r.cgst)} (${r.cgstRate}%)</td>
          <td class="r">${fmt(r.sgst)} (${r.sgstRate}%)</td>`;
    }
    return t.isInterState
      ? `<td class="r">${r.igst > 0 ? `${fmt(r.igst)} (${r.igstRate}%)` : ""}</td>`
      : `<td class="r">${r.cgst > 0 ? `${fmt(r.cgst)} (${r.cgstRate}%)` : ""}</td>
        <td class="r">${r.sgst > 0 ? `${fmt(r.sgst)} (${r.sgstRate}%)` : ""}</td>`;
  };

  const itemRows = t.rows.length
    ? t.rows
      .map(
        (r, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td class="dc-item-name">${esc(r.name) || "&mdash;"}${r.description
            ? `<div class="dc-item-desc">${esc(r.description)}</div>`
            : ""
          }</td>
        <td class="c">${esc(r.hsn)}</td>
        <td class="r">${tpl === "Vintage" && r.discountAmount > 0 ? `${fmt(r.taxable / r.qty)}<br/><span style="font-size: 8.5px; color: var(--muted);"><del>${fmt(r.rate)}</del> (-${r.discountPct}%)</span>` : fmt(r.rate)}</td>
        <td class="r nowrap">${r.qty} BOX</td>
        <td class="r">${fmt(r.taxable)}</td>
        ${itemTaxCells(r)}
        <td class="r">${fmt(r.amount)}</td>
      </tr>`
      )
      .join("")
    : `<tr><td class="c" colspan="${itemColCount}">&nbsp;</td></tr>`;

  const hsnRows = t.hsnRows
    .map((r) =>
      t.isInterState
        ? `
      <tr>
        <td class="c">${esc(r.hsn)}</td>
        <td class="c">${fmt(r.taxable)}</td>
        <td class="c">${r.rate}%</td>
        <td class="r">${fmt(r.igst)}</td>
        <td class="c">${fmt(r.igst)}</td>
      </tr>`
        : `
      <tr>
        <td class="c">${esc(r.hsn)}</td>
        <td class="c">${fmt(r.taxable)}</td>
        <td class="c">${r.rate / 2}%</td>
        <td class="r">${fmt(r.cgst)}</td>
        <td class="c">${r.rate / 2}%</td>
        <td class="r">${fmt(r.sgst)}</td>
        <td class="c">${fmt(r.cgst + r.sgst)}</td>
      </tr>`
    )
    .join("");

  const discountRow =
    t.documentDiscount > 0
      ? `<div class="dc-trow"><span class="dc-label">Discount${t.discountType === "percentage" ? ` (${t.discountValue}%)` : ""
      }</span><span>- &#8377;${fmt(t.documentDiscount)}</span></div>`
      : "";

  /*
   * Scan-to-pay block. The caller encodes the UPI link (buildUpiUri) into an
   * SVG and passes it in — the encoder is a per-side dependency, but the link
   * it encodes and the layout around it are defined here, so preview and PDF
   * stay identical. No QR is drawn for a zero-total or non-payable document.
   */
  const qrBlock =
    upiQrSvg && t.grandTotal > 0
      ? `<div class="dc-qr">
          <div class="dc-qr-img">${upiQrSvg}</div>
          <div class="dc-qr-cap">Scan to pay</div>
        </div>`
      : "";

  const css = BASE_CSS + (TEMPLATE_CSS[tpl] || "");

  return `<style>${css}</style>
<div class="dcsheet t-${tpl}">
  ${tpl === "Service" ? `
  <div class="srv-header">
    <div>
      <div class="srv-title">${t.isTax ? "TAX " + esc(docLabel) : esc(docLabel)}</div>
      <div class="srv-subtitle">${copySubtitle}</div>
    </div>
    <div style="text-align: right;">
      <div class="srv-company">${esc(org.companyName || "Your Company")}</div>
      ${org.gstin ? `<div class="srv-gstin">GSTIN ${esc(org.gstin)}</div>` : ""}
      <div class="srv-addr">${esc(org.address || "")}</div>
    </div>
  </div>
  <div class="srv-meta-row">
    <div>
      <div style="color: var(--muted); font-size: 9px; text-transform: uppercase; margin-bottom: 4px;">Bill To:</div>
      <div style="font-weight: bold; font-size: 12px; margin-bottom: 2px;">${esc(dealName)}</div>
      ${doc.receiverGSTIN ? `<div style="font-size: 10px;">GSTIN: ${esc(doc.receiverGSTIN)}</div>` : ""}
      <div style="white-space: pre-line; font-size: 10px; margin-top: 2px;">${esc(formatPostalAddress(doc.billingAddress))}</div>
    </div>
    <div>
      <div class="srv-meta-grid">
        <div><b>Invoice #:</b></div><div><b>${esc(docNumber || "—")}</b></div>
        <div><b>Invoice Date:</b></div><div><b>${esc(formatDate(doc.date) || "—")}</b></div>
        <div><b>Due Date:</b></div><div><b>${esc(formatDate(doc.dueDate) || "—")}</b></div>
        <div><b>Place of Supply:</b></div><div><b>${esc(doc.placeOfSupply || "—")}</b></div>
      </div>
    </div>
  </div>
  <table class="srv-items">
    <thead>
      <tr>
        <th style="width: 35px;" class="c">#</th>
        <th style="text-align: left;">Item</th>
        <th style="width: 100px;" class="c">HSN/SAC</th>
        <th style="width: 120px;" class="r">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${t.rows.map((r, i) => `
        <tr>
          <td class="c">${i + 1}</td>
          <td>
            <div style="font-weight: bold;">${esc(r.name) || "&mdash;"}</div>
            ${r.description ? `<div style="color: var(--muted); font-size: 9px; margin-top: 2px;">${esc(r.description)}</div>` : ""}
          </td>
          <td class="c">${esc(r.hsn || "—")}</td>
          <td class="r" style="font-weight: bold;">&#8377;${fmt(r.amount)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  <div style="margin-top: 8px;">
    <div style="display: flex; justify-content: flex-end;">
      <div style="min-width: 240px;">
        <div class="srv-trow"><span>Taxable Amount</span><span>&#8377;${fmt(t.grossTaxable)}</span></div>
        ${discountRow}
        <div class="srv-trow srv-grand"><span>Total</span><span>&#8377;${fmt(t.grandTotal)}</span></div>
        ${doc.status === "Paid" ? `<div style="display: flex; justify-content: flex-end; align-items: center; gap: 4px; color: green; font-size: 10px; font-weight: bold; margin-top: 6px;"><span style="font-size: 14px;">&#10003;</span> Amount Paid</div>` : ""}
      </div>
    </div>
    <div style="border-top: 1px solid var(--line); margin-top: 12px; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--muted);">
      <div>Total Items / Qty : ${t.rows.length} / ${t.totalQty}</div>
      <div>Total amount (in words): INR ${esc(t.amountInWords)}</div>
    </div>
  </div>
  <div class="srv-footer-row">
    <div>
      <div style="font-weight: bold; margin-bottom: 4px;">Bank Details:</div>
      <div class="srv-bank-grid">
        <div style="color:var(--muted);">Bank</div><div>${esc(bank.bank || "—")}</div>
        <div style="color:var(--muted);">Account Holder</div><div>${esc(bank.accountHolder || org.companyName || "—")}</div>
        <div style="color:var(--muted);">Account #</div><div>${esc(bank.accountNumber || "—")}</div>
        <div style="color:var(--muted);">IFSC Code</div><div>${esc(bank.ifscCode || "—")}</div>
        <div style="color:var(--muted);">Branch</div><div>${esc(bank.branch || "—")}</div>
      </div>
    </div>
    <div style="text-align: right; color: #555;">
      <div style="font-size: 9.5px; margin-bottom: 4px;">For ${esc(org.companyName || "Your Company")}</div>
      ${(doc.signature || org.signatureUrl) ? `<img src="${esc(doc.signature || org.signatureUrl)}" style="max-height: 45px; margin-left: auto; display: block; object-fit: contain;" />` : `<div style="height:40px;"></div>`}
      <div style="font-size: 9px; margin-top: 4px;">Authorized Signatory</div>
    </div>
  </div>
  ` : `
  ${tpl === "Landscape" ? `
  <div class="ls-page">
    <div class="ls-header-row">
      <div class="ls-title">${t.isTax ? "TAX " + esc(docLabel) : esc(docLabel)}</div>
      <div class="ls-copy">${copySubtitle}</div>
    </div>
    <div class="ls-meta-row">
      <div class="ls-meta-col">
        <div class="ls-comp-name">${esc(org.companyName || "Your Company")}</div>
        ${org.gstin ? `<div style="margin-top:2px;"><b>GSTIN:</b> ${esc(org.gstin)}</div>` : ""}
        <div style="margin-top:2px;">${esc(org.address || "")}</div>
      </div>
      <div class="ls-meta-col">
        <div class="ls-cust-title">Customer Details:</div>
        <div class="ls-cust-name">${esc(dealName)}</div>
        ${doc.receiverGSTIN ? `<div style="font-size:9px;"><b>GSTIN:</b> ${esc(doc.receiverGSTIN)}</div>` : ""}
        ${doc.placeOfSupply ? `<div style="font-size:9px;margin-top:2px;"><b>Place of Supply:</b> ${esc(doc.placeOfSupply)}</div>` : ""}
      </div>
      <div class="ls-meta-col">
        <div class="ls-meta-grid">
          <div><b>Invoice #:</b></div><div style="text-align:right;font-weight:bold;">${esc(docNumber || "—")}</div>
          <div><b>Invoice Date:</b></div><div style="text-align:right;font-weight:bold;">${esc(formatDate(doc.date) || "—")}</div>
          <div><b>Due Date:</b></div><div style="text-align:right;font-weight:bold;">${esc(formatDate(doc.dueDate) || "—")}</div>
        </div>
      </div>
    </div>
    <div class="ls-items-wrap">
      <table class="ls-items">
        <thead>
          <tr>
            <th style="width:30px;" class="c">#</th>
            <th>Item</th>
            <th style="width:70px;" class="c">HSN/SAC</th>
            <th style="width:85px;" class="r">Rate/Item</th>
            <th style="width:45px;" class="r">Qty</th>
            <th style="width:80px;" class="r">Taxable Value</th>
            ${!t.isTax ? "" : `<th style="width:90px;" class="r">Tax Amount</th>`}
            <th style="width:90px;" class="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${t.rows.map((r, i) => `
            <tr>
              <td class="c">${i + 1}</td>
              <td>
                <div style="font-weight:bold;">${esc(r.name) || "&mdash;"}</div>
                ${r.description ? `<div style="font-size:8.5px;color:var(--muted);">${esc(r.description)}</div>` : ""}
              </td>
              <td class="c">${esc(r.hsn || "—")}</td>
              <td class="r">
                ${r.itemDiscount > 0 ? `<s>&#8377;${fmt(r.originalRate)}</s><br/>` : ""}
                &#8377;${fmt(r.effectiveRate || r.taxable / r.qty)}
                ${r.itemDiscount > 0 ? `<br/><span style="font-size:8px;color:var(--muted);">(-${r.itemDiscount}%)</span>` : ""}
              </td>
              <td class="r">${r.qty}</td>
              <td class="r">&#8377;${fmt(r.taxable)}</td>
              ${!t.isTax ? "" : `<td class="r">&#8377;${fmt(r.tax)} (${(r.igstRate || 0) + (r.cgstRate || 0) + (r.sgstRate || 0)}%)</td>`}
              <td class="r">&#8377;${fmt(r.amount)}</td>
            </tr>`
  ).join("")}
          <tr class="ls-filler-row">
            <td></td><td></td><td></td><td></td><td></td><td></td>
            ${!t.isTax ? "" : "<td></td>"}
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="ls-totals-row">
      <div class="ls-totals-left">
        <div style="font-weight:bold;margin-bottom:4px;">Total Items / Qty : ${t.rows.length} / ${t.totalQty}</div>
        <div style="margin-bottom:8px;">Total amount (in words): <b>INR ${esc(t.amountInWords)}</b></div>
        <div style="font-weight:bold;text-transform:uppercase;font-size:8.5px;color:var(--muted);margin-bottom:3px;">Bank Details:</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:9px;">
          <div style="color:var(--muted);">Bank</div><div>${esc(bank.bank || "—")}</div>
          <div style="color:var(--muted);">Account Holder</div><div>${esc(bank.accountHolder || org.companyName || "—")}</div>
          <div style="color:var(--muted);">Account #</div><div>${esc(bank.accountNumber || "—")}</div>
          <div style="color:var(--muted);">IFSC Code</div><div>${esc(bank.ifscCode || "—")}</div>
          <div style="color:var(--muted);">Branch</div><div>${esc(bank.branch || "—")}</div>
        </div>
      </div>
      <div class="ls-totals-right">
        <div class="ls-trow"><span>Taxable Amount</span><span>&#8377;${fmt(t.grossTaxable)}</span></div>
        ${!t.isTax ? "" : t.isInterState
        ? `<div class="ls-trow"><span>IGST ${doc.gstRate ? doc.gstRate.toFixed(1) : "18.0"}%</span><span>&#8377;${fmt(t.totalIGST)}</span></div>`
        : `<div class="ls-trow"><span>CGST</span><span>&#8377;${fmt(t.totalCGST)}</span></div>
             <div class="ls-trow"><span>SGST</span><span>&#8377;${fmt(t.totalSGST)}</span></div>`
      }
        ${discountRow ? `<div class="ls-trow">${discountRow}</div>` : ""}
        <div class="ls-trow grand"><span>Total Amount</span><span>&#8377;${fmt(t.grandTotal)}</span></div>
      </div>
    </div>
    ${!t.isTax ? "" : `
    <div style="border-bottom: 1px solid var(--line);">
      <table class="dc-hsn">
        <thead>
          ${t.isInterState
          ? `<tr>
            <th rowspan="2">HSN/SAC</th>
            <th rowspan="2">Taxable Value</th>
            <th colspan="2" class="c">Integrated Tax</th>
            <th rowspan="2">Total Tax Amount</th>
          </tr>
          <tr><th class="c">Rate</th><th class="c">Amount</th></tr>`
          : `<tr>
            <th rowspan="2">HSN/SAC</th>
            <th rowspan="2">Taxable Value</th>
            <th colspan="2" class="c">Central Tax</th>
            <th colspan="2" class="c">State Tax</th>
            <th rowspan="2">Total Tax Amount</th>
          </tr>
          <tr><th class="c">Rate</th><th class="c">Amount</th><th class="c">Rate</th><th class="c">Amount</th></tr>`
        }
        </thead>
        <tbody>
          ${hsnRows}
          ${t.isInterState
          ? `<tr class="tot">
            <td class="r">TOTAL</td>
            <td class="c">${fmt(t.totalTaxable)}</td>
            <td></td>
            <td class="r">${fmt(t.totalIGST)}</td>
            <td class="c">${fmt(t.totalIGST)}</td>
          </tr>`
          : `<tr class="tot">
            <td class="r">TOTAL</td>
            <td class="c">${fmt(t.totalTaxable)}</td>
            <td></td>
            <td class="r">${fmt(t.totalCGST)}</td>
            <td></td>
            <td class="r">${fmt(t.totalSGST)}</td>
            <td class="c">${fmt(t.totalCGST + t.totalSGST)}</td>
          </tr>`
        }
        </tbody>
      </table>
    </div>
    `}
    <div class="ls-footer-row">
      <div>
        ${notes ? `<div style="margin-bottom:4px;"><b>Notes:</b> ${esc(notes)}</div>` : ""}
        ${terms ? `<div><b>Terms & Conditions:</b> ${esc(terms)}</div>` : ""}
      </div>
      <div class="ls-sign-block">
        <div style="font-weight:bold;margin-bottom:4px;">For ${esc(org.companyName || "Your Company")}</div>
        ${(doc.signature || org.signatureUrl) ? `<img class="ls-sign-img" src="${esc(doc.signature || org.signatureUrl)}" />` : `<div style="height:40px;"></div>`}
        <div style="margin-top:4px;">Authorized Signatory</div>
      </div>
    </div>
  </div>
  ` : `
  ${tpl === "Vintage" ? `
  <div class="vt-page">
  <!-- ① Title bar -->
  <div class="vt-title">
    ${t.isTax ? `TAX ${esc(docLabel)}` : esc(docLabel)}
    <span class="vt-copy">${copySubtitle}</span>
  </div>
  <!-- ② Company info (left) + Invoice meta 2×2 grid (right) -->
  <div class="vt-org-row">
    <div class="vt-org">
      ${org.logoUrl ? `<img class="dc-logo" src="${esc(org.logoUrl)}" style="max-height:40px;margin-bottom:4px;" />` : ""}
      <div class="dc-company">${esc(org.companyName || "Your Company")}</div>
      <div class="dc-addr" style="margin-top:3px;">${esc(org.address || "")}</div>
      <div style="margin-top:2px;">GSTIN: <b>${esc(org.gstin || "—")}</b></div>
      <div style="margin-top:2px;">Mobile: ${esc(org.mobile || "—")} &nbsp;|&nbsp; Email: ${esc(org.email || "—")}</div>
    </div>
    <div class="vt-meta">
      <div class="vt-mcell"><span>${esc(docLabel)} #</span><b>${esc(docNumber || "—")}</b></div>
      <div class="vt-mcell"><span>Date</span><b>${esc(formatDate(doc.date) || "—")}</b></div>
      <div class="vt-mcell"><span>Place of Supply</span><b>${esc(doc.placeOfSupply || "—")}</b></div>
      <div class="vt-mcell"><span>Due Date</span><b>${esc(formatDate(doc.dueDate) || "—")}</b></div>
    </div>
  </div>
  <!-- ③ Customer (left) + Shipping (right) -->
  <div class="vt-cust-row">
    <div class="vt-cust-col">
      <div class="vt-col-title">Customer Details</div>
      <div class="vt-cust-name">${esc(dealName)}</div>
      ${doc.receiverGSTIN ? `<div>GSTIN: ${esc(doc.receiverGSTIN)}</div>` : ""}
      <div style="margin-top:3px;">${esc(formatPostalAddress(doc.billingAddress))}</div>
    </div>
    <div class="vt-cust-col">
      <div class="vt-col-title">Shipping Address</div>
      <div style="margin-top:3px;">${esc(formatPostalAddress(doc.shippingAddress))}</div>
    </div>
  </div>
  ` : `
  ${tpl === "Professional" ? `
  <div class="dc-header" style="margin-bottom: 16px;">
    <div style="text-align: right; margin-bottom: 16px;">
      <div class="dc-title" style="font-weight:bold; font-size:16px; letter-spacing:1px; color:var(--accent); text-transform:uppercase; text-align:right;">${t.isTax ? "TAX " + esc(docLabel) : esc(docLabel)}</div>
      <div class="dc-subtitle" style="color:var(--muted); font-size:9px; margin-top:2px; text-align:right;">${copySubtitle}</div>
    </div>
    <div style="text-align: left;">
      <div class="dc-company">${esc(org.companyName || "Your Company")}</div>
      <div class="dc-addr">${esc(org.address || "")}</div>
      <div class="dc-gstin" style="margin-top: 4px; font-weight: bold;">GSTIN: ${esc(org.gstin || "—")}</div>
    </div>
  </div>
  <div class="dc-prof-meta">
    <div>
      <div class="dc-label">Bill to</div>
      <div class="dc-prof-name">${esc(dealName)}</div>
      ${doc.receiverGSTIN ? `<div style="font-size:10px;">GSTIN: ${esc(doc.receiverGSTIN)}</div>` : ""}
      <div style="white-space:pre-line; font-size:10px; margin-top:2px;">${esc(formatPostalAddress(doc.billingAddress))}</div>
    </div>
    <div>
      <div class="dc-label">Shipping to</div>
      <div class="dc-prof-name">${esc(dealName)}</div>
      ${doc.receiverGSTIN ? `<div style="font-size:10px;">GSTIN: ${esc(doc.receiverGSTIN)}</div>` : ""}
      <div style="white-space:pre-line; font-size:10px; margin-top:2px;">${esc(formatPostalAddress(doc.shippingAddress || doc.billingAddress))}</div>
    </div>
    <div>
      <div class="dc-label">Details</div>
      <div class="dc-prof-grid">
        <div>Invoice #</div><div style="text-align:right; font-weight:bold;">${esc(docNumber || "—")}</div>
        <div>Invoice Date</div><div style="text-align:right; font-weight:bold;">${esc(formatDate(doc.date) || "—")}</div>
        <div>Due Date</div><div style="text-align:right; font-weight:bold;">${esc(formatDate(doc.dueDate) || "—")}</div>
        <div>Place of Supply</div><div style="text-align:right; font-weight:bold;">${esc(doc.placeOfSupply || "—")}</div>
      </div>
    </div>
  </div>
  ` : `
  <div class="dc-header">
    <div class="dc-org">
      ${org.logoUrl ? `<img class="dc-logo" src="${esc(org.logoUrl)}" />` : ""}
      <div>
        <div class="dc-company">${esc(org.companyName || "Your Company")}</div>
        <div class="dc-addr">${esc(org.address || "")}</div>
        <div class="dc-gstin">GSTIN: ${esc(org.gstin || "—")}</div>
        <div class="dc-contact">Mobile: ${esc(org.mobile || "—")}&nbsp;&nbsp;&nbsp;Email: ${esc(org.email || "—")}</div>
      </div>
    </div>
    <div class="dc-title-block">
      <div class="dc-title">${t.isTax ? `TAX ${esc(docLabel)}` : esc(docLabel)}</div>
      <div class="dc-subtitle">${copySubtitle}</div>
    </div>
  </div>

  <div class="dc-meta">
    ${tpl === "Modern" ? `<div class="dc-cust-row">
      <div class="dc-addr-col">
        <div class="dc-label">Customer Details:</div>
        <div class="dc-label">${esc(dealName)}</div>
        <div>GSTIN: ${esc(doc.receiverGSTIN || "")}</div>
      </div>
      <div class="dc-addr-col">
        <div class="dc-label">Billing address:</div>
        <div class="dc-addr-box dc-addr">${esc(formatPostalAddress(doc.billingAddress))}</div>
      </div>
      <div class="dc-addr-col">
        <div class="dc-label">Shipping address:</div>
        <div class="dc-addr-box dc-addr">${esc(formatPostalAddress(doc.shippingAddress))}</div>
      </div>
    </div>` : `<div class="dc-cust">
      <div class="dc-label">Customer Details:</div>
      <div class="dc-label">${esc(dealName)}</div>
      <div>GSTIN: ${esc(doc.receiverGSTIN || "")}</div>
      <div class="dc-label dc-mt">Billing address:</div>
      <div class="dc-addr-box dc-addr">${esc(formatPostalAddress(doc.billingAddress))}</div>
      <div class="dc-label">Shipping address:</div>
      <div class="dc-addr-box dc-addr">${esc(formatPostalAddress(doc.shippingAddress))}</div>
    </div>`}
    <div class="dc-metagrid">
      <div class="dc-mcell"><span>${esc(docLabel)} #:</span><b>${esc(docNumber || "—")}</b></div>
      <div class="dc-mcell"><span>Date:</span><b>${esc(formatDate(doc.date) || "—")}</b></div>
      <div class="dc-mcell"><span>Place of Supply:</span><b>${esc(doc.placeOfSupply || "—")}</b></div>
      <div class="dc-mcell"><span>Due Date:</span><b>${esc(formatDate(doc.dueDate) || "—")}</b></div>
      <div class="dc-mcell"><span>Eway Bill #:</span><b>&nbsp;</b></div>
      <div class="dc-mcell"><span>Vehicle Number:</span><b>&nbsp;</b></div>
      <div class="dc-mcell dc-span2"><span class="dc-label">Dispatch From:</span><div class="dc-addr">${esc(org.address || "")}</div></div>
    </div>
  </div>
  `}
  `}

  <div class="vt-items-wrap">
  <table class="dc-items">
    <thead>
      <tr>
        <th style="width:24px;">#</th>
        <th style="text-align:left;">Item</th>
        <th style="width:52px;">HSN/SAC</th>
        <th class="r" style="width:60px;">Rate/Item</th>
        <th class="r nowrap" style="width:56px;">Qty</th>
        <th class="r" style="width:74px;">Taxable Value</th>
        ${!t.isTax
      ? ""
      : tpl === "Professional"
        ? `<th class="r" style="width:74px;">Tax Amount</th>`
        : t.isInterState
          ? `<th class="r" style="width:74px;">${tpl === "Modern" ? "Tax Amount" : "IGST"}</th>`
          : `<th class="r" style="width:74px;">CGST</th><th class="r" style="width:74px;">SGST</th>`
    }
        <th class="r" style="width:80px;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}${tpl === "Vintage" ? `<tr class="vt-filler-row">${Array(!t.isTax ? 7 : t.isInterState ? 8 : 9).fill("<td></td>").join("")}</tr>` : ""}</tbody>
  </table>
  </div>

  ${tpl === "Vintage" ? `
  <div class="vt-bottom">
  <!-- ⑤ Totals summary -->
  <div class="vt-totals">
    <div class="vt-totals-left">
      <div>Total Items / Qty: <b>${t.rows.length} / ${t.totalQty}</b></div>
      <div style="margin-top:4px;">Amount in words:</div>
      <div><b>INR ${esc(t.amountInWords)}</b></div>
    </div>
    <div class="vt-totals-right">
      <div class="dc-trow"><span>Taxable Amount</span><span>&#8377;${fmt(t.grossTaxable)}</span></div>
      ${discountRow}
      ${!t.isTax
        ? ""
        : t.isInterState
          ? `<div class="dc-trow"><span>IGST ${doc.gstRate ? doc.gstRate.toFixed(1) : "18.0"}%</span><span>&#8377;${fmt(t.totalIGST)}</span></div>`
          : `<div class="dc-trow"><span>CGST</span><span>&#8377;${fmt(t.totalCGST)}</span></div>
               <div class="dc-trow"><span>SGST</span><span>&#8377;${fmt(t.totalSGST)}</span></div>`
      }
      <div class="dc-grand"><span>Total Amount</span><span>&#8377;${fmt(t.grandTotal)}</span></div>
      ${doc.status === "Paid" ? `<div class="dc-paid"><span class="dc-tick">&#10003;</span><span>Amount Paid</span></div>` : ""}
    </div>
  </div>
  ` : `
  ${tpl === "Professional" ? `
  <div class="dc-totals">
    <div style="display: flex; flex-direction: column; align-items: flex-end;">
      <div style="min-width: 280px;">
        <div class="dc-trow" style="display:flex; justify-content:space-between;"><span class="dc-label">Taxable Amount</span><span>&#8377;${fmt(t.grossTaxable)}</span></div>
        ${!t.isTax ? "" : t.isInterState
        ? `<div class="dc-trow" style="display:flex; justify-content:space-between;"><span class="dc-label">IGST ${doc.gstRate ? doc.gstRate.toFixed(1) : "18.0"}%</span><span>&#8377;${fmt(t.totalIGST)}</span></div>`
        : `<div class="dc-trow" style="display:flex; justify-content:space-between;"><span class="dc-label">CGST</span><span>&#8377;${fmt(t.totalCGST)}</span></div>
             <div class="dc-trow" style="display:flex; justify-content:space-between;"><span class="dc-label">SGST</span><span>&#8377;${fmt(t.totalSGST)}</span></div>`
      }
        ${discountRow}
        <div class="dc-grand" style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; font-weight:normal;">Total</span>
          <span style="font-weight:bold;">&#8377;${fmt(t.grandTotal)}</span>
        </div>
        ${doc.status === "Paid" ? `<div class="dc-paid" style="display:flex; justify-content:flex-end; gap:4px; margin-top:4px;"><span class="dc-tick" style="color:green;">&#10003;</span><span style="font-size:10px;">Amount Paid</span></div>` : ""}
      </div>
    </div>
    <div style="font-size: 10px; color: var(--muted); margin-top: 12px; border-top: 1px solid var(--line); padding-top: 8px; display: flex; justify-content: space-between; align-items: center;">
      <div>Total Items / Qty : ${t.rows.length} / ${t.totalQty}</div>
      <div>Total amount (in words): INR ${esc(t.amountInWords)}</div>
    </div>
  </div>
  <div class="dc-footer">
    <div class="dc-bank-row" style="flex:1;">
      <div class="dc-bank">
        <div class="dc-label">Bank Details</div>
        <div class="dc-bank-grid">
          <div style="color:var(--muted);">Bank</div><div>${esc(bank.bank || "—")}</div>
          <div style="color:var(--muted);">Account Holder</div><div>${esc(bank.accountHolder || org.companyName || "—")}</div>
          <div style="color:var(--muted);">Account #</div><div>${esc(bank.accountNumber || "—")}</div>
          <div style="color:var(--muted);">IFSC</div><div>${esc(bank.ifscCode || "—")}</div>
          <div style="color:var(--muted);">Branch</div><div>${esc(bank.branch || "—")}</div>
        </div>
      </div>
    </div>
    <div class="dc-sign" style="flex:1;">
      <div style="font-weight: bold; margin-bottom: 4px;">For ${esc(org.companyName || "Your Company")}</div>
      ${(doc.signature || org.signatureUrl) ? `<img class="dc-sign-img" src="${esc(doc.signature || org.signatureUrl)}" />` : `<div style="height:40px;"></div>`}
      <div class="dc-sign-line">Authorized Signatory</div>
    </div>
  </div>
  ` : `
  <div class="dc-totals">
    <div class="dc-totals-left">
      ${tpl !== "Modern" ? `
      <div>Total Items / Qty : ${t.rows.length} / ${t.totalQty}</div>
      <div>Total amount (in words): INR ${esc(t.amountInWords)}</div>
      <div class="dc-bank-row">
        <div class="dc-bank">
          <div class="dc-label dc-mt">Bank Details:</div>
          <div>Bank: ${esc(bank.bank || "—")}</div>
          <div>Account #: ${esc(bank.accountNumber || "—")}</div>
          <div>IFSC: ${esc(bank.ifscCode || "—")}</div>
          <div>Branch: ${esc(bank.branch || "—")}</div>
        </div>
        ${qrBlock}
      </div>
      ` : ""}
    </div>
    <div class="dc-totals-right ${!t.isTax ? "" : t.isInterState ? "dc-tax-single" : "dc-tax-split"}">
      <div class="dc-trow"><span class="dc-label">Taxable Amount</span><span>&#8377;${fmt(t.grossTaxable)}</span></div>
      ${discountRow}
      ${!t.isTax
      ? ""
      : t.isInterState
        ? `<div class="dc-trow sep"><span class="dc-label">IGST${tpl === "Modern" ? ` ${doc.gstRate ? doc.gstRate.toFixed(1) : "18.0"}%` : ""}</span><span>&#8377;${fmt(t.totalIGST)}</span></div>`
        : `<div class="dc-trow sep"><span class="dc-label">CGST</span><span>&#8377;${fmt(t.totalCGST)}</span></div>
      <div class="dc-trow"><span class="dc-label">SGST</span><span>&#8377;${fmt(t.totalSGST)}</span></div>`
    }
      <div class="dc-grand"><span>Total</span><span>&#8377;${fmt(t.grandTotal)}</span></div>
      ${doc.status === "Paid" ? `<div class="dc-paid"><span class="dc-tick">&#10003;</span><span>Amount Paid</span></div>` : ""}
    </div>
  </div>
  ${tpl === "Modern" ? `
  <div class="dc-totals-words" style="margin-top: 12px; border-top: 1px solid var(--ink); padding-top: 10px; display: flex; justify-content: space-between;">
    <div style="font-size: 9px; color: var(--muted);">
      <div style="margin-bottom: 3px;">Total Items / Qty : ${t.rows.length} / ${t.totalQty}</div>
      <div>Total amount (in words): INR ${esc(t.amountInWords)}</div>
    </div>
    <div style="font-size: 12px; text-align: right; min-width: 260px;">
      <span class="dc-label" style="font-weight: normal; font-size: 11px; margin-right: 24px;">Amount Payable</span>
      <span style="font-weight: bold;">&#8377;${fmt(t.grandTotal)}</span>
    </div>
  </div>
  ` : ""}
  `}

  ${
    // Purely a tax breakdown table — nothing to summarize when tax is off.
    !t.isTax || tpl === "Modern"
      ? ""
      : `<table class="dc-hsn">
    <thead>
      ${t.isInterState
        ? `<tr>
        <th rowspan="2">HSN/SAC</th>
        <th rowspan="2">Taxable Value</th>
        <th colspan="2" class="c">Integrated Tax</th>
        <th rowspan="2">Total Tax Amount</th>
      </tr>
      <tr><th class="c">Rate</th><th class="c">Amount</th></tr>`
        : `<tr>
        <th rowspan="2">HSN/SAC</th>
        <th rowspan="2">Taxable Value</th>
        <th colspan="2" class="c">Central Tax</th>
        <th colspan="2" class="c">State Tax</th>
        <th rowspan="2">Total Tax Amount</th>
      </tr>
      <tr><th class="c">Rate</th><th class="c">Amount</th><th class="c">Rate</th><th class="c">Amount</th></tr>`
      }
    </thead>
    <tbody>
      ${hsnRows}
      ${t.isInterState
        ? `<tr class="tot">
        <td class="r">TOTAL</td>
        <td class="c">${fmt(t.totalTaxable)}</td>
        <td></td>
        <td class="r">${fmt(t.totalIGST)}</td>
        <td class="c">${fmt(t.totalIGST)}</td>
      </tr>`
        : `<tr class="tot">
        <td class="r">TOTAL</td>
        <td class="c">${fmt(t.totalTaxable)}</td>
        <td></td>
        <td class="r">${fmt(t.totalCGST)}</td>
        <td></td>
        <td class="r">${fmt(t.totalSGST)}</td>
        <td class="c">${fmt(t.totalCGST + t.totalSGST)}</td>
      </tr>`
      }
    </tbody>
  </table>`
    }

  ${tpl === "Vintage" ? `
  <!-- ⑥ Bank details (left) + Signature (right) -->
  <div class="vt-footer">
    <div class="vt-bank">
      <div class="vt-col-title">Bank Details</div>
      <div class="vt-bank-grid">
        <div class="vt-bank-cell lbl">Bank</div>
        <div class="vt-bank-cell val">${esc(bank.bank || "—")}</div>
        <div class="vt-bank-cell lbl">Account #</div>
        <div class="vt-bank-cell val">${esc(bank.accountNumber || "—")}</div>
        <div class="vt-bank-cell lbl">IFSC</div>
        <div class="vt-bank-cell val">${esc(bank.ifscCode || "—")}</div>
        <div class="vt-bank-cell lbl">Branch</div>
        <div class="vt-bank-cell val">${esc(bank.branch || "—")}</div>
        ${upiId ? `<div class="vt-bank-cell lbl">UPI</div><div class="vt-bank-cell val">${esc(upiId)}</div>` : ""}
      </div>
    </div>
    <div class="vt-sign">
      <div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">For ${esc(org.companyName || "Your Company")}</div>
      <div class="vt-sign-img-wrap">
        ${(doc.signature || org.signatureUrl)
        ? `<img src="${esc(doc.signature || org.signatureUrl)}" style="transform:scale(2.2);max-height:100%;width:100%;object-fit:contain;" />`
        : `<div style="height:60px;"></div>`
      }
      </div>
      <div style="border-top:1px solid var(--ink);padding-top:4px;font-size:9px;">Authorized Signatory</div>
    </div>
  </div>
  ${notes || terms ? `
  <div class="vt-notes-row">
    <div class="vt-notes-col">
      ${notes ? `<div style="font-weight:bold;margin-bottom:3px;">Notes:</div><div style="white-space:pre-line;">${esc(notes)}</div>` : ""}
    </div>
    <div class="vt-notes-col">
      ${terms ? `<div style="font-weight:bold;margin-bottom:3px;">Terms &amp; Conditions:</div><div style="white-space:pre-line;">${esc(terms)}</div>` : ""}
    </div>
  </div>
  </div>
  ${tpl === "Vintage" ? `</div>` : ""}
  </div>
  ` : ""}
  ${tpl === "Vintage" ? `</div>` : ""}
  ` : `
  ${tpl === "Professional" || tpl === "Landscape" || tpl === "Service" ? "" : `
  <div class="dc-footer">
    <div class="dc-notes">
      ${notes
        ? `<div class="dc-label">Notes:</div>
      <div class="dc-note-body">${esc(notes)}</div>`
        : ""
      }
      ${terms
        ? `<div class="dc-label${notes ? " dc-mt" : ""}">Terms and Conditions:</div>
      <div class="dc-terms">${esc(terms)}</div>`
        : ""
      }
    </div>
    ${tpl === "Modern" ? `
    <div class="dc-bank-row" style="margin-top: 0; max-width: 40%;">
      <div class="dc-bank">
        <div class="dc-label">Bank Details:</div>
        <div>Bank: ${esc(bank.bank || "—")}</div>
        <div>Account #: ${esc(bank.accountNumber || "—")}</div>
        <div>IFSC: ${esc(bank.ifscCode || "—")}</div>
        <div>Branch: ${esc(bank.branch || "—")}</div>
      </div>
      ${qrBlock}
    </div>
    ` : ""}
    ${tpl === "Modern" ? `
    <div class="dc-sign" style="display: flex; align-items: center; gap: 15px; text-align: left;">
      ${(doc.signature || org.signatureUrl) ? `<div style="overflow: hidden; display: flex; align-items: center; justify-content: center; height: 100px; width: 200px; margin-left: -20px;"><img class="dc-sign-img" src="${esc(doc.signature || org.signatureUrl)}" style="transform: scale(2.2); max-height: 100%; width: 100%; object-fit: contain;" /></div>` : `<div style="height:100px; width:150px;"></div>`}
      <div>
        <div style="font-weight: bold; margin-bottom: 4px;">For ${esc(org.companyName || "Your Company")}</div>
        <div class="dc-sign-line" style="margin-top: 0; border: 0;">Authorized Signatory</div>
      </div>
    </div>
    ` : `
    <div class="dc-sign">
      <div>For ${esc(org.companyName || "Your Company")}</div>
      <div>
        ${(doc.signature || org.signatureUrl) ? `<img class="dc-sign-img" src="${esc(doc.signature || org.signatureUrl)}" />` : `<div style="height:40px;"></div>`}
        <div class="dc-sign-line">Authorized Signatory</div>
      </div>
    </div>
    `}
  </div>
  `}
  `}
  `}
  `}
  `}
</div>`;
}
