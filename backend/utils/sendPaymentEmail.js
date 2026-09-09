const sendGridMail = require("./sendGridMail");
const { renderEmail } = require("./emailLayout");

/**
 * Send a payment receipt email via SendGrid.
 * @param {object} opts
 * @param {string} opts.to             - recipient email
 * @param {string} [opts.contactName]  - customer contact name
 * @param {string} opts.invoiceNumber
 * @param {number} opts.amount         - paid amount (number)
 * @param {number} [opts.balanceDue]   - remaining balance on the invoice after this payment
 * @param {string} opts.paymentDate    - ISO date string or Date
 * @param {string} opts.paymentMethod
 * @param {string} [opts.reference]
 * @param {string} [opts.orgName]      - organisation / company name
 * @param {string} [opts.signatureUrl] - URL of the org signature image
 */
async function sendPaymentEmail({ to, contactName, invoiceNumber, amount, balanceDue, paymentDate, paymentMethod, reference, orgName, signatureUrl }) {
  const companyName = orgName || "your supplier";
  const greetingName = contactName || "Sir/Madam";

  const fmtInr = (n) => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(n) || 0);

  const formattedAmount = fmtInr(amount);
  const hasBalance = Number.isFinite(Number(balanceDue));
  const formattedBalance = hasBalance ? fmtInr(balanceDue) : null;
  const fullyPaid = hasBalance && Number(balanceDue) <= 0.01;

  const formattedDate = new Date(paymentDate || new Date()).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const rows = [
    { label: "Invoice number", value: invoiceNumber },
    { label: "Amount received", value: formattedAmount },
    { label: "Payment date", value: formattedDate },
    { label: "Method", value: paymentMethod || "Not specified" },
    reference ? { label: "Reference / UTR", value: reference } : null,
    hasBalance ? { label: "Balance on this invoice", value: formattedBalance } : null,
  ].filter(Boolean);

  const statusLine = !hasBalance
    ? ""
    : fullyPaid
      ? '<p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#333333;">This invoice is now fully paid.</p>'
      : `<p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#333333;">This is a part payment; ${formattedBalance} remains outstanding.</p>`;

  const signatureBlock = signatureUrl
    ? `<div style="margin-top:20px;padding-top:14px;border-top:1px solid #e5e7eb;">
         <p style="color:#6b7280;font-size:12px;margin:0 0 6px">Authorised signature</p>
         <img src="${signatureUrl}" alt="Signature" style="max-height:64px;object-fit:contain;" />
       </div>`
    : "";

  const html = renderEmail({
    greetingName,
    intro: `Thank you. We have recorded your payment against invoice <strong>${invoiceNumber}</strong>.`,
    blocks: [{ rows }],
    closingHtml: `${statusLine}${signatureBlock}<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#9aa0a6;">This receipt is generated automatically. Please keep it for your records.</p>`,
    signOff: companyName,
    preheader: `Payment of ${formattedAmount} received for invoice ${invoiceNumber}.`,
  });

  const textLines = [
    `Hello ${greetingName},`,
    "",
    `Thank you. We have recorded your payment against invoice ${invoiceNumber}.`,
    "",
    `Amount received: ${formattedAmount}`,
    `Payment date: ${formattedDate}`,
    `Method: ${paymentMethod || "Not specified"}`,
    reference ? `Reference / UTR: ${reference}` : "",
    hasBalance ? `Balance on this invoice: ${formattedBalance}` : "",
    hasBalance ? (fullyPaid ? "This invoice is now fully paid." : `This is a part payment; ${formattedBalance} remains outstanding.`) : "",
    "",
    "This receipt is generated automatically. Please keep it for your records.",
    "",
    "Regards,",
    companyName,
  ].filter((line, i, arr) => !(line === "" && arr[i - 1] === ""));

  await sendGridMail({
    to,
    subject: `${companyName}: payment received for invoice ${invoiceNumber}`,
    html,
    text: textLines.join("\n"),
  });
}

module.exports = sendPaymentEmail;
