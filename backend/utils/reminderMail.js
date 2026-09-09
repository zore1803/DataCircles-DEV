const sendGridMail = require('./sendGridMail');

const sendTaskReminder = async (to, task) => {
  const dueDate = new Date(task.dueDate).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const mailOptions = {
    to,
    subject: `Reminder: "${task.title}" is due ${dueDate}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#333;">
        <p>Hi,</p>
        <p>This is a reminder that your task "<strong>${task.title}</strong>" is due on <strong>${dueDate}</strong>.</p>
        ${task.description ? `<p>${task.description}</p>` : ''}
        <p>Open it in DataCircles to update its status.</p>
        <p style="margin-top:24px;">Regards,<br>Team DataCircles</p>
      </div>
    `,
  };

  await sendGridMail(mailOptions);
};

module.exports = { sendTaskReminder };
