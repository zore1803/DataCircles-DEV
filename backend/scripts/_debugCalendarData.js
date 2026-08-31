// scripts/_debugCalendarData.js — throwaway, read-only inspection script.
// Dumps the EXACT projection + history shape the frontend Billing Calendar
// consumes for one org, by calling the real backend functions directly —
// sidesteps needing a live login session.
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Subscription = require('../models/Subscription');
const BillingEvent = require('../models/BillingEvent');
const { buildBillingProjection } = require('../utils/billingProjection');

const ORG_ID = '6a7d76a6cde6b1a3863e015f';
const TIMELINE_EXCLUDED_EVENT_TYPES = ['REFERRAL_REWARD_RESERVED', 'REFERRAL_REWARD_RELEASED'];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const subscription = await Subscription.findOne({ organization: ORG_ID });
  if (!subscription) throw new Error('No subscription found for org ' + ORG_ID);

  const projection = await buildBillingProjection(subscription);
  console.log('=== PROJECTION ===');
  console.log(JSON.stringify(projection, null, 2));

  const events = await BillingEvent.find({ organization: ORG_ID, eventType: { $nin: TIMELINE_EXCLUDED_EVENT_TYPES } })
    .sort({ occurredAt: -1 })
    .limit(1000);
  console.log('=== HISTORY (' + events.length + ' events) ===');
  console.log(JSON.stringify(events, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
