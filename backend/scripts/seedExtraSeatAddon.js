const mongoose = require('mongoose');
const dotenv = require('dotenv');
const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    const plans = await PlanConfig.find({ isActive: true, 'features.extraSeatPrice.monthly': { $gt: 0 } });

    if (plans.length === 0) {
      console.warn('⚠️  No plans have features.extraSeatPrice set. Nothing to seed — set a price manually or via Plan Management before running this.');
      process.exit(0);
    }

    const existing = await PlanAddon.findOne({ key: 'extra_seat' });
    if (existing) {
      console.log('Already exists — skipping. Edit the price via the new Add-on Management UI instead.');
      process.exit(0);
    }

    const firstPlan = plans[0];
    await PlanAddon.create({
      key: 'extra_seat',
      displayName: 'Extra Seat',
      description: 'Add an additional user seat to your plan.',
      pricingType: 'quantity',
      effectType: 'limit_boost',
      targetKey: 'seats',
      incrementPerUnit: 1,
      price: {
        monthly: firstPlan.features.extraSeatPrice.monthly,
        yearly: firstPlan.features.extraSeatPrice.yearly || firstPlan.features.extraSeatPrice.monthly * 12,
      },
      availableOnPlans: [],
      isActive: true,
      sortOrder: 0,
    });
    console.log(`✅ Created shared PlanAddon "extra_seat" (₹${firstPlan.features.extraSeatPrice.monthly}/mo, available on all plans)`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  }
}

run();
