const cron = require('node-cron');
const Task = require('../models/Task');
const User = require('../models/User');
const { sendTaskReminder } = require('./reminderMail');

const startReminderJob = () => {
  cron.schedule('0 * * * *', async () => { // every hour
    const now = new Date();
    const oneDayLater = new Date(Date.now() + 24 * 60 * 60 * 1000); // +1 day

    const tasks = await Task.find({
      dueDate: { $gte: now, $lte: oneDayLater },
      status: { $ne: 'Completed' }
    }).populate('user');

    for (const task of tasks) {
      const userId = task.user;
      const user = await User.findById(userId);
      if (user?.email) {
        await sendTaskReminder(user.email, task);
        console.log(`Reminder sent to ${user.email} for task: ${task.title}`);
      }
    }
  });
};

module.exports = startReminderJob;
