// utils/subscriptionHelpers.js

// `subscription.pendingUpdate` being a truthy object is not the same as it
// describing a real scheduled downgrade — a stale/partial write (e.g. from an
// aborted request that saved before validating planId/billingCycle) leaves a
// pendingUpdate object with undefined fields, which every "is a downgrade
// scheduled?" check across the UI would otherwise treat as real, disabling
// plan actions and rendering a garbage "Scheduled Change" card (₹NaN, blank
// plan name) for a subscription that isn't actually scheduled to change.
export const hasValidPendingUpdate = (subscription) => {
  const pu = subscription?.pendingUpdate;
  return !!(pu && pu.planName && typeof pu.pricePerUser === "number" && !Number.isNaN(pu.pricePerUser) && pu.billingCycle);
};
