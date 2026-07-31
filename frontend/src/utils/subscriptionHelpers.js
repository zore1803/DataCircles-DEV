// utils/subscriptionHelpers.js
//
// deriveSubscriptionUIState() is the ONE canonical derivation every billing
// component must consume instead of independently branching on raw fields
// (isTrialActive, isPaymentConfirmed, paymentStatus, the legacy status, etc.
// scattered across BillingSidebar/PlanCard/PaymentStatusAlert/BillingDetail —
// see backend/docs/audit/FRONTEND_CONVERGENCE_PLAN.md, "Journey 1"). Per the
// operating manual: the backend is the source of truth; this function is the
// only place that interprets it, so every screen agrees.

export const SUBSCRIPTION_UI_STATES = {
  NONE: "NONE", // no Subscription document exists at all
  TRIAL: "TRIAL",
  PENDING_MANDATE: "PENDING_MANDATE", // CAW Registration Link created, mandate not yet confirmed
  PENDING_PAYMENT: "PENDING_PAYMENT", // legacy (pre-CAW) subscription stuck awaiting payment
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST_DUE",
  SUSPENDED: "SUSPENDED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
};

// Takes the real Subscription document (canonical fields only — appStatus,
// mandateStatus, isTrialActive, isPaymentConfirmed, paymentStatus,
// registrationLinkId) and returns one closed UI state. No component may
// re-derive any of this itself.
//
// The PENDING_MANDATE branch is deliberately checked BEFORE isTrialActive:
// trial cleanup only happens once reconcileMandate actually confirms the
// mandate (Phase 1 fix), so a subscription mid-conversion still has
// isTrialActive:true for a window after Registration Link creation. Without
// this ordering, the UI would show "Free Trial Active" and "Complete
// Payment" simultaneously — the exact contradiction this function exists to
// remove (backend/docs/audit/FRONTEND_CONVERGENCE_PLAN.md).
export const deriveSubscriptionUIState = (subscription) => {
  if (!subscription) return SUBSCRIPTION_UI_STATES.NONE;

  const { appStatus, isTrialActive, mandateStatus, paymentStatus, isPaymentConfirmed } = subscription;

  switch (appStatus) {
    case "active":
      // Defense-in-depth (found during a live-QA correctness audit): ACTIVE
      // must never be trusted from appStatus alone — the backend's own
      // reconcileMandate() only ever sets appStatus:'active' in the same
      // gate that also requires isPaymentConfirmed, so in correct operation
      // these two fields can never disagree. But this function is the ONE
      // place every billing screen trusts for "is this really active," so
      // it should not blindly propagate a single field if the two ever DO
      // disagree (a stale document, a future regression) — falling through
      // to the pending/trial branch below is a strictly safer failure mode
      // than granting access on an unconfirmed payment.
      return isPaymentConfirmed ? SUBSCRIPTION_UI_STATES.ACTIVE : SUBSCRIPTION_UI_STATES.PENDING_MANDATE;
    case "past_due":
      return SUBSCRIPTION_UI_STATES.PAST_DUE;
    case "suspended":
      return SUBSCRIPTION_UI_STATES.SUSPENDED;
    case "cancelled":
      return SUBSCRIPTION_UI_STATES.CANCELLED;
    case "expired":
      return SUBSCRIPTION_UI_STATES.EXPIRED;
    case "trial":
    default: {
      // A single canonical field, not a re-derived compound rule: the
      // backend only ever sets mandateStatus='pending' in the same write as
      // registrationLinkId (createSubscription, updateSubscription's
      // trial-conversion) — never independently. Checking registrationLinkId
      // too would just be re-deriving a fact the backend already guarantees.
      if (mandateStatus === "pending") {
        return SUBSCRIPTION_UI_STATES.PENDING_MANDATE;
      }
      if (isTrialActive) {
        return SUBSCRIPTION_UI_STATES.TRIAL;
      }
      if (paymentStatus === "pending_payment") {
        return SUBSCRIPTION_UI_STATES.PENDING_PAYMENT;
      }
      return SUBSCRIPTION_UI_STATES.TRIAL;
    }
  }
};

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
