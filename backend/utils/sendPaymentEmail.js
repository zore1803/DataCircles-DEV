const sendGridMail = require("./sendGridMail");

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

  const signatureBlock = signatureUrl
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
         <p style="color:#6b7280;font-size:12px;margin-bottom:6px">Authorised signature</p>
         <img src="${signatureUrl}" alt="Signature" style="max-height:64px;object-fit:contain;" />
       </div>`
    : "";

  const statusLine = !hasBalance
    ? ""
    : fullyPaid
      ? `<p style="color:#374151;font-size:14px;margin:0 0 4px;">This invoice is now fully paid.</p>`
      : `<p style="color:#374151;font-size:14px;margin:0 0 4px;">This is a part payment; ${formattedBalance} remains outstanding.</p>`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <div style="background:#2563eb;padding:24px 28px;">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Payment received</h1>
        <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">${companyName}</p>
      </div>
      <div style="padding:28px;">
        <p style="color:#374151;font-size:14px;margin-top:0;">
          Dear ${greetingName},
        </p>
        <p style="color:#374151;font-size:14px;">
          Thank you. We have recorded your payment against invoice <strong>${invoiceNumber}</strong>.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;width:45%;">Invoice number</td>
            <td style="padding:10px 0;color:#111827;font-weight:600;">${invoiceNumber}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;">Amount received</td>
            <td style="padding:10px 0;color:#16a34a;font-weight:700;font-size:16px;">${formattedAmount}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;">Payment date</td>
            <td style="padding:10px 0;color:#111827;">${formattedDate}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;">Method</td>
            <td style="padding:10px 0;color:#111827;">${paymentMethod || "Not specified"}</td>
          </tr>
          ${reference ? `<tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;">Reference / UTR</td>
            <td style="padding:10px 0;color:#111827;">${reference}</td>
          </tr>` : ""}
          ${hasBalance ? `<tr>
            <td style="padding:10px 0;color:#6b7280;">Balance on this invoice</td>
            <td style="padding:10px 0;color:#111827;font-weight:600;">${formattedBalance}</td>
          </tr>` : ""}
        </table>
        ${statusLine}
        ${signatureBlock}
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;margin-bottom:0;">
          This receipt is generated automatically. Please keep it for your records.
        </p>
        <p style="color:#374151;font-size:14px;margin-top:16px;margin-bottom:0;">Regards,<br>${companyName}</p>
      </div>
    </div>`;

  const textLines = [
    `Dear ${greetingName},`,
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
