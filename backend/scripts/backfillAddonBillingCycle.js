// scripts/backfillAddonBillingCycle.js
//
// Phase 2a.2 (docs/audit/PHASE2_ADDON_CYCLE_TRACE.md): normalizes existing
// persisted add-on entries to carry a billingCycle, now that the Phase 2a.1
// schema change added the field. Confirmed migration rule (see
// docs/audit/PHASE2_ADDON_CYCLE_TRACE.md's invariant trace, question 7 +
// "migration default" section): every existing subscription is single-cycle
// only — no dual-cycle addon entries exist yet — so each entry's billingCycle
// is unambiguously the parent Subscription's own billingCycle at the moment
// of migration.
//
// Additive only: does not touch pricing, quantities, entitlement, or any
// read path — nothing reads activeAddons.billingCycle yet (that's Phase 2b).
// Idempotent: only fills entries where billingCycle is currently unset; safe
// to re-run.
//
// Run with:
//   node scripts/backfillAddonBillingCycle.js --dry-run   (report only, no writes)
//   CONFIRM_TEST_DB=yes node scripts/backfillAddonBillingCycle.js            (test DB)
//   CONFIRM_PROD_WRITE=yes node scripts/backfillAddonBillingCycle.js         (real writes)

const mongoose = require('mongoose');
require('dotenv').config();

const Subscription = require('../models/Subscription');

const DRY_RUN = process.argv.includes('--dry-run');
const ADDON_ARRAY_FIELDS = [
  'activeAddons',
  'pendingUpdate.carriedAddons',
  'pendingUpdate.removedAddons',
  'pendingUpdate.reducedAddonDeltas',
  'pendingUpgrade.activeAddons',
  'pendingUpgrade.droppedAddons',
  'pendingPlanChange.compatibleAddons',
  'pendingPlanChange.reducedAddons',
  'pendingPlanChange.incompatibleAddons',
  'pendingPlanChange.newAddonPurchases',
  'pendingAddonRemovals',
];

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

async function main() {
  if (!DRY_RUN && process.env.CONFIRM_TEST_DB !== 'yes' && process.env.CONFIRM_PROD_WRITE !== 'yes') {
    console.error(
      'Refusing to write: pass --dry-run to preview, or set CONFIRM_TEST_DB=yes ' +
      '(disposable/test database) or CONFIRM_PROD_WRITE=yes (real writes) explicitly.'
    );
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected. Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'WRITE'}\n`);

  const subs = await Subscription.find({});
  let subsTouched = 0;
  let entriesFilled = 0;
  let pendingAddonAdditionFilled = 0;

  for (const sub of subs) {
    let changed = false;
    const cycle = sub.billingCycle;

    for (const fieldPath of ADDON_ARRAY_FIELDS) {
      const arr = getPath(sub, fieldPath);
      if (!Array.isArray(arr)) continue;
      for (const entry of arr) {
        if (entry && entry.billingCycle == null) {
          entry.billingCycle = cycle;
          entriesFilled++;
          changed = true;
        }
      }
    }

    // pendingAddonAddition is a single embedded object, not an array.
    if (
      sub.pendingAddonAddition &&
      sub.pendingAddonAddition.addonKey &&
      sub.pendingAddonAddition.billingCycle == null
    ) {
      sub.pendingAddonAddition.billingCycle = cycle;
      pendingAddonAdditionFilled++;
      changed = true;
    }

    if (changed) {
      subsTouched++;
      if (!DRY_RUN) await sub.save();
    }
  }

  console.log(`Subscriptions scanned: ${subs.length}`);
  console.log(`Subscriptions touched: ${subsTouched}`);
  console.log(`Array entries backfilled: ${entriesFilled}`);
  console.log(`pendingAddonAddition backfilled: ${pendingAddonAdditionFilled}`);
  if (DRY_RUN) console.log('\nDry run — no writes performed.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
