const sgMail = require('@sendgrid/mail');
// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendGridMail({ 
  to, 
  subject, 
  text, 
  html, 
  from,
  replyTo,
  cc, 
  bcc, 
  attachments,
  templateId,
  dynamicTemplateData 
}) {
  try {
    // Prepare base email message
    const msg = {
      to,
      from: from || {
        email: process.env.SENDGRID_FROM_EMAIL || "noreply@datacircles.in",
        name: "DataCircles",
      },
      subject,
      text,
      html,
    };

    if (replyTo) msg.replyTo = replyTo;
    // Add optional fields if provided
    if (cc) msg.cc = cc;
    if (bcc) msg.bcc = bcc;
    if (attachments) {
      msg.attachments = attachments.map((attachment) => ({
        ...attachment,
        content: Buffer.isBuffer(attachment.content) || ArrayBuffer.isView(attachment.content)
          ? Buffer.from(attachment.content).toString("base64")
          : attachment.content,
      }));
    }
    
    // Handle dynamic templates
    if (templateId) {
      msg.templateId = templateId;
      if (dynamicTemplateData) {
        msg.dynamicTemplateData = dynamicTemplateData;
      }
      // Remove text/html when using templates
      delete msg.text;
      delete msg.html;
    }

    // Send email via SendGrid
    const response = await sgMail.send(msg);
    
    console.log('SendGrid email sent successfully:', response[0].statusCode);
    return {
      success: true,
      messageId: response[0].headers['x-message-id'],
      statusCode: response[0].statusCode,
      response: response[0]
    };
  } catch (error) {
    console.error('Error sending SendGrid email:', error);
    
    // Handle SendGrid specific errors
    if (error.response) {
      const { message, code, response } = error;
      const errorDetails = response?.body?.errors || [];
      throw new Error(`SendGrid Error ${code}: ${message}. Details: ${JSON.stringify(errorDetails)}`);
    }
    
    throw error;
  }
}

module.exports = sendGridMail;
