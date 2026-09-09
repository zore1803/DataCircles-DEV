// utils/trialEmails.js
//
// Email senders for the trial lifecycle: started, ending soon (48h/24h),
// and expired. Uses the existing sendGridMail utility, same pattern as
// the invite/OTP emails elsewhere in the codebase.
//
// NOTE: the actual From address is controlled by the SendGrid configuration,
// not by the `from` value passed here, so it is not set in this file.

const sendGridMail = require('./sendGridMail');

// Standard footer for every DataCircles lifecycle email. Kept here so the
// wording stays identical across the three senders below.
const FOOTER_HTML = `
  <tr><td style="background-color:#f8f9fb;padding:24px 40px;text-align:center;">
    <p style="color:#718096;font-size:12px;margin:0 0 4px;">DataCircles | datacircles.in | Need help? support@datacircles.in</p>
    <p style="color:#718096;font-size:12px;margin:0;">You're receiving this email because you have a DataCircles account.</p>
  </td></tr>
`;

// Picks the right email field depending on how the user signed up.
// Google/GitHub/Facebook users have `email`; phone-signup users have
// `profileEmail` instead. Falls back gracefully if neither exists (should
// be rare, but better to skip sending than crash the cron job).
function getUserEmail(user) {
  return user?.email || user?.profileEmail || null;
}

async function sendTrialStartedEmail(user, organization, trialEnd) {
  const toEmail = getUserEmail(user);
  if (!toEmail) {
    console.warn(`[trialEmails] No email found for user ${user?._id}, skipping trial-started email`);
    return;
  }

  const trialEndFormatted = new Date(trialEnd).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f6f9fc;">
      <table role="presentation" width="100%" style="background-color:#f6f9fc;padding:40px 0;">
        <tr><td align="center">
          <table role="presentation" width="600" style="background-color:#fff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">
            <tr><td style="padding:32px 40px;text-align:center;background-color:#000;">
              <img src="https://www.datacircles.in/assets/DataCirclesBWLogo.jpg" alt="DataCircles" style="max-width:180px;">
            </td></tr>
            <tr><td style="padding:40px;">
              <h1 style="color:#23272a;font-size:24px;margin:0 0 16px;">Your DataCircles trial is active</h1>
              <p style="color:#4a5568;font-size:15px;line-height:1.6;">
                Hi ${user.name || 'there'}, your 7-day free trial for <strong>${organization?.name || 'your workspace'}</strong> is now active, with full access to all Growth plan features.
              </p>
              <p style="color:#4a5568;font-size:15px;line-height:1.6;">
                Your trial ends on <strong>${trialEndFormatted}</strong>. You can choose a plan at any time from Settings &gt; Subscription, and your data and setup carry over.
              </p>
            </td></tr>
            ${FOOTER_HTML}
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  await sendGridMail({
    to: toEmail,
    subject: 'Your DataCircles trial is active',
    html,
  });
}

async function sendTrialEndingEmail(user, organization, trialEnd, hoursRemaining) {
  const toEmail = getUserEmail(user);
  if (!toEmail) {
    console.warn(`[trialEmails] No email found for user ${user?._id}, skipping trial-ending email`);
    return;
  }

  const trialEndFormatted = new Date(trialEnd).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f6f9fc;">
      <table role="presentation" width="100%" style="background-color:#f6f9fc;padding:40px 0;">
        <tr><td align="center">
          <table role="presentation" width="600" style="background-color:#fff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">
            <tr><td style="padding:32px 40px;text-align:center;background-color:#000;">
              <img src="https://www.datacircles.in/assets/DataCirclesBWLogo.jpg" alt="DataCircles" style="max-width:180px;">
            </td></tr>
            <tr><td style="padding:40px;">
              <h1 style="color:#23272a;font-size:24px;margin:0 0 16px;">Your trial ends on ${trialEndFormatted}</h1>
              <p style="color:#4a5568;font-size:15px;line-height:1.6;">
                Hi ${user.name || 'there'}, your free trial for <strong>${organization?.name || 'your workspace'}</strong> ends on <strong>${trialEndFormatted}</strong>, about ${hoursRemaining} hours from now.
              </p>
              <p style="color:#4a5568;font-size:15px;line-height:1.6;">
                To keep adding and editing data after that, choose a plan. Your existing data stays available to view either way.
              </p>
              <table role="presentation" width="100%" style="margin:24px 0;">
                <tr><td align="center">
                  <a href="${process.env.FRONTEND_URL}/subscription" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:14px 32px;border-radius:5px;font-size:15px;font-weight:600;display:inline-block;">
                    Choose a plan
                  </a>
                </td></tr>
              </table>
            </td></tr>
            ${FOOTER_HTML}
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  await sendGridMail({
    to: toEmail,
    subject: `Your DataCircles trial ends on ${trialEndFormatted}`,
    html,
  });
}

async function sendTrialExpiredEmail(user, organization) {
  const toEmail = getUserEmail(user);
  if (!toEmail) {
    console.warn(`[trialEmails] No email found for user ${user?._id}, skipping trial-expired email`);
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f6f9fc;">
      <table role="presentation" width="100%" style="background-color:#f6f9fc;padding:40px 0;">
        <tr><td align="center">
          <table role="presentation" width="600" style="background-color:#fff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">
            <tr><td style="padding:32px 40px;text-align:center;background-color:#000;">
              <img src="https://www.datacircles.in/assets/DataCirclesBWLogo.jpg" alt="DataCircles" style="max-width:180px;">
            </td></tr>
            <tr><td style="padding:40px;">
              <h1 style="color:#23272a;font-size:24px;margin:0 0 16px;">Your trial has ended</h1>
              <p style="color:#4a5568;font-size:15px;line-height:1.6;">
                Hi ${user.name || 'there'}, your free trial for <strong>${organization?.name || 'your workspace'}</strong> has ended. Your data is safe and you can still sign in to view everything you've added.
              </p>
              <p style="color:#4a5568;font-size:15px;line-height:1.6;">
                To start adding and editing again, choose a plan that fits your team.
              </p>
              <table role="presentation" width="100%" style="margin:24px 0;">
                <tr><td align="center">
                  <a href="${process.env.FRONTEND_URL}/subscription" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:14px 32px;border-radius:5px;font-size:15px;font-weight:600;display:inline-block;">
                    Choose a plan
                  </a>
                </td></tr>
              </table>
            </td></tr>
            ${FOOTER_HTML}
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  await sendGridMail({
    to: toEmail,
    subject: 'Your DataCircles trial has ended',
    html,
  });
}

module.exports = {
  sendTrialStartedEmail,
  sendTrialEndingEmail,
  sendTrialExpiredEmail,
};
