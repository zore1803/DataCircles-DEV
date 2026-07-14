// scripts/addPurchasesEmailsModules.js
//
// One-time migration: adds 'purchases' and 'emails' module keys to every
// live PlanConfig document. Safe to re-run — uses $set so existing values
// are NOT overwritten if they were already added via the Plan Management UI.
//
// Email-send limits per tier (placeholder — tune these in the Plan Management
// UI after running; they are NOT final pricing decisions):
//   trial    → 2 000 sends/month
//   starter  → 500 sends/month
//   test     → 2 000 sends/month (same as trial for QA convenience)
//   growth   → 2 000 sends/month
//   business → unlimited
//
// Purchases: no numeric cap on any tier (same as contacts/companies).

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const PlanConfig = require('../models/PlanConfig');

dotenv.config();

const planModules = {
  trial: {
    purchases: { read: true, write: true },
    emails:    { read: true, write: true, limit: 2000 },
  },
  starter: {
    purchases: { read: true, write: true },
    emails:    { read: true, write: true, limit: 500 },
  },
  test: {
    purchases: { read: true, write: true },
    emails:    { read: true, write: true, limit: 2000 },
  },
  growth: {
    purchases: { read: true, write: true },
    emails:    { read: true, write: true, limit: 2000 },
  },
  business: {
    purchases: { read: true, write: true },
    emails:    { read: true, write: true, limit: 'unlimited' },
  },
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');

  let updated = 0;
  let skipped = 0;

  for (const [planId, modules] of Object.entries(planModules)) {
    const plan = await PlanConfig.findOne({ planId });
    if (!plan) {
      console.warn(`⚠️  Plan '${planId}' not found in DB — skipping`);
      skipped++;
      continue;
    }

    const alreadyHasBoth =
      plan.features?.modules?.purchases !== undefined &&
      plan.features?.modules?.emails !== undefined;

    if (alreadyHasBoth) {
      console.log(`ℹ️  '${planId}' already has both modules — skipping (use Plan Management UI to change values)`);
      skipped++;
      continue;
    }

    await PlanConfig.updateOne(
      { planId },
      {
        $set: {
          'features.modules.purchases': modules.purchases,
          'features.modules.emails':    modules.emails,
        },
      }
    );

    console.log(`✅ '${planId}' — added purchases + emails modules`);
    updated++;
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
