// services/subscriptionApi.js
import API from './api';

export const subscriptionAPI = {
  // Get available plans
  getPlans: () => API.get('/subscription/plans'),
  
  // Get current subscription
  getCurrentSubscription: () => API.get('/subscription/current'),
  
  // Start free trial
  startFreeTrial: () => API.post('/subscription/trial'),
  
  // Create subscription
  createSubscription: (data) => API.post('/subscription/create', data),
  
  // Update subscription
  updateSubscription: (data) => API.put('/subscription/update', data),
  
  // Cancel subscription
  cancelSubscription: (data) => API.post('/subscription/cancel', data),
  
  // Retry payment for failed subscription
  retryPayment: (subscriptionId) => API.post(`/subscription/${subscriptionId}/retry-payment`),
  
  // Verify payment after client receives payment response
  verifyPayment: (paymentData) => API.post('/subscription/verify-payment', paymentData),
  
  // Get payment history
  getPaymentHistory: (params) => API.get('/subscription/payments', { params }),
  
  // Get payment details
  getPaymentDetails: (paymentId) => API.get(`/subscription/payments/${paymentId}`),

  // Adjust extra seats (legacy seat-specific)
  adjustSeats: (data) => API.post('/subscription/addons/seats', data),

  // Get current seat status (legacy seat-specific)
  getSeatStatus: () => API.get('/subscription/addons/seats'),

  // Generic add-on catalog for this org's plan
  getAvailableAddons: () => API.get('/subscription/addons'),

  // Generic add-on quantity adjustment
  adjustAddon: (data) => API.post('/subscription/addons/adjust', data),

  // Public: add-on catalog for a specific plan (no auth needed, for plan browsing)
  getAddonsForPlan: (planId, billingCycle) =>
    API.get(`/subscription/addons/plan/${planId}`, { params: { billingCycle } }),

  // Check which of the org's active add-ons are compatible with a target plan
  checkAddonCompatibility: (targetPlanId, billingCycle) =>
    API.get('/subscription/addons/compatibility', { params: { targetPlanId, billingCycle } }),

  // Initiate a prorated add-on purchase (returns Razorpay Order paymentDetails)
  initiateAddonPurchase: (data) => API.post('/subscription/addons/purchase', data),

  // Schedule an add-on removal at end of current billing cycle
  scheduleAddonRemoval: (data) => API.post('/subscription/addons/remove', data),

  // Validate + price a coupon against a checkout context (no redemption yet)
  validateCoupon: (data) => API.post('/subscription/coupons/validate', data),

  // Order-level coupon eligibility + rules, for previewing discounts on the
  // plans page before any specific plan/add-on is chosen
  previewCoupon: (data) => API.post('/subscription/coupons/preview', data),

  // Billing Center timeline — reads immutable BillingEvent records
  getBillingTimeline: (params) => API.get('/subscription/billing-events', { params }),

  // Referrals — org's own code (issued lazily) and full overview
  // (referrals sent, whether referred, rewards held, summary counts).
  getReferralCode: () => API.get('/subscription/referrals/code'),
  getReferralOverview: () => API.get('/subscription/referrals/overview'),
  // Applies a manually-typed referral code immediately — creates
  // Referral(pending) right away, not gated behind Subscribe/Start Trial.
  applyReferralCode: (code) => API.post('/subscription/referrals/apply', { code }),
  // Sends an invite email carrying the org's referral link. Does NOT
  // create a Referral — sending an email is not a referral event.
  sendReferralEmail: (email, message) => API.post('/subscription/referrals/send-email', { email, message }),
};
