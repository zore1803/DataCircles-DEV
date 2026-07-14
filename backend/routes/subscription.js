// routes/subscription.js
const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authMiddleware = require('../middlewares/auth');
const userSyncMiddleware = require('../middlewares/userSync');
const adminMiddleware = require('../middlewares/admin');
const couponController = require('../controllers/couponController');

const requireAuth = [authMiddleware, userSyncMiddleware];

const rawBodyMiddleware = (req, res, next) => {
  req.rawBody = '';
  req.on('data', (chunk) => {
    req.rawBody += chunk.toString();
  });
  req.on('end', () => {
    try {
      // Parse the raw body to populate req.body for convenience
      req.body = JSON.parse(req.rawBody || '{}');
      next();
    } catch (error) {
      console.error('Error parsing webhook body:', error.message);
      res.status(400).json({ error: 'Invalid request body' });
    }
  });
};

router.post('/webhook', rawBodyMiddleware, subscriptionController.handleWebhook);
router.use(express.json({ limit: '50mb' }));

// Existing routes...
router.get('/plans', subscriptionController.getPlans);
router.get('/current', requireAuth, subscriptionController.getCurrentSubscription);
router.post('/trial', requireAuth, adminMiddleware, subscriptionController.startFreeTrial);
router.post('/create', requireAuth, adminMiddleware, subscriptionController.createSubscription);
router.put('/update', requireAuth, adminMiddleware, subscriptionController.updateSubscription);
router.post('/cancel', requireAuth, adminMiddleware, subscriptionController.cancelSubscription);


// New payment-related routes
router.post('/verify-payment', requireAuth, adminMiddleware, subscriptionController.verifyPayment);
router.get('/payments', requireAuth, adminMiddleware, subscriptionController.getPaymentHistory);
router.get('/billing-events', requireAuth, adminMiddleware, subscriptionController.getBillingTimeline);
router.get('/payments/:paymentId', requireAuth, adminMiddleware, subscriptionController.getPaymentDetails);
router.post('/:id/retry-payment', requireAuth, adminMiddleware, subscriptionController.retryPayment);

// Public add-on catalog for a specific plan (no auth — needed before signup)
router.get('/addons/plan/:planId', subscriptionController.getAddonsForPlan);

// Seat status (read-only) — seats are just the "extra_seat" add-on now,
// bought/removed via the generic /addons/purchase and /addons/remove below.
router.get('/addons/seats', requireAuth, adminMiddleware, subscriptionController.getSeatStatusEndpoint);
// Deprecated — see subscriptionController.adjustSeats (returns 410).
router.post('/addons/seats', requireAuth, adminMiddleware, subscriptionController.adjustSeats);

// Generic add-on catalog endpoints
router.get('/addons', requireAuth, adminMiddleware, subscriptionController.getAvailableAddons);
router.get('/addons/compatibility', requireAuth, adminMiddleware, subscriptionController.checkAddonCompatibility);
router.post('/addons/purchase', requireAuth, adminMiddleware, subscriptionController.initiateAddonPurchase);
router.post('/addons/remove', requireAuth, adminMiddleware, subscriptionController.scheduleAddonRemovalEndpoint);
router.post('/addons/adjust', requireAuth, adminMiddleware, subscriptionController.adjustAddon);

// Coupon preview (plans page) — order-level eligibility + rules, no line items
router.post('/coupons/preview', requireAuth, adminMiddleware, couponController.previewCoupon);
// Coupon validation at checkout — Organization Admin only, pricing preview only
router.post('/coupons/validate', requireAuth, adminMiddleware, couponController.validateCoupon);

// Referral code — org-facing (see REFERRAL_SYSTEM_DESIGN.md). Returns the
// org's existing active code, issuing one lazily on first request.
router.get('/referrals/code', requireAuth, adminMiddleware, subscriptionController.getOrgReferralCode);
// Referral overview — org-facing: my code(s), referrals sent, whether I was
// referred, my rewards (available/reserved/consumed/expired/revoked), summary stats.
router.get('/referrals/overview', requireAuth, adminMiddleware, subscriptionController.getMyReferralOverview);
// Apply a manually-typed referral code immediately (checkout page's own
// Apply button) — creates Referral(pending) right away, not gated behind
// a later Subscribe/Start Trial submission.
router.post('/referrals/apply', requireAuth, adminMiddleware, subscriptionController.applyReferralCode);
// Sends an invite email carrying the org's referral link. Reuses the
// existing invite-email infrastructure; does NOT create a Referral record —
// sending an email is not a referral event.
router.post('/referrals/send-email', requireAuth, adminMiddleware, subscriptionController.sendReferralEmail);

module.exports = router;
