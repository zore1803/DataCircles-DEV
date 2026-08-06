/*
 * Backfills features.modules.forms into every PlanConfig.
 *
 * Forms was added as a first-class plan-gated module (routes/formRoutes.js ->
 * restrictByPlan("forms", ...)) and is present in the PlanConfig schema
 * default, but existing plan documents predate it. restrictByPlan denies with
 * MODULE_NOT_AVAILABLE when the module key is absent, so Forms was locked on
 * every plan — including business.
 *
 * The numeric allowance comes from the legacy top-level `websiteForms` field,
 * which the schema notes this module supersedes; business follows the other
 * modules and is unlimited.
 *
 * Idempotent: plans that already carry modules.forms are left untouched.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: path.join(__dirname, '../.env') });

const PlanConfig = require('../models/PlanConfig');

const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const plans = await PlanConfig.find({});
  let changed = 0;

  for (const plan of plans) {
    const modules = plan.features?.modules || {};
    if (modules.forms) {
      console.log(`  [${plan.planId}] already has forms: ${JSON.stringify(modules.forms)} — skipped`);
      continue;
    }
    // Unlimited plans express it as the string "unlimited" (see other modules).
    const limit =
      plan.planId === 'business' ? 'unlimited' : (plan.features?.websiteForms ?? 1);
    const forms = { read: true, write: true, limit };

    console.log(`  [${plan.planId}] + modules.forms = ${JSON.stringify(forms)}`);
    if (APPLY) {
      // features is a free-form Object, so mark it modified explicitly or
      // mongoose won't persist the nested change.
      plan.features.modules = { ...modules, forms };
      plan.markModified('features');
      await plan.save();
    }
    changed++;
  }

  console.log(APPLY ? `\nApplied to ${changed} plan(s).` : `\nDRY RUN — ${changed} plan(s) would change. Re-run with --apply.`);
  await mongoose.disconnect();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
