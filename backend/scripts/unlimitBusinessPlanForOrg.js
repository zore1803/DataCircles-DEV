/*
 * Puts one organization on the `business` plan and removes every usage cap
 * that plan enforces.
 *
 * Two kinds of limit exist and they are NOT interchangeable:
 *
 *   - features.modules.<name>.limit — restrictByPlan compares this against
 *     the string 'unlimited' (see "moduleLimit !== 'unlimited'"), so the
 *     sentinel is correct there and skips the count query entirely.
 *
 *   - the top-level numeric caps (customFields, fileStorage, ...) — these are
 *     compared arithmetically by customFieldRestriction.js and the storage
 *     accounting in restrictByPlan.js. Putting 'unlimited' there would turn
 *     every comparison into NaN, which happens to pass today but is a
 *     landmine. They get a very large number instead.
 *
 * Idempotent, and safe to re-run.
 *
 *   node scripts/unlimitBusinessPlanForOrg.js            # dry run
 *   node scripts/unlimitBusinessPlanForOrg.js --apply
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: path.join(__dirname, '../.env') });

const PlanConfig = require('../models/PlanConfig');
const Subscription = require('../models/Subscription');
const User = require('../models/User');

const TARGET_EMAIL =
  process.argv.find((a) => a.includes('@')) || 'yash.mishra@datacircles.in';
const APPLY = process.argv.includes('--apply');

const BIG = 1000000000; // numeric caps: effectively unlimited
const BIG_STORAGE = 1099511627776; // 1 TB

// Every module referenced by restrictByPlan across the route files.
const MODULES = [
  'contacts',
  'companies',
  'deals',
  'vendors',
  'invoices',
  'tasks',
  'callLogs',
  'meetings',
  'quotations',
  'delivery-challans',
  'purchases',
  'emails',
  'folders',
  'forms',
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne({ email: TARGET_EMAIL }).lean();
  if (!user) throw new Error(`No user ${TARGET_EMAIL}`);

  const plan = await PlanConfig.findOne({ planId: 'business' });
  if (!plan) throw new Error('No business PlanConfig');

  const f = plan.features || {};
  const modules = { ...(f.modules || {}) };
  for (const name of MODULES) {
    // folders has no organization field to count against, so it carries no
    // limit — read/write toggles only.
    modules[name] =
      name === 'folders'
        ? { read: true, write: true }
        : { read: true, write: true, limit: 'unlimited' };
  }

  const nextFeatures = {
    ...f,
    modules,
    emailTemplates: BIG,
    salesPipelines: BIG,
    customFields: BIG,
    recordTags: BIG,
    websiteForms: BIG,
    fileStorage: BIG_STORAGE,
    rottenDeals: true,
    advancedReports: true,
  };

  console.log('PLAN business ->');
  console.log('  modules :', MODULES.join(', '));
  console.log('            = read + write, limit "unlimited"');
  console.log('  numeric : emailTemplates/salesPipelines/customFields/recordTags/websiteForms =', BIG);
  console.log('  storage :', BIG_STORAGE, 'bytes (1 TB)');
  console.log('  flags   : rottenDeals=true advancedReports=true');

  const sub = await Subscription.findOne({ organization: user.organization });
  if (!sub) throw new Error('No subscription for that organization');
  console.log(
    `\nSUBSCRIPTION ${TARGET_EMAIL}\n  planName : ${sub.planName} => business\n  appStatus: ${sub.appStatus} => active`
  );
  // razorpayPlanId is deliberately left alone: this is a comped record
  // (plan_trial, price 0, period end 2099) and rewriting it with a live
  // Razorpay plan id would imply a billing relationship that doesn't exist.

  if (APPLY) {
    plan.features = nextFeatures;
    plan.markModified('features'); // features is a free-form Object
    plan.isActive = true;
    await plan.save();

    sub.planName = 'business';
    sub.appStatus = 'active';
    await sub.save();
    console.log('\nApplied.');
  } else {
    console.log('\nDRY RUN — re-run with --apply');
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
