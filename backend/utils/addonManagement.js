const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const PlanAddon = require('../models/PlanAddon');
const RazorpayPriceCache = require('../models/RazorpayPriceCache');
const User = require('../models/User');
const Invited = require('../models/Invited');
const razorpay = require('../config/razorpay');
const { buildPricingSnapshot } = require('./pricingEngine');

function calculateTotalPrice(plan, billingCycle, activeAddons = []) {
  return buildPricingSnapshot({ plan, billingCycle, activeAddons }).totalAmount;
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
      compatible.push({
        addonKey: addon.addonKey,
        quantity: addon.quantity,
        pricePerUnit: addon.pricePerUnit,
        addedAt: addon.addedAt || new Date(),
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
      const price = equivalent.price?.[billingCycle] ?? addon.pricePerUnit;
      compatible.push({
        addonKey: equivalent.key,        // remap to the target plan's key
        quantity: addon.quantity,
        pricePerUnit: price,             // target plan's price for this add-on
        addedAt: addon.addedAt || new Date(),
        remappedFrom: addon.addonKey,    // provenance (informational)
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

  const includedSeats = plan.features?.includedSeats ?? 1;

  const activeAddons = subscription.activeAddons || [];
  const catalogEntries = await getActiveCatalogEntries(activeAddons);

  const extraSeatsOwned = calculateAddonBoost(activeAddons, catalogEntries, 'seats');

  const totalSeats = includedSeats + extraSeatsOwned;

  const activeUsersCount = await User.countDocuments({ organization: organizationId });
  const pendingInvitesCount = await Invited.countDocuments({ organization: organizationId });
  const occupiedSeats = activeUsersCount + pendingInvitesCount;

  return {
    includedSeats,
    extraSeatsOwned,
    totalSeats,
    occupiedSeats,
    hasFreeSeat: occupiedSeats < totalSeats,
    plan,
    subscription,
  };
}

/**
 * Calculates the prorated charge (in rupees) for adding addon units mid-cycle.
 * Pure calculation — does NOT call Razorpay or mutate anything.
 */
function calculateAddonProration(quantity, pricePerUnit, currentPeriodStart, currentPeriodEnd) {
  const now = new Date();
  const periodStart = new Date(currentPeriodStart);
  const periodEnd = new Date(currentPeriodEnd);
  const totalPeriodMs = periodEnd - periodStart;
  const remainingMs = periodEnd - now;
  if (remainingMs <= 0) return 1; // period already ended — charge minimum
  const prorationFactor = remainingMs / totalPeriodMs;
  const fullCycleCharge = quantity * pricePerUnit;
  return Math.max(1, Math.round(fullCycleCharge * prorationFactor));
}

/**
 * Calculates the prorated charge for the BASE PRICE DIFFERENCE when
 * upgrading plans mid-cycle. Only the difference between new and old
 * base price is prorated (add-ons are separate and untouched).
 * Returns rupees (not paise). Minimum ₹1.
 */
function calculatePlanUpgradeProration(oldBasePrice, newBasePrice, currentPeriodStart, currentPeriodEnd) {
  const now = new Date();
  const periodStart = new Date(currentPeriodStart);
  const periodEnd = new Date(currentPeriodEnd);

  const totalMs = periodEnd - periodStart;
  const remainingMs = periodEnd - now;
  if (remainingMs <= 0 || totalMs <= 0) return Math.max(1, newBasePrice - oldBasePrice);

  const factor = remainingMs / totalMs;
  const diff = (newBasePrice - oldBasePrice) * factor;
  return Math.max(1, Math.round(diff));
}

/**
 * Schedules an add-on removal for end of current billing cycle.
 * Does NOT call Razorpay. Does NOT immediately change activeAddons.
 */
async function scheduleAddonRemoval(organizationId, addonKey, quantity) {
  const subscription = await Subscription.findOne({ organization: organizationId });
  if (!subscription) throw new Error('No subscription found');
  if (!subscription.isPaymentConfirmed) throw new Error('No active paid subscription');

  const existingAddon = (subscription.activeAddons || []).find((a) => a.addonKey === addonKey);
  if (!existingAddon) throw new Error(`Organization does not have the "${addonKey}" add-on`);
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

  const existingPendingIdx = pendingRemovals.findIndex((r) => r.addonKey === addonKey);
  if (existingPendingIdx >= 0) {
    pendingRemovals[existingPendingIdx].quantity += quantity;
  } else {
    pendingRemovals.push({
      addonKey,
      displayName: catalogEntry?.displayName || addonKey,
      quantity,
      pricePerUnit: existingAddon.pricePerUnit,
      scheduledAt: new Date(),
      effectiveAt: subscription.currentPeriodEnd,
    });
  }

  subscription.pendingAddonRemovals = pendingRemovals;
  await subscription.save();

  return {
    subscription,
    effectiveAt: subscription.currentPeriodEnd,
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
  }));

  for (const removal of subscription.pendingAddonRemovals) {
    const idx = activeAddons.findIndex((a) => a.addonKey === removal.addonKey);
    if (idx === -1) continue;
    const newQty = activeAddons[idx].quantity - removal.quantity;
    if (newQty <= 0) {
      activeAddons.splice(idx, 1);
    } else {
      activeAddons[idx] = { ...activeAddons[idx], quantity: newQty };
    }
  }

  const newTotal = calculateTotalPrice(plan, subscription.billingCycle, activeAddons);
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
  subscription.pendingAddonRemovals = [];
  await subscription.save();

  return true;
}

module.exports = {
  calculateTotalPrice,
  findOrCreateRazorpayPlan,
  calculateAddonBoost,
  getActiveCatalogEntries,
  classifyAddonsForPlanChange,
  calculateAddonProration,
  calculatePlanUpgradeProration,
  scheduleAddonRemoval,
  applyScheduledAddonRemovals,
  orgHasAddon,
  getAvailableAddonsForOrg,
  getSeatStatus,
};
