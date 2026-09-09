const sendGridMail = require('./sendGridMail');
const { renderEmail } = require('./emailLayout');

const sendTaskReminder = async (to, task) => {
  const dueDate = new Date(task.dueDate).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const rows = [
    { label: 'Task', value: task.title },
    { label: 'Due date', value: dueDate },
    task.description ? { label: 'Details', value: task.description } : null,
  ];

  const html = renderEmail({
    intro: `This is a reminder that the following task is due on <strong>${dueDate}</strong>.`,
    blocks: [{ rows }],
    closingHtml: '<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#333333;">Open it in DataCircles to update its status.</p>',
    preheader: `Task "${task.title}" is due ${dueDate}.`,
  });

  await sendGridMail({
    to,
    subject: `Reminder: "${task.title}" is due ${dueDate}`,
    html,
  });
};

module.exports = { sendTaskReminder };
