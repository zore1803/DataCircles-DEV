const mongoose = require('mongoose');
const dotenv = require('dotenv');
const ContactFields = require('../models/ContactFields');
const CompanyFields = require('../models/CompanyFields');
const DealFields = require('../models/DealFields');
const VendorFields = require('../models/VendorFields');

dotenv.config();

async function migrateCustomFields() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    const models = [
      { name: 'ContactFields', model: ContactFields },
      { name: 'CompanyFields', model: CompanyFields },
      { name: 'DealFields', model: DealFields },
      { name: 'VendorFields', model: VendorFields },
    ];

    for (const { name, model } of models) {
      console.log(`\n🔄 Migrating ${name}...`);
      const docs = await model.find({});
      let updatedCount = 0;

      for (const doc of docs) {
        let needsUpdate = false;
        doc.fields = doc.fields.map(field => {
          if (!field.createdBy) {
            needsUpdate = true;
            return {
              ...field.toObject(),
              createdBy: doc.user || doc.organization
            };
          }
          return field;
        });

        if (needsUpdate) {
          await doc.save();
          updatedCount++;
        }
      }
      console.log(`✅ ${name}: Updated ${updatedCount}/${docs.length} documents`);
    }

    console.log("\n✅ Migration completed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  }
}

migrateCustomFields();
