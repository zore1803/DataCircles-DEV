const nodemailer = require('nodemailer');

// Email service configurations
const getEmailConfig = (email) => {
  const domain = email.split('@')[1].toLowerCase();
  
  switch (domain) {
    case 'gmail.com':
      return {
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
      };
    case 'outlook.com':
    case 'hotmail.com':
    case 'live.com':
      return {
        service: 'hotmail',
        host: 'smtp-mail.outlook.com',
        port: 587,
        secure: false,
      };
    case 'yahoo.com':
    case 'yahoo.co.uk':
    case 'yahoo.ca':
      return {
        service: 'yahoo',
        host: 'smtp.mail.yahoo.com',
        port: 587,
        secure: false,
      };
    case 'icloud.com':
    case 'me.com':
      return {
        host: 'smtp.mail.me.com',
        port: 587,
        secure: false,
      };
    default:
      // For custom domains or other providers
      return {
        host: `smtp.${domain}`,
        port: 587,
        secure: false,
      };
  }
};

async function sendMail({ from, to, subject, text, html, auth }) {
  try {
    // Use provided from email or fallback to default
    const senderEmail = from || process.env.MAIL_USER;
    
    // Get email configuration based on sender's domain
    const emailConfig = getEmailConfig(senderEmail);
    
    // Configure transporter
    const transporter = nodemailer.createTransport({
      ...emailConfig,
      auth: auth || {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    // Send mail
    const info = await transporter.sendMail({
      from: senderEmail,
      to,
      subject,
      text,
      html,
    });

    console.log('Message sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

module.exports = sendMail;