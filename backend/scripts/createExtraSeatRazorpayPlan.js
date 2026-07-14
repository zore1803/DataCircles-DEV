// scripts/createExtraSeatRazorpayPlan.js
// Run ONCE per tier after setting extraSeatPrice values via the Plan Management UI.
// Creates monthly + yearly Razorpay Plans for extra seats and saves the IDs back to PlanConfig.

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Razorpay = require('razorpay');
const PlanConfig = require('../models/PlanConfig');

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function createRazorpayPlan(name, interval, amount) {
  const plan = await razorpay.plans.create({
    period: interval === 'monthly' ? 'monthly' : 'yearly',
    interval: 1,
    item: {
      name,
      amount,
      currency: 'INR',
    },
  });
  return plan.id;
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    const plans = await PlanConfig.find({ isActive: true });

    const eligiblePlans = plans.filter(
      (p) => p.features && p.features.extraSeatPrice && p.features.extraSeatPrice.monthly > 0
    );

    if (eligiblePlans.length === 0) {
      console.warn(
        '⚠️  No plans have a non-zero extraSeatPrice.monthly.\n' +
        '   Set prices via the Plan Management UI first, then re-run this script.'
      );
      process.exit(0);
    }

    for (const plan of eligiblePlans) {
      const monthlyAmountPaise = Math.round(plan.features.extraSeatPrice.monthly * 100);
      const yearlyAmountPaise = Math.round((plan.features.extraSeatPrice.yearly || 0) * 100);

      console.log(`\nCreating extra-seat Razorpay plans for: ${plan.planId}`);
      console.log(`  Monthly: ₹${plan.features.extraSeatPrice.monthly} (${monthlyAmountPaise} paise)`);
      console.log(`  Yearly:  ₹${plan.features.extraSeatPrice.yearly || 0} (${yearlyAmountPaise} paise)`);

      const monthlyId = await createRazorpayPlan(
        `Extra Seat - ${plan.planId} - Monthly`,
        'monthly',
        monthlyAmountPaise,
      );
      console.log(`  Monthly plan ID: ${monthlyId}`);

      const yearlyId = yearlyAmountPaise > 0
        ? await createRazorpayPlan(
            `Extra Seat - ${plan.planId} - Yearly`,
            'yearly',
            yearlyAmountPaise,
          )
        : null;
      if (yearlyId) {
        console.log(`  Yearly plan ID:  ${yearlyId}`);
      } else {
        console.warn(`  ⚠️  Yearly price is 0 — skipped yearly plan for "${plan.planId}"`);
      }

      const updateFields = {
        'features.extraSeatRazorpayPlanIds.monthly': monthlyId,
      };
      if (yearlyId) {
        updateFields['features.extraSeatRazorpayPlanIds.yearly'] = yearlyId;
      }

      const updated = await PlanConfig.findOneAndUpdate(
        { planId: plan.planId },
        { $set: updateFields },
        { new: true },
      );

      if (updated) {
        console.log(`  ✅ PlanConfig updated for "${plan.planId}"`);
      } else {
        console.warn(`  ⚠️  PlanConfig not found for "${plan.planId}"`);
      }
    }

    console.log('\n✅ Extra-seat Razorpay plans created and PlanConfig updated.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  }
}

run();
