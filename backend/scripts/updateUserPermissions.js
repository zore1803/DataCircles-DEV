const mongoose = require('mongoose');
const User = require('../models/User'); // Adjust the path to your User model
const dotenv = require('dotenv').config();

// MongoDB connection URI (replace with your actual MongoDB URI)
const MONGODB_URI = process.env.MONGO_URI;

// Permissions to append
const newPermissions = [
  { name: 'quotations', permission: 'read-write' },
  { name: 'delivery-challans', permission: 'read-write' },
  { name: 'purchases', permission: 'read-write' },
  { name: 'purchase-orders', permission: 'read-write' }
];

async function updateUserPermissions() {
  let session;

  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Start a session
    session = await mongoose.startSession();
    session.startTransaction();

    // Fetch all users
    const users = await User.find().session(session);
    console.log(`Found ${users.length} users`);

    if (users.length === 0) {
      console.log('No users found to update');
      await session.commitTransaction();
      session.endSession();
      await mongoose.disconnect();
      return;
    }

    // Update each user's permissions
    for (const user of users) {
      // Avoid duplicating permissions by checking if they already exist
      const existingPermissions = user.permissions.map(p => p.name);
      const permissionsToAdd = newPermissions.filter(
        perm => !existingPermissions.includes(perm.name)
      );

      if (permissionsToAdd.length > 0) {
        user.permissions.push(...permissionsToAdd);
        await user.save({ session });
        console.log(`Updated permissions for user ${user.email || user._id}: Added ${permissionsToAdd.map(p => p.name).join(', ')}`);
      } else {
        console.log(`No new permissions to add for user ${user.email || user._id}`);
      }
    }

    // Commit the transaction
    await session.commitTransaction();
    console.log('Transaction committed successfully');

  } catch (error) {
    console.error('Error updating user permissions:', error.message);
    if (session) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
updateUserPermissions()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });