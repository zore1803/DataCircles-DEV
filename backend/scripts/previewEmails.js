/* eslint-disable */
// Fast local email preview.
//
//   node backend/scripts/previewEmails.js            # writes the files
//   node backend/scripts/previewEmails.js --open      # writes + opens in your browser
//   npm run preview:emails            (from backend/, add --open after -- )
//
// Renders every DataCircles-authored email through the shared shell
// (utils/emailLayout.js) with sample data and writes one HTML file per
// email plus an index.html into backend/scripts/email-previews/.
// No database, no network for the render itself (the logo loads from the
// live datacircles.in URL when you open the page).

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { renderEmail } = require('../utils/emailLayout');

process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'https://portal.datacircles.in';
const PLAN_URL = `${process.env.FRONTEND_URL}/subscription`;

// name -> rendered HTML. Payloads mirror the real senders in
// utils/trialEmails.js, utils/adminActionEmails.js, utils/reminderMail.js
// and the controllers.
const emails = {
  'trial-started': renderEmail({
    greetingName: 'Priya Sharma',
    intro: [
      'Your 7-day free trial for <strong>Acme Traders</strong> is now active, with full access to all Growth plan features.',
      'Your trial ends on <strong>16 September 2026</strong>. You can choose a plan at any time from Settings &gt; Subscription, and your data and setup carry over.',
    ],
  }),
  'trial-ending': renderEmail({
    greetingName: 'Priya Sharma',
    intro: [
      'Your free trial for <strong>Acme Traders</strong> ends in about 24 hours, on <strong>16 September 2026</strong>.',
      'To keep adding and editing data after that, choose a plan. Your existing data stays available to view either way.',
    ],
    ctaLabel: 'Choose a plan',
    ctaUrl: PLAN_URL,
  }),
  'trial-expired': renderEmail({
    greetingName: 'Priya Sharma',
    intro: [
      "Your free trial for <strong>Acme Traders</strong> has ended. Your data is safe and you can still sign in to view everything you've added.",
      'To start adding and editing again, choose a plan that fits your team.',
    ],
    ctaLabel: 'Choose a plan',
    ctaUrl: PLAN_URL,
  }),
  'trial-adjusted-by-support': renderEmail({
    greetingName: 'Priya Sharma',
    intro: [
      'Our support team has extended the free trial for <strong>Acme Traders</strong> by 5 days.',
      'Your trial now ends on <strong>21 September 2026</strong>.',
      'Questions? Reply to this email or contact support@datacircles.in.',
    ],
  }),
  'trial-ended-by-support': renderEmail({
    greetingName: 'Priya Sharma',
    intro: [
      'Our support team has ended the free trial for <strong>Acme Traders</strong>. Your data is safe and remains available to view.',
      'To continue adding and editing data, choose a plan.',
    ],
    ctaLabel: 'Choose a plan',
    ctaUrl: PLAN_URL,
    closingHtml: '<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#333333;">Questions? Contact support@datacircles.in.</p>',
  }),
  'subscription-cancelled-by-support': renderEmail({
    greetingName: 'Priya Sharma',
    intro: [
      'Our support team has cancelled the DataCircles subscription for <strong>Acme Traders</strong>.',
      "You'll keep full access until <strong>30 September 2026</strong>. After that, your data stays available to view in read-only mode.",
      "If this was unexpected, contact support@datacircles.in and we'll be glad to help.",
    ],
  }),
  'email-verification-otp': renderEmail({
    intro: 'Use this code to verify your email address and finish setting up your DataCircles account:',
    blocks: [{ html: '<div style="margin:20px 0;text-align:center;"><div style="display:inline-block;padding:16px 28px;background:#f4f6f8;border:1px solid #e5e7eb;border-radius:6px;font-size:32px;font-weight:700;letter-spacing:8px;font-family:\'Courier New\',monospace;color:#111111;">482913</div></div>' }],
    closingHtml: "<p style=\"margin:8px 0 0;font-size:14px;line-height:1.6;color:#333333;\">This code expires in <strong>10 minutes</strong>. If you didn't request it, you can ignore this email.</p>",
  }),
  'password-reset': renderEmail({
    greetingName: 'Priya Sharma',
    intro: 'We received a request to reset the password for your DataCircles account. Use the button below to choose a new one.',
    ctaLabel: 'Reset password',
    ctaUrl: `${process.env.FRONTEND_URL}/reset-password?token=SAMPLE`,
    closingHtml: "<p style=\"margin:8px 0 0;font-size:14px;line-height:1.6;color:#333333;\">This link expires in 1 hour. If you didn't make this request, no action is needed and your password stays the same.</p>",
  }),
  'workspace-invite': renderEmail({
    intro: [
      '<strong>Rahul Mehta</strong> has invited you to join <strong>Acme Traders</strong> on DataCircles, the CRM the team uses to manage contacts, deals and day-to-day sales work.',
      "Once you accept, you'll be able to work with Acme Traders's contacts, companies and deals, shared sales pipelines and team workflows, real-time collaboration, and reporting and analytics tools.",
    ],
    ctaLabel: 'Accept invitation',
    ctaUrl: `${process.env.FRONTEND_URL}`,
    closingHtml: "<p style=\"margin:16px 0 0;font-size:14px;line-height:1.6;color:#333333;\">This invitation link is unique to you. If you weren't expecting it, you can ignore this email.</p>",
  }),
  'referral': renderEmail({
    intro: [
      '<strong>Rahul Mehta</strong> from <strong>Acme Traders</strong> uses DataCircles to manage their sales and customer relationships, and thought it could be a good fit for your business.',
      'In DataCircles you can manage customers and deals, sales pipelines, invoices and quotations, and reports and team collaboration.',
    ],
    ctaLabel: 'See how it works',
    ctaUrl: `${process.env.FRONTEND_URL}?ref=SAMPLE`,
    closingHtml: '<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#333333;">If you sign up and become a paying customer, both you and Acme Traders receive a referral reward.</p>',
  }),
  'new-staff-joined': renderEmail({
    intro: '<strong>Sana Kapoor</strong> (sana@acme.example) has accepted their invitation and is now a member of Acme Traders on DataCircles.',
    blocks: [{ rows: [
      { label: 'Team member', value: 'Sana Kapoor' },
      { label: 'Contact', value: 'sana@acme.example' },
      { label: 'Organisation', value: 'Acme Traders' },
    ]}],
    closingHtml: '<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#333333;">Review or adjust what they can access from Settings &gt; User Management.</p>',
  }),
  'task-assigned': renderEmail({
    greetingName: 'Priya Sharma',
    intro: 'You have been assigned a task in DataCircles. The details are below.',
    blocks: [{ rows: [
      { label: 'Task', value: 'Follow up on renewal quote' },
      { label: 'Due date', value: '18 September 2026' },
      { label: 'Description', value: 'Call the client and confirm the revised pricing.' },
      { label: 'Related to', value: 'Deal: Acme renewal 2026' },
    ]}],
    closingHtml: '<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#333333;">Open the task in DataCircles to review it or update its status.</p>',
  }),
  'task-reminder': renderEmail({
    intro: 'This is a reminder that the following task is due on <strong>18 September 2026</strong>.',
    blocks: [{ rows: [
      { label: 'Task', value: 'Follow up on renewal quote' },
      { label: 'Due date', value: '18 September 2026' },
      { label: 'Details', value: 'Call the client and confirm the revised pricing.' },
    ]}],
    closingHtml: '<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#333333;">Open it in DataCircles to update its status.</p>',
  }),
  'meeting-scheduled': renderEmail({
    intro: 'A meeting has been scheduled: <strong>Q3 pricing review</strong>. The details are below.',
    blocks: [{ rows: [
      { label: 'Date and time', value: '19 April 2026, 6:30 PM' },
      { label: 'Duration', value: '45 minutes' },
      { label: 'Location', value: 'Google Meet' },
      { label: 'Type', value: 'video-call' },
      { label: 'Related Company', value: 'Acme Traders' },
      { label: 'Participants', value: 'Priya Sharma, Rahul Mehta' },
      { label: 'Description', value: 'Review renewal pricing and open escalations.' },
    ]}],
    closingHtml: '<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#333333;">Add it to your calendar so you have time to prepare.</p>',
  }),
  'meeting-updated': renderEmail({
    intro: 'A meeting has been updated: <strong>Q3 pricing review</strong>. The current details are below.',
    blocks: [
      { rows: [
        { label: 'Date and time', value: '20 April 2026, 4:00 PM' },
        { label: 'Duration', value: '45 minutes' },
        { label: 'Location', value: 'Google Meet' },
      ]},
      { heading: 'What changed', rows: [
        { label: 'Date and time', value: '19 April 2026, 6:30 PM to 20 April 2026, 4:00 PM' },
      ]},
    ],
    closingHtml: '<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#333333;">Update your calendar to match.</p>',
  }),
  'meeting-reminder': renderEmail({
    intro: 'Your meeting <strong>Q3 pricing review</strong> starts in about 1 hour.',
    blocks: [{ rows: [
      { label: 'Date and time', value: '19 April 2026, 6:30 PM' },
      { label: 'Duration', value: '45 minutes' },
      { label: 'Location', value: 'Google Meet' },
      { label: 'Type', value: 'video-call' },
      { label: 'Description', value: 'Review renewal pricing and open escalations.' },
    ]}],
    closingHtml: '<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#333333;">Prepare any materials you need for this meeting.</p>',
  }),
  'meeting-cancelled': renderEmail({
    intro: 'The meeting <strong>Q3 pricing review</strong> has been cancelled. You can remove it from your calendar.',
    blocks: [{ rows: [
      { label: 'Was scheduled for', value: '19 April 2026, 6:30 PM' },
      { label: 'Duration', value: '45 minutes' },
      { label: 'Location', value: 'Google Meet' },
    ]}],
  }),
  'meeting-completed': renderEmail({
    intro: 'The meeting <strong>Q3 pricing review</strong> is marked complete.',
    blocks: [{ rows: [
      { label: 'Meeting', value: 'Q3 pricing review' },
      { label: 'Was scheduled for', value: '19 April 2026, 6:30 PM' },
      { label: 'Notes', value: 'Client agreed to the revised pricing.' },
      { label: 'Outcome', value: 'Won' },
    ]}],
  }),
  'deal-stage-changed-staff': renderEmail({
    greetingName: 'Priya Sharma',
    intro: 'The deal <strong>Acme renewal 2026</strong> has moved from Negotiation to Won. The details are below.',
    blocks: [{ rows: [
      { label: 'Deal title', value: 'Acme renewal 2026' },
      { label: 'Old status', value: 'Negotiation' },
      { label: 'New status', value: 'Won' },
      { label: 'Amount', value: '₹450,000' },
      { label: 'Company', value: 'Acme Traders' },
      { label: 'Contact', value: 'Rahul Mehta' },
      { label: 'Updated at', value: '9 September 2026' },
    ]}],
    closingHtml: '<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#333333;">Review the updated deal and take any next steps.</p>',
  }),

  // --- Part B: customer -> their customer, sent on the org's behalf.
  //     Same shell + DataCircles footer, signed off as the sending org.
  'B-quotation': renderEmail({
    greetingName: 'Rahul Mehta',
    intro: [
      'Please find attached quotation QUO-014, dated 9 September 2026, for a total of ₹2,45,000.00.',
      'This quotation is valid until 24 September 2026.',
      'Let us know if you would like any changes.',
    ],
    blocks: [{ rows: [
      { label: 'Quotation', value: 'QUO-014' },
      { label: 'Date', value: '9 September 2026' },
      { label: 'Total', value: '₹2,45,000.00' },
      { label: 'Valid until', value: '24 September 2026' },
    ]}],
    signOff: 'Acme Traders',
  }),
  'B-invoice-bulk': renderEmail({
    greetingName: 'Rahul Mehta',
    intro: [
      'Please find attached 3 invoices from Acme Traders, totalling ₹1,80,000.00.',
      'Payment terms and bank details are on each invoice. Reply to this email with any questions.',
    ],
    blocks: [{ rows: [
      { label: 'Invoices', value: '3' },
      { label: 'Total', value: '₹1,80,000.00' },
    ]}],
    signOff: 'Acme Traders',
  }),
  'B-payment-receipt': renderEmail({
    greetingName: 'Rahul Mehta',
    intro: 'Thank you. We have recorded your payment against invoice <strong>INV-2051</strong>.',
    blocks: [{ rows: [
      { label: 'Invoice number', value: 'INV-2051' },
      { label: 'Amount received', value: '₹50,000.00' },
      { label: 'Payment date', value: '09 Sep 2026' },
      { label: 'Method', value: 'UPI' },
      { label: 'Reference / UTR', value: 'A1B2C3D4E5' },
      { label: 'Balance on this invoice', value: '₹25,000.00' },
    ]}],
    closingHtml: '<p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#333333;">This is a part payment; ₹25,000.00 remains outstanding.</p><p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#9aa0a6;">This receipt is generated automatically. Please keep it for your records.</p>',
    signOff: 'Acme Traders',
  }),
  'B-public-share-link': renderEmail({
    greetingName: 'Rahul Mehta',
    intro: 'Please find attached invoice INV-2051, dated 9 September 2026, for ₹75,000.00.',
    blocks: [{ rows: [
      { label: 'Invoice', value: 'INV-2051' },
      { label: 'Date', value: '9 September 2026' },
      { label: 'Amount', value: '₹75,000.00' },
    ]}],
    ctaLabel: 'View / download',
    ctaUrl: 'https://portal.datacircles.in/view/invoice/abc123',
    signOff: 'Acme Traders',
  }),
  'B-deal-update-contact': renderEmail({
    greetingName: 'Rahul Mehta',
    intro: 'There is an update on <strong>Acme renewal 2026</strong>: it has moved from Negotiation to Won.',
    blocks: [{ rows: [
      { label: 'Deal', value: 'Acme renewal 2026' },
      { label: 'Previous status', value: 'Negotiation' },
      { label: 'Current status', value: 'Won' },
      { label: 'Value', value: '₹4,50,000' },
    ]}],
    closingHtml: '<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#333333;">We will be in touch with the next steps. Reply to this email if you have any questions.</p>',
    signOff: 'Acme Traders',
  }),
};

const outDir = path.join(__dirname, 'email-previews');
fs.mkdirSync(outDir, { recursive: true });

const names = Object.keys(emails);
for (const name of names) {
  fs.writeFileSync(path.join(outDir, `${name}.html`), emails[name]);
}

const index = `<!doctype html><meta charset="utf-8"><title>DataCircles email previews</title>
<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;background:#f4f5f7;">
<div style="max-width:900px;margin:0 auto;padding:24px;">
  <h1 style="font-size:20px;">DataCircles email previews</h1>
  <p style="color:#555;">Generated ${new Date().toLocaleString()}. FRONTEND_URL = <code>${process.env.FRONTEND_URL}</code></p>
  ${names
    .map(
      (n) => `
  <h2 style="font-size:15px;margin:32px 0 8px;">${n}
    <a href="${n}.html" target="_blank" style="font-weight:normal;font-size:13px;">open full</a></h2>
  <iframe src="${n}.html" style="width:100%;height:640px;border:1px solid #ddd;background:#fff;"></iframe>`
    )
    .join('')}
</div></body>`;
fs.writeFileSync(path.join(outDir, 'index.html'), index);

const indexPath = path.join(outDir, 'index.html');
console.log(`Wrote ${names.length + 1} files to ${outDir}`);
console.log(`Open: ${indexPath}`);

if (process.argv.includes('--open')) {
  try {
    const cmd =
      process.platform === 'win32'
        ? `start "" "${indexPath}"`
        : process.platform === 'darwin'
        ? `open "${indexPath}"`
        : `xdg-open "${indexPath}"`;
    execSync(cmd, { shell: true });
  } catch (e) {
    console.log('Could not auto-open; open the path above manually.');
  }
}
