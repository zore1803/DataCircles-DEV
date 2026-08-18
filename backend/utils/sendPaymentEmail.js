const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send a payment receipt email via SendGrid.
 * @param {object} opts
 * @param {string} opts.to           - recipient email
 * @param {string} opts.invoiceNumber
 * @param {number} opts.amount       - paid amount (number)
 * @param {string} opts.paymentDate  - ISO date string or Date
 * @param {string} opts.paymentMethod
 * @param {string} [opts.reference]
 * @param {string} [opts.orgName]    - organisation / company name
 * @param {string} [opts.signatureUrl] - URL of the org signature image
 */
async function sendPaymentEmail({ to, invoiceNumber, amount, paymentDate, paymentMethod, reference, orgName, signatureUrl }) {
  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

  const formattedDate = new Date(paymentDate || new Date()).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const signatureBlock = signatureUrl
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
         <p style="color:#6b7280;font-size:12px;margin-bottom:6px">Authorised Signature</p>
         <img src="${signatureUrl}" alt="Signature" style="max-height:64px;object-fit:contain;" />
       </div>`
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <div style="background:#2563eb;padding:24px 28px;">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Payment Receipt</h1>
        <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">${orgName || "Your Vendor"}</p>
      </div>
      <div style="padding:28px;">
        <p style="color:#374151;font-size:14px;margin-top:0;">
          Thank you! We have received your payment for invoice <strong>${invoiceNumber}</strong>.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;width:45%;">Invoice Number</td>
            <td style="padding:10px 0;color:#111827;font-weight:600;">${invoiceNumber}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;">Amount Paid</td>
            <td style="padding:10px 0;color:#16a34a;font-weight:700;font-size:16px;">${formattedAmount}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;">Payment Date</td>
            <td style="padding:10px 0;color:#111827;">${formattedDate}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;">Payment Method</td>
            <td style="padding:10px 0;color:#111827;">${paymentMethod || "—"}</td>
          </tr>
          ${reference ? `<tr>
            <td style="padding:10px 0;color:#6b7280;">Reference / UTR</td>
            <td style="padding:10px 0;color:#111827;">${reference}</td>
          </tr>` : ""}
        </table>
        ${signatureBlock}
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;margin-bottom:0;">
          This is an auto-generated payment receipt. Please keep it for your records.
        </p>
      </div>
    </div>`;

  await sgMail.send({
    to,
    from: process.env.EMAIL_USER,
    subject: `Payment Receipt — ${invoiceNumber}`,
    html,
    text: `Payment of ${formattedAmount} received for invoice ${invoiceNumber} on ${formattedDate} via ${paymentMethod}.`,
  });
}

module.exports = sendPaymentEmail;
