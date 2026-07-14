const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const authMiddleware = require("../middlewares/auth");
const checkPermission = require("../middlewares/checkPermission");
const uploadMiddlewareS3 = require("../middlewares/uploadMiddlewareS3");
const restrictByPlan = require("../middlewares/restrictByPlan");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");
const PlanConfig = require("../models/PlanConfig");

const requireAuth = [authMiddleware, require("../middlewares/userSync")];
const subscriptionGate = require('../middlewares/subscriptionGate');

// POST /api/companies (Create with profile picture)
router.post(
  "/",
  requireAuth,
  subscriptionGate,
  restrictByPlan("companies", "write"),
  checkPermission("Companies", "read-write"),
  uploadMiddlewareS3().single("profilePicture"),
  companyController.createCompany,
);

// PUT /api/companies/:id (Update with profile picture)
router.put(
  "/:id",
  requireAuth,
  subscriptionGate,
  // restrictByPlan("companies", "write"),
  // checkPermission("Companies", "read-write"),
  uploadMiddlewareS3().single("profilePicture"),
  companyController.updateCompany,
);

// GET /api/companies (Get all)
router.get(
  "/",
  requireAuth,
  subscriptionGate,
  restrictByPlan("companies", "read"),
  checkPermission("Companies", "readonly"),
  companyController.getAllCompanies,
);

// GET /api/companies/pagination (Paginated)
router.get(
  "/pagination",
  requireAuth,
  subscriptionGate,
  restrictByPlan("companies", "read"),
  checkPermission("Companies", "readonly"),
  companyController.getAllCompaniesPaginated,
);

// GET /api/companies/:id (Get by ID)
router.get(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("companies", "read"),
  checkPermission("Companies", "readonly"),
  companyController.getCompanyById,
);

// DELETE /api/companies/:id
router.delete(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("companies", "write"),
  checkPermission("Companies", "read-write"),
  companyController.deleteCompany,
);

router.post("/:primaryId/merge", requireAuth, subscriptionGate, companyController.mergeCompanies);

// routes/company.js
router.post('/:id/add-subsidiary', requireAuth, subscriptionGate, companyController.addSubsidiary);
router.delete('/:id/remove-subsidiary/:subsidiaryId', requireAuth, subscriptionGate, companyController.removeSubsidiary);
router.get('/:id/subsidiaries', requireAuth, subscriptionGate, companyController.getSubsidiaries);
router.get("/:id/parent", requireAuth, subscriptionGate, companyController.getParentCompany);

// POST /api/companies/bulk-import
router.post(
  "/bulk-import",
  requireAuth,
  subscriptionGate,
  restrictByPlan("companies", "write"),
  checkPermission("Companies", "read-write"),
  async (req, res) => {
    try {
      const { companies, template } = req.body;

      if (!companies || !Array.isArray(companies) || companies.length === 0) {
        return res.status(400).json({ message: "No companies data provided" });
      }

      console.log(`Processing ${companies.length} companies for bulk import`);

      // Fetch subscription and plan
      const subscription = await Subscription.findOne({
        organization: req.user.organization,
      });
      if (!subscription) {
        return res.status(403).json({ error: "No active subscription found" });
      }

      const plan = await PlanConfig.findOne({ planId: subscription.planName });
      if (!plan) {
        return res.status(500).json({ error: "Plan configuration not found" });
      }

      // Check per-user record limit
      const userCount = await Company.countDocuments({
        organization: req.user.organization,
        user: req.user._id,
      });
      const userLimit = plan.features.recordsLimit;
      if (userCount + companies.length > userLimit) {
        return res.status(403).json({
          error: `Per-user record limit exceeded (${userLimit} records for user ${req.user._id})`,
        });
      }

      const validCompanies = [];
      const skippedCompanies = [];

      companies.forEach((company, index) => {
        const rowNumber = index + 1;
        if (!company.name || company.name.trim() === "") {
          skippedCompanies.push({
            row: rowNumber,
            company,
            reason: "Missing required field: Name",
          });
          return;
        }
        validCompanies.push({
          ...company,
          organization: req.user.organization,
          user: req.user._id,
        });
      });

      if (validCompanies.length === 0) {
        return res.status(400).json({
          message: "No valid companies to import",
          imported: 0,
          total: companies.length,
          skipped: skippedCompanies.length,
          errors: skippedCompanies.map(
            (skip) => `Row ${skip.row}: ${skip.reason}`,
          ),
        });
      }

      console.log(`Found ${validCompanies.length} valid companies to import`);

      try {
        const results = await Company.insertMany(validCompanies, {
          ordered: false,
          rawResult: false,
        });

        console.log(`Successfully imported ${results.length} companies`);

        const response = {
          message: `Successfully imported ${results.length} companies`,
          imported: results.length,
          total: companies.length,
          skipped: skippedCompanies.length,
        };

        if (skippedCompanies.length > 0) {
          response.warnings = skippedCompanies.map(
            (skip) => `Row ${skip.row}: ${skip.reason}`,
          );
          response.message += `. ${skippedCompanies.length} companies were skipped.`;
        }

        res.json(response);
      } catch (error) {
        if (
          error.name === "BulkWriteError" ||
          error.name === "MongoBulkWriteError"
        ) {
          const successCount = error.result?.insertedCount || 0;
          const errorCount = error.writeErrors ? error.writeErrors.length : 0;

          console.log(
            `Partial success: ${successCount} imported, ${errorCount} failed`,
          );

          res.json({
            message: `Imported ${successCount} companies, ${errorCount} failed`,
            imported: successCount,
            total: companies.length,
            skipped: skippedCompanies.length,
            errors: [
              ...skippedCompanies.map(
                (skip) => `Row ${skip.row}: ${skip.reason}`,
              ),
              ...(error.writeErrors
                ?.slice(0, 5)
                .map(
                  (err, idx) =>
                    `Row ${err.index + 1}: ${err.errmsg || "Database error"}`,
                ) || []),
            ],
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("Bulk import error:", error);
      res.status(500).json({
        message: "Failed to import companies: " + error.message,
      });
    }
  },
);

router.post(
  "/export-selected",
  requireAuth,
  subscriptionGate,
  companyController.exportSelectedCompanies,
);

module.exports = router;
