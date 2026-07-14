// utils/trialEmails.js
//
// Email senders for the trial lifecycle: started, ending soon (48h/24h),
// and expired. Uses the existing sendGridMail utility — same pattern as
// your invite/OTP emails elsewhere in the codebase.
//
// IMPORTANT: sendGridMail's `from` parameter is ignored — it always sends
// from yash.mishra@datacircles.in regardless of what's passed. Don't try
// to override that here.

const sendGridMail = require('./sendGridMail');

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
              <img src="https://www.datacircles.in/assets/DataCirclesBWLogo.jpg" alt="Data Circles" style="max-width:180px;">
            </td></tr>
            <tr><td style="padding:40px;">
              <h1 style="color:#23272a;font-size:24px;margin:0 0 16px;">Your free trial has started!</h1>
              <p style="color:#4a5568;font-size:15px;line-height:1.6;">
                Hi ${user.name || 'there'}, your 7-day free trial for <strong>${organization?.name || 'your workspace'}</strong> is now active.
              </p>
              <p style="color:#4a5568;font-size:15px;line-height:1.6;">
                Your trial ends on <strong>${trialEndFormatted}</strong>. You'll have full access to all Growth plan features until then.
              </p>
              <p style="color:#4a5568;font-size:15px;line-height:1.6;">
                When you're ready, you can upgrade anytime from your Settings &rarr; Subscription page.
              </p>
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

  await sendGridMail({
    to: toEmail,
    subject: 'Your DataCircles free trial has started',
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
              <img src="https://www.datacircles.in/assets/DataCirclesBWLogo.jpg" alt="Data Circles" style="max-width:180px;">
            </td></tr>
            <tr><td style="padding:40px;">
              <h1 style="color:#23272a;font-size:24px;margin:0 0 16px;">Your trial ends in ${hoursRemaining} hours</h1>
              <p style="color:#4a5568;font-size:15px;line-height:1.6;">
                Hi ${user.name || 'there'}, your free trial for <strong>${organization?.name || 'your workspace'}</strong> ends on <strong>${trialEndFormatted}</strong>.
              </p>
              <p style="color:#4a5568;font-size:15px;line-height:1.6;">
                After your trial ends, you'll still be able to view all your existing data, but you won't be able to add or edit anything until you subscribe to a plan.
              </p>
              <table role="presentation" width="100%" style="margin:24px 0;">
                <tr><td align="center">
                  <a href="${process.env.FRONTEND_URL}/subscription" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:14px 32px;border-radius:5px;font-size:15px;font-weight:600;display:inline-block;">
                    Choose a plan
                  </a>
                </td></tr>
              </table>
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

  await sendGridMail({
    to: toEmail,
    subject: `Your DataCircles trial ends in ${hoursRemaining} hours`,
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
              <img src="https://www.datacircles.in/assets/DataCirclesBWLogo.jpg" alt="Data Circles" style="max-width:180px;">
            </td></tr>
            <tr><td style="padding:40px;">
              <h1 style="color:#23272a;font-size:24px;margin:0 0 16px;">Your trial has ended</h1>
              <p style="color:#4a5568;font-size:15px;line-height:1.6;">
                Hi ${user.name || 'there'}, your free trial for <strong>${organization?.name || 'your workspace'}</strong> has ended.
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
