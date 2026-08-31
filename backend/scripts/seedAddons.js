const mongoose = require('mongoose');
const dotenv = require('dotenv');
const PlanAddon = require('../models/PlanAddon');

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    await PlanAddon.deleteMany({});
    console.log('Cleared existing Add-ons');

    const addons = [
      {
        key: 'extra_seat',
        displayName: 'Extra User Seat',
        description: 'Add an additional user seat to your organization.',
        pricingType: 'quantity',
        price: { monthly: 99, yearly: 990 },
        effectType: 'limit_boost',
        targetKey: 'seats',
        incrementPerUnit: 1,
        unlockRead: true,
        unlockWrite: true,
        availableOnPlans: [], // Available on all plans
        isActive: true,
        sortOrder: 1,
      },
      {
        key: 'storage_boost',
        displayName: '10GB Storage Boost',
        description: 'Increase your file storage limit by 10GB.',
        pricingType: 'quantity',
        price: { monthly: 150, yearly: 1500 },
        effectType: 'limit_boost',
        targetKey: 'fileStorage',
        incrementPerUnit: 10 * 1024 * 1024 * 1024,
        unlockRead: true,
        unlockWrite: true,
        availableOnPlans: [],
        isActive: true,
        sortOrder: 2,
      },
      {
        key: 'whatsapp_marketing',
        displayName: 'WhatsApp Marketing',
        description: 'Unlock WhatsApp marketing campaigns and automation.',
        pricingType: 'boolean',
        price: { monthly: 499, yearly: 4990 },
        effectType: 'module_unlock',
        targetKey: 'whatsappMarketing',
        incrementPerUnit: 0,
        unlockRead: true,
        unlockWrite: true,
        availableOnPlans: ['starter', 'growth', 'business'],
        isActive: true,
        sortOrder: 3,
      },
      {
        key: 'premium_support',
        displayName: 'Premium Support',
        description: '24/7 dedicated account manager and priority support.',
        pricingType: 'boolean',
        price: { monthly: 999, yearly: 9990 },
        effectType: 'flag_only',
        targetKey: 'premiumSupport',
        incrementPerUnit: 0,
        unlockRead: true,
        unlockWrite: true,
        availableOnPlans: ['growth', 'business'],
        isActive: true,
        sortOrder: 4,
      }
    ];

    await PlanAddon.insertMany(addons);
    console.log('✅ Created', addons.length, 'Plan Add-ons');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  }
}

run();
