// middlewares/subscriptionCheck.js
const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');

// Cache to reduce database queries (optional but recommended)
const subscriptionCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const checkSubscriptionLimits = (featureType) => {
  return async (req, res, next) => {
    try {
      // Check cache first
      const cacheKey = `sub_${req.user.organization}`;
      const cached = subscriptionCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
        req.subscription = cached.subscription;
        req.planLimits = cached.planLimits;
        req.isTrialUser = cached.isTrialUser;
        return next();
      }

      // Get subscription from your database
      const subscription = await Subscription.findOne({ 
        organization: req.user.organization
      }).select('razorpaySubscriptionId planName trialEnd isTrialActive organization status currentPeriodEnd');
      
      if (!subscription) {
        return res.status(403).json({ 
          error: 'No subscription found',
          code: 'SUBSCRIPTION_REQUIRED'
        });
      }

      // Check trial status first (trials don't exist in Razorpay)
      if (subscription.isTrialActive) {
        if (new Date() > subscription.trialEnd) {
          // Trial expired - update local DB
          subscription.isTrialActive = false;
          subscription.status = 'expired';
          await subscription.save();
          
          return res.status(403).json({ 
            error: 'Trial period has expired. Please subscribe to continue.',
            code: 'TRIAL_EXPIRED'
          });
        }
        
        // Trial is still active - allow access
        const plan = await PlanConfig.findOne({ planId: subscription.planName });
        if (!plan) {
          return res.status(500).json({ error: 'Plan configuration not found' });
        }

        // Cache the result
        subscriptionCache.set(cacheKey, {
          timestamp: Date.now(),
          subscription,
          planLimits: plan.features,
          isTrialUser: true
        });

        req.subscription = subscription;
        req.planLimits = plan.features;
        req.isTrialUser = true;
        return next();
      }

      // For paid subscriptions, check local status
      const validStatuses = ['active', 'authenticated'];
      if (!validStatuses.includes(subscription.status)) {
        return res.status(403).json({ 
          error: `Subscription is ${subscription.status}. Please update your payment method.`,
          code: 'SUBSCRIPTION_INACTIVE',
          razorpayStatus: subscription.status
        });
      }

      // Check if subscription has ended
      if (subscription.currentPeriodEnd && 
          new Date() > subscription.currentPeriodEnd) {
        subscription.status = 'expired';
        await subscription.save();
        
        return res.status(403).json({ 
          error: 'Subscription has ended',
          code: 'SUBSCRIPTION_ENDED'
        });
      }

      // Get plan limits
      const plan = await PlanConfig.findOne({ planId: subscription.planName });
      if (!plan) {
        return res.status(500).json({ error: 'Plan configuration not found' });
      }

      // Cache the result
      subscriptionCache.set(cacheKey, {
        timestamp: Date.now(),
        subscription,
        planLimits: plan.features,
        isTrialUser: false
      });

      // Clean old cache entries (optional)
      if (subscriptionCache.size > 1000) {
        const entries = Array.from(subscriptionCache.entries());
        entries.slice(0, 500).forEach(([key]) => subscriptionCache.delete(key));
      }

      req.subscription = subscription;
      req.planLimits = plan.features;
      req.isTrialUser = false;
      
      next();
    } catch (error) {
      console.error('Subscription check error:', error);
      res.status(500).json({ 
        error: 'Internal server error during subscription verification',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

// Optional: Clear cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of subscriptionCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      subscriptionCache.delete(key);
    }
  }
}, CACHE_DURATION);

module.exports = { checkSubscriptionLimits };