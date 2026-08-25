const sendGridMail = require('./sendGridMail');

const sendTaskReminder = async (to, task) => {
  const mailOptions = {
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

  await sendGridMail(mailOptions);
};

module.exports = { sendTaskReminder };
