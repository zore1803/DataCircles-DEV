const puppeteer = require("puppeteer");

/*
 * Renders one Expense / Indirect Income entry as a printable receipt PDF.
 *
 * Same server-rendered approach as purchaseDocumentPdf.js — the bytes the
 * viewer shows are the bytes the download and print produce, so a preview can
 * never disagree with the file. Kept separate from the invoice-family
 * templates because these entries have no counterparty document, no line
 * items and no tax breakdown: the letterhead is the organisation itself and
 * the body is a single amount.
 */

let sharedBrowserPromise = null;
async function getBrowser() {
  if (sharedBrowserPromise) {
    try {
      const existing = await sharedBrowserPromise;
      if (existing.connected) return existing;
    } catch {
      // fall through and relaunch
    }
  }
  sharedBrowserPromise = puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  return sharedBrowserPromise;
}

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

const money = (amount) =>
  (parseFloat(amount) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "N/A";

function buildHtml(entry, orgDetails) {
  const isIncome = entry.kind === "income";
  const noun = isIncome ? "Income" : "Expense";
  const docLabel = isIncome ? "INCOME RECEIPT" : "EXPENSE VOUCHER";
  const receiptNo = `${isIncome ? "INC" : "EXP"}-${String(entry._id).slice(-6).toUpperCase()}`;
  const isPaid = entry.status === "Paid";
  const stamp = isPaid ? (isIncome ? "RECEIVED" : "PAID") : "PENDING";
  const stampColor = isPaid ? (isIncome ? "#16A34A" : "#DC2626") : "#D97706";
  const accent = isIncome ? "#16A34A" : "#2563EB";

  const orgAddress = [orgDetails?.address, orgDetails?.city, orgDetails?.state, orgDetails?.pincode]
    .filter(Boolean)
    .join(", ");
  const vendorName = entry.vendor?.companyName || entry.vendor?.name || "";
  const isForeign = entry.currency && entry.currency !== "INR";

  const row = (label, value) =>
    value === "" || value === null || value === undefined
      ? ""
      : `<div class="kv"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; }
  .sheet { padding: 28px; }
  .head { text-align: center; border-bottom: 2px solid #E5E7EB; padding-bottom: 18px; }
  .logo { max-height: 56px; max-width: 200px; object-fit: contain; margin-bottom: 10px; }
  .org { font-size: 22px; font-weight: 700; }
  .small { font-size: 11px; color: #4B5563; line-height: 1.6; }
  .doc-title { font-size: 20px; font-weight: 700; letter-spacing: 1px; color: ${accent}; margin-top: 16px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin: 24px 0; }
  .kv { display: flex; justify-content: space-between; gap: 16px; font-size: 11px; padding: 6px 0; border-bottom: 1px dashed #E5E7EB; }
  .kv span:first-child { color: #6B7280; font-weight: 600; text-transform: uppercase; }
  .kv span:last-child { color: #111827; font-weight: 700; text-align: right; }
  .amount-box { margin: 8px 0 0; padding: 14px 16px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; }
  .amount-label { font-size: 10px; color: #6B7280; font-weight: 700; text-transform: uppercase; }
  .amount { font-size: 26px; font-weight: 700; margin-top: 4px; }
  .section { margin-top: 22px; }
  .label { font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; color: #374151; }
  .notes { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; font-size: 11px; white-space: pre-wrap; }
  .stamp { margin-top: 28px; text-align: right; }
  .stamp span { display: inline-block; padding: 10px 26px; border: 3px solid ${stampColor}; color: ${stampColor}; font-size: 18px; font-weight: 700; border-radius: 8px; transform: rotate(-8deg); opacity: .85; }
  .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 10px; color: #6B7280; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      ${orgDetails?.logoUrl ? `<img class="logo" src="${escapeHtml(orgDetails.logoUrl)}" />` : ""}
      <div class="org">${escapeHtml(orgDetails?.companyName || "Company Name")}</div>
      <div class="small">
        ${orgAddress ? `<div>${escapeHtml(orgAddress)}</div>` : ""}
        ${[
          orgDetails?.mobile ? `Mobile: ${escapeHtml(orgDetails.mobile)}` : "",
          orgDetails?.email ? `Email: ${escapeHtml(orgDetails.email)}` : "",
        ]
          .filter(Boolean)
          .join(" &nbsp;|&nbsp; ")}
        ${orgDetails?.gstin ? `<div>GSTIN: ${escapeHtml(orgDetails.gstin)}</div>` : ""}
      </div>
      <div class="doc-title">${docLabel}</div>
    </div>

    <div class="grid2">
      <div>
        ${row(`${noun} No`, receiptNo)}
        ${row("Date", formatDate(entry.date))}
        ${row("Category", entry.category || "Uncategorised")}
        ${row("Status", isPaid ? stamp : "PENDING")}
      </div>
      <div>
        <div class="amount-box">
          <div class="amount-label">Amount</div>
          <div class="amount">&#8377;${money(entry.amount)}</div>
          ${
            isForeign
              ? `<div class="small">${escapeHtml(entry.currency)} ${money(
                  entry.foreignAmount
                )} @ ${escapeHtml(String(entry.exchangeRate || 1))}</div>`
              : ""
          }
        </div>
        ${row("Mode", entry.paymentType || "—")}
        ${row("Bank", entry.bankAccount?.bank || "")}
        ${isPaid && entry.paymentDate ? row(isIncome ? "Received On" : "Paid On", formatDate(entry.paymentDate)) : ""}
      </div>
    </div>

    ${
      vendorName
        ? `<div class="section">
             <div class="label">${isIncome ? "Received From" : "Paid To"}</div>
             ${row("Name", vendorName)}
             ${row("Email", entry.vendor?.email || "")}
             ${row("Phone", entry.vendor?.phone || "")}
             ${row("GSTIN", entry.vendor?.gstin || "")}
           </div>`
        : ""
    }

    ${
      entry.notes || entry.paymentNotes
        ? `<div class="section">
             <div class="label">Notes</div>
             <div class="notes">${escapeHtml([entry.notes, entry.paymentNotes].filter(Boolean).join("\n"))}</div>
           </div>`
        : ""
    }

    <div class="stamp"><span>${stamp}</span></div>

    <div class="footer">
      This is a computer generated document and requires no signature.<br />
      Generated on ${formatDate(new Date())}
    </div>
  </div>
</body>
</html>`;
}

module.exports = async function expenseReceiptPdf(entry, orgDetails) {
  const html = buildHtml(entry, orgDetails);

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16px", bottom: "16px", left: "16px", right: "16px" },
    });
  } finally {
    await page.close();
  }
};
