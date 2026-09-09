// utils/adminActionEmails.js
//
// Email senders for super-admin-initiated subscription changes (trial
// adjusted, trial ended, subscription cancelled on the org's behalf). All
// use the shared renderEmail shell so they match every other DataCircles
// email.

const sendGridMail = require('./sendGridMail');
const { renderEmail } = require('./emailLayout');

function getUserEmail(user) {
  return user?.email || user?.profileEmail || null;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

async function sendTrialAdjustedByAdminEmail(user, organization, trialEnd, adjustmentDays) {
  const toEmail = getUserEmail(user);
  if (!toEmail) {
    console.warn(`[adminActionEmails] No email found for user ${user?._id}, skipping trial-adjusted email`);
    return;
  }

  const direction = adjustmentDays > 0 ? 'extended' : 'reduced';
  const dayCount = Math.abs(adjustmentDays);
  const orgName = organization?.name || 'your workspace';
  const trialEndFormatted = fmtDate(trialEnd);

  const html = renderEmail({
    greetingName: user.name || null,
    intro: [
      `Our support team has ${direction} the free trial for <strong>${orgName}</strong> by ${dayCount} day${dayCount === 1 ? '' : 's'}.`,
      `Your trial now ends on <strong>${trialEndFormatted}</strong>.`,
      'Questions? Reply to this email or contact support@datacircles.in.',
    ],
    preheader: `Your DataCircles trial for ${orgName} now ends on ${trialEndFormatted}.`,
  });

  await sendGridMail({
    to: toEmail,
    subject: `Your DataCircles trial now ends on ${trialEndFormatted}`,
    html,
  });
}

async function sendTrialEndedByAdminEmail(user, organization) {
  const toEmail = getUserEmail(user);
  if (!toEmail) {
    console.warn(`[adminActionEmails] No email found for user ${user?._id}, skipping trial-ended email`);
    return;
  }

  const orgName = organization?.name || 'your workspace';

  const html = renderEmail({
    greetingName: user.name || null,
    intro: [
      `Our support team has ended the free trial for <strong>${orgName}</strong>. Your data is safe and remains available to view.`,
      'To continue adding and editing data, choose a plan.',
    ],
    ctaLabel: 'Choose a plan',
    ctaUrl: `${process.env.FRONTEND_URL}/subscription`,
    closingHtml: '<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#333333;">Questions? Contact support@datacircles.in.</p>',
    preheader: `Your DataCircles trial for ${orgName} has ended.`,
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

  const orgName = organization?.name || 'your workspace';
  const accessEnd = currentPeriodEnd ? fmtDate(currentPeriodEnd) : 'the end of your current billing period';

  const intro = isTrial
    ? [
        `Our support team has cancelled the trial for <strong>${orgName}</strong>.`,
        'Your data stays available to view in read-only mode.',
        "If this was unexpected, contact support@datacircles.in and we'll be glad to help.",
      ]
    : [
        `Our support team has cancelled the DataCircles subscription for <strong>${orgName}</strong>.`,
        `You'll keep full access until <strong>${accessEnd}</strong>. After that, your data stays available to view in read-only mode.`,
        "If this was unexpected, contact support@datacircles.in and we'll be glad to help.",
      ];

  const html = renderEmail({
    greetingName: user.name || null,
    intro,
    preheader: `Your DataCircles subscription for ${orgName} has been cancelled.`,
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
