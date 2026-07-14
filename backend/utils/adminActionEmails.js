// utils/adminActionEmails.js
//
// Email senders for super-admin-initiated subscription changes (trial
// adjusted, trial ended, subscription cancelled on the org's behalf).
// Same sendGridMail pattern as trialEmails.js — kept in a separate file
// since these are admin-triggered notices, not part of the automatic
// trial lifecycle.

const sendGridMail = require('./sendGridMail');

function getUserEmail(user) {
  return user?.email || user?.profileEmail || null;
}

function wrapEmail({ heading, bodyHtml }) {
  return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f6f9fc;">
      <table role="presentation" width="100%" style="background-color:#f6f9fc;padding:40px 0;">
        <tr><td align="center">
          <table role="presentation" width="600" style="background-color:#fff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">
            <tr><td style="padding:32px 40px;text-align:center;background-color:#000;">
              <img src="https://www.datacircles.in/assets/DataCirclesBWLogo.jpg" alt="Data Circles" style="max-width:180px;">
            </td></tr>
            <tr><td style="padding:40px;">
              <h1 style="color:#23272a;font-size:24px;margin:0 0 16px;">${heading}</h1>
              ${bodyHtml}
            </td></tr>
            <tr><td style="background-color:#f8f9fb;padding:24px 40px;text-align:center;">
              <p style="color:#718096;font-size:12px;margin:0;">Powered by DataCircles Technology</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

async function sendTrialAdjustedByAdminEmail(user, organization, trialEnd, adjustmentDays) {
  const toEmail = getUserEmail(user);
  if (!toEmail) {
    console.warn(`[adminActionEmails] No email found for user ${user?._id}, skipping trial-adjusted email`);
    return;
  }

  const direction = adjustmentDays > 0 ? 'extended' : 'reduced';
  const trialEndFormatted = new Date(trialEnd).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const html = wrapEmail({
    heading: `Your trial was ${direction} by our team`,
    bodyHtml: `
      <p style="color:#4a5568;font-size:15px;line-height:1.6;">
        Hi ${user.name || 'there'}, your free trial for <strong>${organization?.name || 'your workspace'}</strong> was ${direction} by ${Math.abs(adjustmentDays)} day${Math.abs(adjustmentDays) === 1 ? '' : 's'} by our support team.
      </p>
      <p style="color:#4a5568;font-size:15px;line-height:1.6;">
        Your trial now ends on <strong>${trialEndFormatted}</strong>.
      </p>
    `,
  });

  await sendGridMail({
    to: toEmail,
    subject: `Your DataCircles trial was ${direction}`,
    html,
  });
}

async function sendTrialEndedByAdminEmail(user, organization) {
  const toEmail = getUserEmail(user);
  if (!toEmail) {
    console.warn(`[adminActionEmails] No email found for user ${user?._id}, skipping trial-ended email`);
    return;
  }

  const html = wrapEmail({
    heading: 'Your trial has ended',
    bodyHtml: `
      <p style="color:#4a5568;font-size:15px;line-height:1.6;">
        Hi ${user.name || 'there'}, your free trial for <strong>${organization?.name || 'your workspace'}</strong> was ended by our support team.
      </p>
      <p style="color:#4a5568;font-size:15px;line-height:1.6;">
        Your data is safe and you can still view everything you've added. To keep adding and editing data, subscribe to a plan that fits your needs.
      </p>
      <table role="presentation" width="100%" style="margin:24px 0;">
        <tr><td align="center">
          <a href="${process.env.FRONTEND_URL}/subscription" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:14px 32px;border-radius:5px;font-size:15px;font-weight:600;display:inline-block;">
            Choose a plan
          </a>
        </td></tr>
      </table>
    `,
  });

  await sendGridMail({
    to: toEmail,
    subject: 'Your DataCircles trial has ended',
    html,
  });
}

async function sendSubscriptionCancelledByAdminEmail(user, organization, currentPeriodEnd, isTrial) {
  const toEmail = getUserEmail(user);
  if (!toEmail) {
    console.warn(`[adminActionEmails] No email found for user ${user?._id}, skipping cancellation email`);
    return;
  }

  const bodyHtml = isTrial
    ? `
      <p style="color:#4a5568;font-size:15px;line-height:1.6;">
        Hi ${user.name || 'there'}, your trial for <strong>${organization?.name || 'your workspace'}</strong> was cancelled by our support team.
      </p>
    `
    : `
      <p style="color:#4a5568;font-size:15px;line-height:1.6;">
        Hi ${user.name || 'there'}, your subscription for <strong>${organization?.name || 'your workspace'}</strong> was cancelled by our support team.
      </p>
      <p style="color:#4a5568;font-size:15px;line-height:1.6;">
        You'll continue to have access to all features until
        <strong>${currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'the end of your current billing period'}</strong>.
      </p>
    `;

  const html = wrapEmail({
    heading: 'Your subscription has been cancelled',
    bodyHtml,
  });

  await sendGridMail({
    to: toEmail,
    subject: 'Your DataCircles subscription has been cancelled',
    html,
  });
}

module.exports = {
  sendTrialAdjustedByAdminEmail,
  sendTrialEndedByAdminEmail,
  sendSubscriptionCancelledByAdminEmail,
};
