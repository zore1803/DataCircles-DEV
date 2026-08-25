const sendGridMail = require('./sendGridMail');

async function sendMail({ from, to, subject, text, html, auth }) {
  // `auth` is retained for call-site compatibility; SendGrid owns delivery.
  return sendGridMail({ to, subject, text, html, from });
}

module.exports = sendMail;