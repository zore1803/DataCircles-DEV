const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // or use a custom SMTP
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

const sendTaskReminder = async (to, task) => {
  const mailOptions = {
    from: `"Task Manager" <${process.env.MAIL_USER}>`,
    to,
    subject: `🔔 Task Reminder: "${task.title}" is due soon`,
    html: `
      <div>
        <h2>Hello!</h2>
        <p>Your task "<strong>${task.title}</strong>" is due on <strong>${new Date(task.dueDate).toLocaleDateString()}</strong>.</p>
        <p>Description: ${task.description}</p>
        <p><strong>Please complete it on time!</strong></p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendTaskReminder };
