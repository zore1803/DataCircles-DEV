// middlewares/subscriptionGate.js
const Subscription = require("../models/Subscription");

// Statuses that allow full read+write access.
const FULL_ACCESS_STATUSES = ["trial", "active", "past_due"];

// HTTP methods considered "read" — always allowed regardless of billing status.
const READ_METHODS = ["GET", "HEAD", "OPTIONS"];

/**
 * subscriptionGate
 *
 * Place AFTER authMiddleware + userSyncMiddleware (needs req.user.organization).
 * Place BEFORE adminMiddleware if both are needed on a route — order between
 * those two doesn't matter functionally, but billing checks failing fast is
 * slightly cheaper than a permissions check, so gate first.
 *
 * Behavior:
 *   - No subscription record at all  -> treated as read-only (no active plan).
 *   - status in FULL_ACCESS_STATUSES -> next() unconditionally.
 *   - otherwise (suspended/cancelled/expired) ->
 *       - GET/HEAD/OPTIONS requests pass through (view their existing data)
 *       - everything else gets 402 with a clear machine-readable reason
 *
 * Attaches req.subscriptionStatus and req.isReadOnly so downstream
 * controllers/middleware (e.g. a future plan-limits check) can inspect
 * state without re-querying the DB.
 */
async function subscriptionGate(req, res, next) {
  try {
    // Super-admins bypass billing checks — identified via req.superAdmin
    // set by userSync.js after signature verification in auth.js.
    if (req.superAdmin) {
      return next();
    }

    if (!req.user || !req.user.organization) {
      // Shouldn't happen if mounted after requireAuth, but fail safe rather
      // than throwing on a missing field.
      return res.status(401).json({ error: "Unauthorized" });
    }

    const subscription = await Subscription.findOne({
      organization: req.user.organization,
    }).select("appStatus status isPaymentConfirmed"); // lean projection, this runs on every request

    const appStatus = subscription?.appStatus;
    const isFullAccess = appStatus && FULL_ACCESS_STATUSES.includes(appStatus);

    req.subscriptionStatus = appStatus || "no_subscription";
    req.isReadOnly = !isFullAccess;

    if (isFullAccess) {
      return next();
    }

    // Not full access: allow reads, block writes.
    if (READ_METHODS.includes(req.method)) {
      return next();
    }

    return res.status(402).json({
      error: "Subscription required",
      message:
        appStatus === "suspended"
          ? "Your subscription is suspended due to a payment issue. You can view your data, but editing is disabled until billing is resolved."
          : appStatus === "cancelled" || appStatus === "expired"
          ? "Your subscription has ended. You can view your existing data, but editing is disabled. Please subscribe to continue."
          : "An active subscription is required to make changes. You can still view your existing data.",
      subscriptionStatus: req.subscriptionStatus,
      code: "SUBSCRIPTION_READ_ONLY",
    });
  } catch (error) {
    console.error("subscriptionGate error:", error);
    // Fail safe: on unexpected error, don't silently allow writes through —
    // but don't hard-block reads either. Block writes, allow reads.
    if (READ_METHODS.includes(req.method)) {
      return next();
    }
    return res.status(500).json({ error: "Could not verify subscription status" });
  }
}

module.exports = subscriptionGate;