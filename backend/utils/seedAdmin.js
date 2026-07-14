const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb+srv://saiganesh:L3raPXa09tYdL4Or@cluster0.hsbuki3.mongodb.net/crm_invoicing", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');

    // Define admin user data
    const adminData = {
      name: 'Saiganesh',
      email: 'saiganesh3108@gmail.com',
      role: 'admin',
      permissions: [
        { name: 'Companies', permission: 'read-write' },
        { name: 'Deals', permission: 'read-write' },
        { name: 'Contacts', permission: 'read-write' },
        { name: 'Invoices', permission: 'read-write' },
        { name: 'Tasks', permission: 'read-write' },
        { name: 'Vendors', permission: 'read-write' },
      ],
    };

    // Check if user already exists by email
    const existingUser = await User.findOne({ email: adminData.email });

    if (existingUser) {
      if (existingUser.role === 'admin') {
        console.log(`Admin user with email ${adminData.email} already exists`);
        return;
      } else if (existingUser.role === 'staff') {
        // Promote staff to admin
        existingUser.role = 'admin';
        existingUser.permissions = adminData.permissions;
        await existingUser.save();
        console.log(`User ${adminData.name} (${adminData.email}) promoted to admin`);
        return;
      }
    }

    // Create new admin user if none exists, without auth0Id
    const adminUser = new User(adminData);
    await adminUser.save();
    console.log(`Admin user ${adminData.name} (${adminData.email}) created successfully`);

  } catch (error) {
    console.error('Error seeding admin user:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
};

// Run the seed function
seedAdmin();