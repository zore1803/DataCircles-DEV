// scripts/migrateSettingsToPerOrg.js
// ONE-TIME migration. Run AFTER deploying the updated models but BEFORE
// relying on per-org behavior.
//
// Run with:  node scripts/migrateSettingsToPerOrg.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Organization = require('../models/Organization');
const KanbanName = require('../models/KanbanName');
const DealSettings = require('../models/dealSettings.model');

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    const legacyKanbanName = await KanbanName.findOne({
      organization: { $exists: false },
    });
    const legacyDealSettings = await DealSettings.findOne({
      organization: { $exists: false },
    });

    const defaultKanbanName = legacyKanbanName?.name || 'Deal';
    const defaultStaleDays = legacyDealSettings?.staleDays ?? 0;

    console.log(`Legacy KanbanName value found: "${defaultKanbanName}"`);
    console.log(`Legacy DealSettings staleDays found: ${defaultStaleDays}`);

    const organizations = await Organization.find({});
    console.log(`Found ${organizations.length} organizations to process.`);

    let kanbanCreated = 0, kanbanSkipped = 0;
    let dealSettingsCreated = 0, dealSettingsSkipped = 0;

    for (const org of organizations) {
      const existingKanban = await KanbanName.findOne({ organization: org._id });
      if (existingKanban) {
        kanbanSkipped++;
      } else {
        await KanbanName.create({ organization: org._id, name: defaultKanbanName });
        kanbanCreated++;
      }

      const existingDealSettings = await DealSettings.findOne({ organization: org._id });
      if (existingDealSettings) {
        dealSettingsSkipped++;
      } else {
        await DealSettings.create({ organization: org._id, staleDays: defaultStaleDays });
        dealSettingsCreated++;
      }
    }

    console.log('\n--- Migration summary ---');
    console.log(`KanbanName:    ${kanbanCreated} created, ${kanbanSkipped} already existed`);
    console.log(`DealSettings:  ${dealSettingsCreated} created, ${dealSettingsSkipped} already existed`);
    console.log('\n✅ Migration complete.');
    console.log('To clean up orphaned global documents, run in mongosh:');
    console.log('  db.kanbannames.deleteMany({ organization: { $exists: false } })');
    console.log('  db.dealsettings.deleteMany({ organization: { $exists: false } })');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err.message || err);
    process.exit(1);
  }
}

run();
