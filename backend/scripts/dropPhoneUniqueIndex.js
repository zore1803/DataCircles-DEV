// scripts/dropPhoneUniqueIndex.js
// ONE-TIME migration. Multiple accounts are now allowed to share the same
// phone number (see models/User.js), but Mongoose does not retroactively
// alter indexes already created in MongoDB, so the old unique index on
// `phone` keeps rejecting duplicates until it's dropped by hand.
//
// Run with:  node scripts/dropPhoneUniqueIndex.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    const collection = mongoose.connection.collection('users');
    const indexes = await collection.indexes();
    const phoneIndex = indexes.find(
      (idx) => idx.key && Object.keys(idx.key).length === 1 && idx.key.phone === 1 && idx.unique
    );

    if (!phoneIndex) {
      console.log('ℹ️ No unique index on phone found — nothing to do.');
    } else {
      await collection.dropIndex(phoneIndex.name);
      console.log(`✅ Dropped unique index "${phoneIndex.name}" on users.phone`);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
