const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');
const RazorpayPriceCache = require('../models/RazorpayPriceCache');
const User = require('../models/User');
const Invited = require('../models/Invited');
const razorpay = require('../config/razorpay');
const ScheduledChange = require('../models/ScheduledChange');
const { calculateInvoice } = require('./invoiceEngine');

// Phase 7 cleanup: calculateTotalPrice() removed here — confirmed zero
// remaining callers (its only caller, applyScheduledAddonRemovals below,
// was migrated onto calculateInvoice() directly in Phase 3 item 5c).

// Phase 2b (docs/audit/PHASE2_ADDON_CYCLE_TRACE.md): shared identity-key
// helper for the Map/Object-keyed addon lookups that used to key on
// `addonKey` alone (silently collapsing two cycle-variants of the same key
// onto one entry). `fallbackCycle` (the subscription's own billingCycle) is
// used when `addon.billingCycle` is absent — which is every addon-shaped
// object today except real `activeAddons` entries backfilled in Phase 2a.2,
// since no write path sets it on carry-forward/classification objects yet
// (that's Phase 2c). Falling back this way keeps every current single-cycle
// subscription's lookups matching exactly as before: both sides of any
// comparison resolve to the same `${addonKey}::${subscription.billingCycle}`
// key until a real second cycle-variant can actually be created.
function addonIdentityKey(addon, fallbackCycle) {
  return `${addon.remappedFrom || addon.addonKey}::${addon.billingCycle || fallbackCycle || ''}`;
}

function getAddonRemovalEffectiveAt(existingAddon, subscription) {
  if (existingAddon?.periodEnd) {
    return new Date(existingAddon.periodEnd);
  }

  const addedAt = existingAddon?.addedAt ? new Date(existingAddon.addedAt) : new Date();
  const billingCycle = existingAddon?.billingCycle || subscription?.billingCycle || 'monthly';

  if (billingCycle === 'yearly') {
    const periodEnd = new Date(addedAt);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    return periodEnd;
  }

  const monthlyPeriodEnd = new Date(addedAt);
  monthlyPeriodEnd.setMonth(monthlyPeriodEnd.getMonth() + 1);
  return monthlyPeriodEnd;
}

async function findOrCreateRazorpayPlan(amountRupees, billingCycle, planNameForLabel) {
  const amountPaise = Math.round(amountRupees * 1.18 * 100); // GST-inclusive
  const cached = await RazorpayPriceCache.findOne({ amountPaise, billingCycle });
  if (cached) return cached.razorpayPlanId;

  const razorpayPlan = await razorpay.plans.create({
    period: billingCycle === 'monthly' ? 'monthly' : 'yearly',
    interval: 1,
    item: {
      name: `${planNameForLabel} (Rs.${Math.round(amountRupees * 1.18)}/${billingCycle === 'monthly' ? 'mo' : 'yr'} incl. GST)`,
      amount: amountPaise,
      currency: 'INR',
    },
  });

  await RazorpayPriceCache.create({ amountPaise, billingCycle, razorpayPlanId: razorpayPlan.id });
  return razorpayPlan.id;
}

// Returns the total numeric boost contributed by active add-ons for a given targetKey.
// Only counts entries with effectType === 'limit_boost' whose targetKey matches.
function calculateAddonBoost(activeAddons, catalogEntries, targetKey) {
  return activeAddons.reduce((boost, addon) => {
    const entry = catalogEntries.find((c) => c.key === addon.addonKey);
    if (!entry || entry.effectType !== 'limit_boost' || entry.targetKey !== targetKey) return boost;
    const increment =
      entry.pricingType === 'boolean' ? entry.incrementPerUnit : addon.quantity * entry.incrementPerUnit;
    return boost + increment;
  }, 0);
}

// Fetches PlanAddon catalog documents for all addon keys present in activeAddons.
async function getActiveCatalogEntries(activeAddons) {
  const keys = activeAddons.map((a) => a.addonKey);
  if (keys.length === 0) return [];
  return PlanAddon.find({ key: { $in: keys } });
}

// Classifies an org's activeAddons as compatible/incompatible with a target plan.
//
// An add-on is "compatible" if either:
//   1. its own key is available on the target plan (availableOnPlans empty, or
//      includes targetPlanId), OR
//   2. the target plan offers an EQUIVALENT add-on — one with the same
//      effectType and the same (non-null) targetKey. In that case the add-on is
//      carried forward but REMAPPED to the target plan's add-on key/price, so a
//      seat boost keeps working across plans that name the add-on differently
//      (e.g. Starter `extra_seat` -> Growth `seat`, both targetKey "seats").
//
// Otherwise it's "incompatible" (scheduled for removal at cycle end).
// Compatible entries returned as { addonKey, quantity, pricePerUnit, addedAt,
// remappedFrom? }. Returns { compatible, incompatible, newAddonsTotal }.
async function classifyAddonsForPlanChange(activeAddons, targetPlanId, billingCycle) {
  if (!activeAddons || activeAddons.length === 0) {
    return { compatible: [], incompatible: [], newAddonsTotal: 0 };
  }
  const keys = activeAddons.map((a) => a.addonKey);
  const catalogEntries = await PlanAddon.find({ key: { $in: keys } });

  // All add-ons offered on the target plan — used to find equivalents by effect.
  const targetCatalog = await PlanAddon.find({
    isActive: true,
    $or: [{ availableOnPlans: { $size: 0 } }, { availableOnPlans: targetPlanId }],
  });

  const plain = (addon) => (addon.toObject ? addon.toObject() : { ...addon });
  const compatible = [];
  const incompatible = [];

  for (const addon of activeAddons) {
    const entry = catalogEntries.find((e) => e.key === addon.addonKey);
    if (!entry) {
      incompatible.push({ ...plain(addon), reason: 'no_longer_exists' });
      continue;
    }

    const availableOnTarget =
      entry.availableOnPlans.length === 0 || entry.availableOnPlans.includes(targetPlanId);
    if (availableOnTarget) {
      // Same key works on the target plan — carry forward untouched.
      // Live-QA correctness fix (Aug 2026): billingCycle/periodEnd were
      // never preserved here — every plan upgrade/downgrade silently
      // stripped them, leaving the addon to fall back to whatever the
      // SUBSCRIPTION's cycle happens to be at every later read
      // (addonIdentityKey/getAddonRemovalEffectiveAt's documented
      // fallback). Confirmed as the real mechanism behind a live-reported
      // incident: an upgrade dropped billingCycle, which then displayed as
      // "Annual" (with no actual annual purchase) the moment the base plan
      // later switched to yearly — same class of bug Task 1 already fixed
      // at three OTHER creation sites, recurring here via this one.
      compatible.push({
        addonKey: addon.addonKey,
        quantity: addon.quantity,
        pricePerUnit: addon.pricePerUnit,
        addedAt: addon.addedAt || new Date(),
        billingCycle: addon.billingCycle,
        periodEnd: addon.periodEnd,
      });
      continue;
    }

    // Not available under its own key — look for an equivalent on the target plan
    // (same mechanical effect + same target). Only for add-ons with a targetKey.
    const equivalent = entry.targetKey
      ? targetCatalog.find(
          (t) =>
            t.key !== entry.key &&
            t.effectType === entry.effectType &&
            t.targetKey === entry.targetKey
        )
      : null;

    if (equivalent) {
      // Price against the addon's OWN cycle, not blindly the target
      // subscription's overall cycle param — the two can differ once
      // monthly/annual add-ons coexist (Phase 2c).
      const resolvedCycle = addon.billingCycle || billingCycle;
      const price = equivalent.price?.[resolvedCycle] ?? addon.pricePerUnit;
      compatible.push({
        addonKey: equivalent.key,        // remap to the target plan's key
        quantity: addon.quantity,
        pricePerUnit: price,             // target plan's price for this add-on
        addedAt: addon.addedAt || new Date(),
        remappedFrom: addon.addonKey,    // provenance (informational)
        billingCycle: addon.billingCycle,
        periodEnd: addon.periodEnd,
      });
    } else {
      incompatible.push({
        ...plain(addon),
        displayName: entry.displayName,
        reason: 'not_available_on_plan',
      });
    }
  }

  const newAddonsTotal = compatible.reduce((sum, a) => sum + a.quantity * a.pricePerUnit, 0);
  return { compatible, incompatible, newAddonsTotal };
}

// Returns true if the org has purchased the given addon (quantity > 0).
async function orgHasAddon(organizationId, addonKey) {
  const subscription = await Subscription.findOne({ organization: organizationId }).select('activeAddons');
  if (!subscription) return false;
  const entry = (subscription.activeAddons || []).find((a) => a.addonKey === addonKey && a.quantity > 0);
  return !!entry;
}

async function getAvailableAddonsForOrg(organizationId) {
  const subscription = await Subscription.findOne({ organization: organizationId });
  if (!subscription) throw new Error('No subscription found for this organization');

  const plan = await PlanConfig.findOne({ planId: subscription.planName, isActive: true });
  if (!plan) throw new Error(`Plan config not found for "${subscription.planName}"`);

  const catalog = await PlanAddon.find({
    isActive: true,
    $or: [{ availableOnPlans: { $size: 0 } }, { availableOnPlans: plan.planId }],
  }).sort({ sortOrder: 1 });

  const activeAddons = subscription.activeAddons || [];

  return catalog.map((addon) => {
    const owned = activeAddons.find((a) => a.addonKey === addon.key);
    return {
      key: addon.key,
      displayName: addon.displayName,
      description: addon.description,
      pricingType: addon.pricingType,
      effectType: addon.effectType,
      targetKey: addon.targetKey,
      price: addon.price,
      maxQuantityPerOrg: addon.maxQuantityPerOrg,
      quantityOwned: owned ? owned.quantity : 0,
    };
  });
}

async function getSeatStatus(organizationId) {
  const subscription = await Subscription.findOne({ organization: organizationId });
  if (!subscription) throw new Error('No subscription found for this organization');

  const plan = await PlanConfig.findOne({ planId: subscription.planName, isActive: true });
  if (!plan) throw new Error(`Plan config not found for "${subscription.planName}"`);

  // Admin seat: exactly 1, always the org creator — never invited or
  // joined via company code, so it has no addon boost and nothing counts
  // against it but the single admin user.
  const includedSeats = plan.features?.includedSeats ?? 1;
  const occupiedAdminSeats = await User.countDocuments({ organization: organizationId, role: 'admin' });

  // Staff seats: everyone invited or joined via company code. Extra-seat
  // addons extend this bucket, not the admin one.
  const staffSeatsIncluded = plan.features?.staffSeats ?? 0;
  const activeAddons = subscription.activeAddons || [];
  const catalogEntries = await getActiveCatalogEntries(activeAddons);
  const extraSeatsOwned = calculateAddonBoost(activeAddons, catalogEntries, 'seats');
  const totalStaffSeats = staffSeatsIncluded + extraSeatsOwned;
  const occupiedStaffSeats =
    (await User.countDocuments({ organization: organizationId, role: { $ne: 'admin' } })) +
    (await Invited.countDocuments({ organization: organizationId }));

  // Legacy combined view — kept for any caller not yet updated to the
  // admin/staff split.
  const totalSeats = includedSeats + totalStaffSeats;
  const occupiedSeats = occupiedAdminSeats + occupiedStaffSeats;

  return {
    includedSeats,
    occupiedAdminSeats,
    hasFreeAdminSeat: occupiedAdminSeats < includedSeats,
    staffSeatsIncluded,
    extraSeatsOwned,
    totalStaffSeats,
    occupiedStaffSeats,
    hasFreeStaffSeat: occupiedStaffSeats < totalStaffSeats,
    totalSeats,
    occupiedSeats,
    hasFreeSeat: occupiedSeats < totalSeats,
    plan,
    subscription,
  };
}

/**
 * Schedules an add-on removal for end of current billing cycle.
 * Does NOT call Razorpay. Does NOT immediately change activeAddons.
 */
async function scheduleAddonRemoval(organizationId, addonKey, quantity, billingCycle) {
  const subscription = await Subscription.findOne({ organization: organizationId });
  if (!subscription) throw new Error('No subscription found');
  if (!subscription.isPaymentConfirmed) throw new Error('No active paid subscription');

  // Phase 2c: identity is (addonKey, billingCycle). billingCycle defaults to
  // the subscription's own cycle — every current caller omits it, and this
  // fallback keeps their behavior identical (no route exposes this param yet,
  // that's Phase 2d).
  const resolvedCycle = billingCycle || subscription.billingCycle;
  const existingAddon = (subscription.activeAddons || []).find(
    (a) => addonIdentityKey(a, subscription.billingCycle) === addonIdentityKey({ addonKey, billingCycle: resolvedCycle }, subscription.billingCycle)
  );
  if (!existingAddon) throw new Error(`Organization does not have the "${addonKey}" add-on on the ${resolvedCycle} billing cycle`);
  if (quantity > existingAddon.quantity) {
    throw new Error(`Cannot remove ${quantity} units — only ${existingAddon.quantity} owned`);
  }

  if (addonKey === 'extra_seat') {
    const seatStatus = await getSeatStatus(organizationId);
    const seatsAfterRemoval = seatStatus.totalSeats - quantity;
    if (seatStatus.occupiedSeats > seatsAfterRemoval) {
      throw new Error(
        `Cannot remove ${quantity} seat(s) — you currently have ${seatStatus.occupiedSeats} active users ` +
        `but would only have ${seatsAfterRemoval} seats after removal. Remove users first.`
      );
    }
  }

  const catalogEntry = await PlanAddon.findOne({ key: addonKey });
  const pendingRemovals = subscription.pendingAddonRemovals || [];

  // No refund, no immediate removal (business contract, confirmed): the
  // instance stays active until the end of its OWN paid period. Annual
  // add-ons use their own periodEnd; monthly add-ons now derive their own
  // monthly cadence from addedAt, independent of the base plan's own cycle.
  const effectiveAt = getAddonRemovalEffectiveAt(existingAddon, subscription);

  const existingPendingIdx = pendingRemovals.findIndex(
    (r) => addonIdentityKey(r, subscription.billingCycle) === addonIdentityKey({ addonKey, billingCycle: resolvedCycle }, subscription.billingCycle)
  );
  if (existingPendingIdx >= 0) {
    pendingRemovals[existingPendingIdx].quantity += quantity;
  } else {
    pendingRemovals.push({
      addonKey,
      displayName: catalogEntry?.displayName || addonKey,
      quantity,
      pricePerUnit: existingAddon.pricePerUnit,
      scheduledAt: new Date(),
      effectiveAt,
      billingCycle: resolvedCycle,
    });
  }

  subscription.pendingAddonRemovals = pendingRemovals;
  await subscription.save();

  // ScheduledChange — additive write-alongside. Unlike downgrade/cancellation's
  // cancel-prior-then-create, pendingAddonRemovals MERGES quantity on a repeat
  // request for the same add-on (line 236 above) rather than overwriting — so a
  // repeat request here must increment the existing PENDING record's quantity,
  // not cancel it and create a second one (that would violate "exactly one
  // ScheduledChange per subscription+type+target"). Nothing reads this back yet.
  //
  // Phase 2c: match/create on (addonKey, billingCycle). The `$or` fallback on
  // the query keeps this compatible with any PENDING record created before
  // this change (payload had no billingCycle field at all) — those legacy
  // records implicitly meant "the subscription's own cycle," which is
  // exactly what resolvedCycle defaults to for every existing caller.
  try {
    const cycleMatch = resolvedCycle === subscription.billingCycle
      ? { $or: [{ 'payload.billingCycle': resolvedCycle }, { 'payload.billingCycle': { $exists: false } }] }
      : { 'payload.billingCycle': resolvedCycle };
    const existingPending = await ScheduledChange.findOne({
      organization: subscription.organization,
      subscription: subscription._id,
      type: 'REMOVE_ADDON',
      status: 'PENDING',
      'payload.addonKey': addonKey,
      ...cycleMatch,
    });
    if (existingPending) {
      existingPending.payload = {
        ...existingPending.payload,
        quantity: (existingPending.payload.quantity || 0) + quantity,
        billingCycle: resolvedCycle,
      };
      existingPending.effectiveAt = effectiveAt;
      await existingPending.save();
    } else {
      await ScheduledChange.create({
        organization: subscription.organization,
        subscription: subscription._id,
        type: 'REMOVE_ADDON',
        status: 'PENDING',
        effectiveAt,
        payload: { addonKey, quantity, billingCycle: resolvedCycle },
      });
    }
  } catch (scErr) {
    console.error(
      `ScheduledChange creation failed (non-fatal) — organization=${subscription.organization} subscription=${subscription._id}:`,
      scErr.message
    );
  }

  return {
    subscription,
    effectiveAt,
    displayName: catalogEntry?.displayName || addonKey,
  };
}

/**
 * Applies all scheduled add-on removals for a subscription.
 * Called by handleSubscriptionCharged when a new billing cycle starts.
 * DOES call razorpay.subscriptions.update to lower the recurring amount.
 */
async function applyScheduledAddonRemovals(subscription) {
  if (!subscription.pendingAddonRemovals || subscription.pendingAddonRemovals.length === 0) {
    return false;
  }

  const plan = await PlanConfig.findOne({ planId: subscription.planName, isActive: true });
  if (!plan) throw new Error(`Plan config not found for "${subscription.planName}"`);

  let activeAddons = subscription.activeAddons.map((a) => ({
    addonKey: a.addonKey,
    quantity: a.quantity,
    pricePerUnit: a.pricePerUnit,
    addedAt: a.addedAt,
    billingCycle: a.billingCycle,
    periodEnd: a.periodEnd,
  }));

  // Phase 2c: this function runs on every subscription-cycle rollover
  // (handleSubscriptionCharged), but a removal's own effectiveAt may now be
  // an annual add-on's independent period end, which does NOT necessarily
  // coincide with a (possibly monthly) subscription's renewal. Only removals
  // actually due are applied here; the rest stay pending untouched — a
  // scheduled removal must never execute before its own instance's period
  // ends (business contract, confirmed).
  const now = new Date();
  const dueRemovals = [];
  const stillPending = [];
  for (const removal of subscription.pendingAddonRemovals) {
    if (removal.effectiveAt && removal.effectiveAt > now) {
      stillPending.push(removal);
    } else {
      dueRemovals.push(removal);
    }
  }

  for (const removal of dueRemovals) {
    const idx = activeAddons.findIndex(
      (a) => addonIdentityKey(a, subscription.billingCycle) === addonIdentityKey(removal, subscription.billingCycle)
    );
    if (idx === -1) continue;
    const newQty = activeAddons[idx].quantity - removal.quantity;
    if (newQty <= 0) {
      activeAddons.splice(idx, 1);
    } else {
      activeAddons[idx] = { ...activeAddons[idx], quantity: newQty };
    }
  }

  if (dueRemovals.length === 0) {
    // Nothing to actually apply this rollover (every pending removal targets
    // a later, addon-specific period end) — leave activeAddons/pendingAddonRemovals
    // untouched rather than doing a no-op Razorpay plan sync below.
    return false;
  }

  // Phase 3 item 5c (fourth live buildPricingSnapshot() path, found by a
  // whole-backend grep after the controller-level migrations — this one was
  // reached indirectly via calculateTotalPrice(), not a direct call, which is
  // why the earlier per-file audits missed it). Same shape as the other
  // Category C migration: no coupon/modifiers involved here today.
  const newTotal = calculateInvoice({
    subscription: {
      planName: plan.planId,
      billingCycle: subscription.billingCycle,
      pricePerUser: subscription.billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice,
      activeAddons,
    },
  }).taxable;
  const newPlanId = activeAddons.length > 0
    ? await findOrCreateRazorpayPlan(newTotal, subscription.billingCycle, plan.planId)
    : plan.razorpayPlanIds[subscription.billingCycle];

  await razorpay.subscriptions.update(subscription.razorpaySubscriptionId, {
    plan_id: newPlanId,
    schedule_change_at: 'now',
  });

  subscription.activeAddons = activeAddons;
  subscription.razorpayPlanId = newPlanId;
  subscription.totalAmount = newTotal;
  subscription.pendingAddonRemovals = stillPending;
  await subscription.save();

  return true;
}

module.exports = {
  findOrCreateRazorpayPlan,
  calculateAddonBoost,
  getActiveCatalogEntries,
  classifyAddonsForPlanChange,
  scheduleAddonRemoval,
  applyScheduledAddonRemovals,
  orgHasAddon,
  getAvailableAddonsForOrg,
  getSeatStatus,
  addonIdentityKey,
  getAddonRemovalEffectiveAt,
};
