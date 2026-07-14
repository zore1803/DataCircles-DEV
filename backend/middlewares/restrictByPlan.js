// middlewares/restrictByPlan.js
//
// Must run AFTER subscriptionGate on every route. subscriptionGate is the
// single source of truth for subscription VALIDITY (trial/active/past_due
// = good, suspended/cancelled/expired/missing = read-only). This file
// trusts that check already happened and focuses purely on: given a valid
// subscription, does this org's PLAN allow this module/action, and have
// they hit their per-module usage limit.
//
// recordsLimit (the old combined companies+contacts+vendors+deals pool) has
// been REMOVED. Every module that can be limited now has its own
// independent numeric `limit` field, checked against its own model count.

const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const { calculateAddonBoost, getActiveCatalogEntries } = require('../utils/addonManagement');
const Contact = require('../models/Contact');
const Company = require('../models/Company');
const Vendor = require('../models/Vendor');
const Deal = require('../models/Deal');
const Invoice = require('../models/Invoice');
const ProformaInvoice = require('../models/ProformaInvoice');
const Task = require('../models/Task');
const Meeting = require('../models/Meeting');
const CallLog = require('../models/CallLog');
const Quotation = require('../models/quotation');
const DeliveryChallan = require('../models/deliveryChallan');
const Purchase = require('../models/Purchase');
const PurchaseOrder = require('../models/PurchaseOrder');
const EmailLog = require('../models/EmailLog');
const EmailTemplate = require('../models/EmailTemplate');
const StorageUsage = require('../models/StorageUsage');
const FormDefinition = require('../models/FormDefinition');

// ----------------------------------------------------------------------
// Per-module numeric limits, ORG-WIDE (all users combined), checked
// independently per module. Some modules combine TWO models into one
// count, by deliberate product decision (proforma invoices share the
// invoices limit; purchase orders share the purchases limit) — these are
// listed as arrays. Single-model modules are listed as a single model.
//
// `folders` is intentionally NOT here — the Folder model has no
// `organization` field, so an org-wide count isn't possible without a
// schema migration. Folders only gets read/write toggle enforcement, no
// numeric limit, until/unless that's added later.
//
// `tags` is also intentionally absent — no backing model/collection
// exists for it at all (confirmed earlier in this project).
// ----------------------------------------------------------------------
const perModuleLimitModels = {
  contacts: [Contact],
  companies: [Company],
  deals: [Deal],
  vendors: [Vendor],
  invoices: [Invoice, ProformaInvoice], // combined count, by design
  tasks: [Task],
  callLogs: [CallLog],
  meetings: [Meeting],
  quotations: [Quotation],
  'delivery-challans': [DeliveryChallan],
  purchases: [Purchase, PurchaseOrder], // combined count, by design
  emails: [EmailLog],
  // Unfiltered count, matching every other module's semantics exactly (e.g. Deal counts
  // Won/Lost the same as Open — no module filters by internal status). An archived
  // FormDefinition counts against the limit the same as a published one. Deliberate: whether
  // archived/terminal-state resources should stop counting is a cross-module Billing policy
  // question, not something to special-case for Forms alone in this change.
  forms: [FormDefinition],
};

// Cache to reduce database queries — caches PlanConfig.features per
// organization, since plan features change rarely.
const planFeaturesCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const checkStorageLimit = async (req, planLimits) => {
  if (!req.files || req.files.length === 0) {
    return { allowed: true };
  }

  const totalFileSize = req.files.reduce((sum, file) => sum + file.size, 0);

  let storageUsage = await StorageUsage.findOne({
    organization: req.user.organization,
    user: req.user._id,
  });

  if (!storageUsage) {
    const storageLimit = planLimits.fileStorage || (2 * 1024 * 1024 * 1024); // Default 2GB

    storageUsage = await StorageUsage.create({
      user: req.user._id,
      organization: req.user.organization,
      storageLimit: storageLimit,
      currentUsage: 0,
    });
  }

  if (storageUsage.storageLimit != planLimits.fileStorage) {
    storageUsage.storageLimit = planLimits.fileStorage;
    await storageUsage.save();
  }

  if (!storageUsage.hasSpace(totalFileSize)) {
    return {
      allowed: false,
      error: `Storage limit exceeded.`,
      currentUsage: storageUsage.currentUsage,
      storageLimit: storageUsage.storageLimit,
      usagePercentage: storageUsage.getUsagePercentage(),
    };
  }

  return {
    allowed: true,
    storageUsage,
    uploadSize: totalFileSize,
  };
};

const getStorageUpgradeMessage = (currentPlan) => {
  const messages = {
    trial: 'Your trial includes 2GB storage. Upgrade to Business plan for 5GB.',
    starter: 'Upgrade to Growth plan (2GB) or Business plan (5GB) for more storage.',
    growth: 'Upgrade to Business plan for 5GB storage.',
    business: 'Contact support for enterprise storage options.',
  };
  return messages[currentPlan] || messages.trial;
};

module.exports = (moduleName, actionType) => async (req, res, next) => {
  try {
    const organization = req.user.organization;

    const subscription = await Subscription.findOne({ organization }).select(
      'planName appStatus activeAddons'
    );

    if (!subscription) {
      return res.status(403).json({
        error: 'No subscription found. Please subscribe to continue.',
        code: 'NO_SUBSCRIPTION',
      });
    }

    // Fetch plan features (cached per-org, since these change rarely)
    const cacheKey = `plan_features_${organization}`;
    let planLimits = planFeaturesCache.get(cacheKey)?.features;
    const cachedAt = planFeaturesCache.get(cacheKey)?.timestamp;

    if (!planLimits || Date.now() - cachedAt > CACHE_DURATION) {
      const plan = await PlanConfig.findOne({ planId: subscription.planName });
      if (!plan) {
        return res.status(500).json({
          error: 'Plan configuration not found',
          code: 'PLAN_CONFIG_ERROR',
        });
      }
      planLimits = plan.features;
      planFeaturesCache.set(cacheKey, { timestamp: Date.now(), features: planLimits });
    }

    req.subscription = subscription;
    req.planLimits = planLimits;
    req.planName = subscription.planName;

    // Fetch catalog entries for any purchased add-ons so boost can be computed below.
    const activeAddons = subscription.activeAddons || [];
    const catalogEntries = await getActiveCatalogEntries(activeAddons);

    // ✅ Email templates: dedicated branch, unrelated to features.modules.
    // This module name does NOT go through the generic modules.X.read/write
    // check below — it reads planLimits.emailTemplates directly (a number)
    // and counts EmailTemplate documents.
    if (moduleName === 'emailTemplates' && actionType === 'write') {
      const baseEmailLimit = planLimits.emailTemplates || 0;
      const emailAddonBoost = calculateAddonBoost(activeAddons, catalogEntries, 'emailTemplates');
      const effectiveEmailLimit = baseEmailLimit + emailAddonBoost;

      if (!effectiveEmailLimit || effectiveEmailLimit === 0) {
        return res.status(403).json({
          error: `Email templates not available in your ${subscription.planName} plan. Please upgrade.`,
          code: 'FEATURE_NOT_AVAILABLE',
        });
      }

      const currentEmailTemplateCount = await EmailTemplate.countDocuments({
        organization,
      });

      const newTemplates = req.body?.templates?.length || 1;

      if (currentEmailTemplateCount + newTemplates > effectiveEmailLimit) {
        return res.status(403).json({
          error: `Email template limit reached (${currentEmailTemplateCount}/${effectiveEmailLimit}). Upgrade your plan to create more.`,
          code: 'LIMIT_REACHED',
          current: currentEmailTemplateCount,
          limit: effectiveEmailLimit,
          planName: subscription.planName,
        });
      }

      return next(); // emailTemplates is fully handled above, skip the generic path entirely
    }

    // ------------------------------------------------------------------
    // Generic module path — used by every other module name.
    // ------------------------------------------------------------------
    const moduleFeatures = planLimits.modules?.[moduleName];

    // Check if org has a module_unlock add-on that overrides read/write access.
    const moduleUnlockEntry = catalogEntries.find(
      (entry) =>
        entry.effectType === 'module_unlock' &&
        entry.targetKey === moduleName &&
        activeAddons.some((a) => a.addonKey === entry.key && a.quantity > 0)
    );

    if (!moduleFeatures && !moduleUnlockEntry) {
      return res.status(403).json({
        error: `Module '${moduleName}' not available in your ${subscription.planName} plan. Please upgrade.`,
        code: 'MODULE_NOT_AVAILABLE',
        planName: subscription.planName,
      });
    }

    const effectiveRead = (moduleFeatures?.read ?? false) || (moduleUnlockEntry?.unlockRead ?? false);
    const effectiveWrite = (moduleFeatures?.write ?? false) || (moduleUnlockEntry?.unlockWrite ?? false);

    if (actionType === 'read' && !effectiveRead) {
      return res.status(403).json({
        error: `Read access to ${moduleName} not allowed in your ${subscription.planName} plan`,
        code: 'READ_NOT_ALLOWED',
      });
    }

    if (actionType === 'write' && !effectiveWrite) {
      return res.status(403).json({
        error: `Write access to ${moduleName} not allowed in your ${subscription.planName} plan. Upgrade to get write access.`,
        code: 'WRITE_NOT_ALLOWED',
        planName: subscription.planName,
      });
    }

    // ------------------------------------------------------------------
    // Per-module numeric limit check, ORG-WIDE. Runs only for write
    // actions, only when this module has a `limit` field defined AND has
    // backing model(s) registered in perModuleLimitModels.
    // ------------------------------------------------------------------
    if (
      actionType === 'write' &&
      moduleFeatures &&
      Object.prototype.hasOwnProperty.call(moduleFeatures, 'limit') &&
      perModuleLimitModels[moduleName]
    ) {
      const moduleLimit = moduleFeatures.limit;

      if (moduleLimit !== 'unlimited') {
        const addonBoost = calculateAddonBoost(activeAddons, catalogEntries, moduleName);
        const effectiveLimit = Number(moduleLimit) + addonBoost;

        if (!Number.isNaN(effectiveLimit)) {
          const models = perModuleLimitModels[moduleName];

          // Sum counts across all backing models for this module (usually
          // just one model; invoices and purchases combine two).
          let currentModuleCount = 0;
          for (const Model of models) {
            currentModuleCount += await Model.countDocuments({ organization });
          }

          const newItemsOfThisModule = req.body?.[moduleName]?.length || 1;

          if (currentModuleCount + newItemsOfThisModule > effectiveLimit) {
            return res.status(403).json({
              error: `${moduleName} limit reached (${currentModuleCount}/${effectiveLimit} for your organization). Upgrade your plan to add more.`,
              code: 'MODULE_LIMIT_REACHED',
              module: moduleName,
              current: currentModuleCount,
              limit: effectiveLimit,
              attempting: newItemsOfThisModule,
              planName: subscription.planName,
            });
          }
        }
      }
      // moduleLimit === 'unlimited' -> no check needed, fall through
    }

    // ✅ Check storage limit for file uploads
    if (req.files && req.files.length > 0) {
      const storageCheck = await checkStorageLimit(req, planLimits);

      if (!storageCheck.allowed) {
        return res.status(413).json({
          error: storageCheck.error,
          code: 'STORAGE_LIMIT_EXCEEDED',
          currentUsage: storageCheck.currentUsage,
          storageLimit: storageCheck.storageLimit,
          usagePercentage: storageCheck.usagePercentage,
          planName: subscription.planName,
          upgradeMessage: getStorageUpgradeMessage(subscription.planName),
        });
      }

      req.storageUsage = storageCheck.storageUsage;
      req.uploadSize = storageCheck.uploadSize;
    }

    next();
  } catch (error) {
    console.error('Plan restriction error:', {
      user: req.user?._id,
      organization: req.user?.organization,
      module: moduleName,
      action: actionType,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Unable to verify plan limits. Please try again.',
      code: 'VERIFICATION_ERROR',
    });
  }
};

// Clear expired plan-feature cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of planFeaturesCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      planFeaturesCache.delete(key);
    }
  }
}, CACHE_DURATION);

// Call this whenever a PlanConfig document is updated (e.g. from the
// super-admin UI) so stale cached features don't linger for up to 5 min.
module.exports.clearOrgCache = (organizationId) => {
  planFeaturesCache.delete(`plan_features_${organizationId}`);
};