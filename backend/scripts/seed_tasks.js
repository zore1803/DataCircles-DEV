require('dotenv').config({ path: '.env' });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Company = require('../models/Company');
const User = require('../models/User');

async function seed() {
  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI is missing from .env');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB successfully');

    // Find any user
    const user = await User.findOne();
    if (!user) {
      console.error('No users found in the database. Please create a user first.');
      process.exit(1);
    }

    // Try to find Amber Collective, otherwise get the first company
    let company = await Company.findOne({ name: /Amber Collective/i });
    if (!company) {
      company = await Company.findOne();
    }

    if (!company) {
      console.error('No companies found in the database.');
      process.exit(1);
    }

    const tasks = [];
    const priorities = ['low', 'medium', 'high'];
    const statuses = ['Pending', 'Completed'];

    for (let i = 1; i <= 90; i++) {
      // Randomly spread dates between -15 days and +15 days
      const daysOffset = Math.floor(Math.random() * 30) - 15;
      const dueDate = new Date(Date.now() + 86400000 * daysOffset);
      const selectedDate = new Date(Date.now() + 86400000 * (daysOffset - 2));
      
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      
      // If the due date is in the past, it's more likely to be completed
      let status;
      if (daysOffset < 0) {
        status = Math.random() > 0.3 ? 'Completed' : 'Pending'; // 70% completed if past
      } else {
        status = Math.random() > 0.9 ? 'Completed' : 'Pending'; // 10% completed if future
      }

      tasks.push({
        title: `Sample Task ${i} for ${company.name}`,
        description: `This is a generated sample task #${i} created to test pagination and UI rendering.`,
        dueDate,
        selectedDate,
        status,
        priority,
        relatedEntities: [{ entityId: company._id, entityModel: 'Company' }],
        users: [user._id],
        createdBy: user._id,
        organization: user.organization || company.organization,
      });
    }

    await Task.insertMany(tasks);
    console.log(`Successfully inserted ${tasks.length} tasks linked to Company: ${company.name}`);

  } catch (error) {
    console.error('Error seeding tasks:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

seed();
