// controllers/usageOverviewController.js
//
// Org-wide usage vs. plan limits, for the Data Administration settings
// card — "you're on X, here's what you've used of what X allows." Reuses
// the exact same models/counting/addon-boost logic restrictByPlan.js
// already trusts for enforcement, so this never drifts out of sync with
// what's actually being gated.

const Subscription = require("../models/Subscription");
const PlanConfig = require("../models/PlanConfig");
const User = require("../models/User");
const Invited = require("../models/Invited");
const EmailTemplate = require("../models/EmailTemplate");
const StorageUsage = require("../models/StorageUsage");
const Contact = require("../models/Contact");
const Company = require("../models/Company");
const Vendor = require("../models/Vendor");
const Deal = require("../models/Deal");
const Invoice = require("../models/Invoice");
const ProformaInvoice = require("../models/ProformaInvoice");
const Task = require("../models/Task");
const Meeting = require("../models/Meeting");
const CallLog = require("../models/CallLog");
const Quotation = require("../models/quotation");
const DeliveryChallan = require("../models/deliveryChallan");
const Purchase = require("../models/Purchase");
const PurchaseOrder = require("../models/PurchaseOrder");
const EmailLog = require("../models/EmailLog");
const FormDefinition = require("../models/FormDefinition");
const { calculateAddonBoost, getActiveCatalogEntries } = require("../utils/addonManagement");

// Same module -> backing model(s) map as restrictByPlan.js's
// perModuleLimitModels, duplicated rather than imported since that one
// isn't exported from the middleware module.
const MODULE_MODELS = {
  contacts: { label: "Contacts", models: [Contact] },
  companies: { label: "Companies", models: [Company] },
  deals: { label: "Deals", models: [Deal] },
  vendors: { label: "Vendors", models: [Vendor] },
  invoices: { label: "Invoices", models: [Invoice, ProformaInvoice] },
  tasks: { label: "Tasks", models: [Task] },
  callLogs: { label: "Call Logs", models: [CallLog] },
  meetings: { label: "Meetings", models: [Meeting] },
  quotations: { label: "Quotations", models: [Quotation] },
  "delivery-challans": { label: "Delivery Challans", models: [DeliveryChallan] },
  purchases: { label: "Purchases", models: [Purchase, PurchaseOrder] },
  emails: { label: "Emails Sent", models: [EmailLog] },
  forms: { label: "Forms", models: [FormDefinition] },
};

exports.getUsageOverview = async (req, res) => {
  try {
    const organization = req.user.organization;

    const subscription = await Subscription.findOne({ organization });
    if (!subscription) {
      return res.status(404).json({ error: "No subscription found for this organization." });
    }

    const plan = await PlanConfig.findOne({ planId: subscription.planName });
    if (!plan) {
      return res.status(500).json({ error: "Plan configuration not found." });
    }
    const features = plan.features || {};

    const activeAddons = subscription.activeAddons || [];
    const catalogEntries = await getActiveCatalogEntries(activeAddons);
    const boost = (targetKey) => calculateAddonBoost(activeAddons, catalogEntries, targetKey);

    // Seats — admin (always exactly 1, the org creator) and staff
    // (everyone invited or joined via company code) are tracked separately.
    const includedSeats = features.includedSeats ?? 1;
    const staffSeatsIncluded = features.staffSeats ?? 0;
    const extraSeatsOwned = boost("seats");
    const totalStaffSeats = staffSeatsIncluded + extraSeatsOwned;
    const occupiedAdminSeats = await User.countDocuments({ organization, role: "admin" });
    const occupiedStaffSeats =
      (await User.countDocuments({ organization, role: { $ne: "admin" } })) +
      (await Invited.countDocuments({ organization }));
    const adminSeats = {
      label: "Admin",
      used: occupiedAdminSeats,
      limit: includedSeats,
      unlimited: false,
    };
    const staffSeats = {
      label: "Staff",
      used: occupiedStaffSeats,
      limit: totalStaffSeats,
      unlimited: false,
    };

    // Storage (org-wide, same aggregate as /folders/org-storage-info)
    const [storageAgg] = await StorageUsage.aggregate([
      { $match: { organization } },
      { $group: { _id: null, currentUsage: { $sum: "$currentUsage" }, storageLimit: { $sum: "$storageLimit" } } },
    ]);
    const storageUsedBytes = storageAgg?.currentUsage || 0;
    const storageLimitBytes = storageAgg?.storageLimit || 0;
    const toGB = (bytes) => Number((bytes / (1024 * 1024 * 1024)).toFixed(2));
    const storage = {
      label: "Storage",
      used: toGB(storageUsedBytes),
      limit: toGB(storageLimitBytes),
      unit: "GB",
      unlimited: false,
    };

    // Email templates (a flat number on features, not under features.modules)
    const emailTemplateLimit = features.emailTemplates || 0;
    const emailTemplateBoost = boost("emailTemplates");
    const emailTemplatesUsed = await EmailTemplate.countDocuments({ organization });
    const emailTemplates = {
      label: "Email Templates",
      used: emailTemplatesUsed,
      limit: emailTemplateLimit === "unlimited" ? null : Number(emailTemplateLimit) + emailTemplateBoost,
      unlimited: emailTemplateLimit === "unlimited",
    };

    // Per-module record limits
    const modules = [];
    for (const [moduleName, { label, models }] of Object.entries(MODULE_MODELS)) {
      const moduleFeatures = features.modules?.[moduleName];
      if (!moduleFeatures || !Object.prototype.hasOwnProperty.call(moduleFeatures, "limit")) continue;

      const baseLimit = moduleFeatures.limit;
      const isUnlimited = baseLimit === "unlimited";
      const effectiveLimit = isUnlimited ? null : Number(baseLimit) + boost(moduleName);

      let used = 0;
      for (const Model of models) {
        const filter = moduleName === "forms" ? { organization, status: { $ne: "archived" } } : { organization };
        used += await Model.countDocuments(filter);
      }

      modules.push({ key: moduleName, label, used, limit: effectiveLimit, unlimited: isUnlimited });
    }

    res.json({
      planName: subscription.planName,
      adminSeats,
      staffSeats,
      storage,
      emailTemplates,
      modules,
    });
  } catch (err) {
    console.error("Get usage overview error:", err);
    res.status(500).json({ error: "Failed to load usage overview." });
  }
};
