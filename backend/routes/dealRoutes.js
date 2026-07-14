const express = require("express");
const router = express.Router();
const dealController = require("../controllers/dealController");
const authMiddleware = require("../middlewares/auth");
const checkPermission = require("../middlewares/checkPermission");
const restrictByPlan = require("../middlewares/restrictByPlan");
const Company = require("../models/Company");
const Contact = require("../models/Contact");
const Deal = require("../models/Deal");
const requireAuth = [authMiddleware, require("../middlewares/userSync")];
const subscriptionGate = require('../middlewares/subscriptionGate');
const { getDashboardDeals } = require("../controllers/dealController");

router.get(
  "/dashboard-deals",
  requireAuth, // ✔ correct middleware
  subscriptionGate,
  restrictByPlan("deals", "read"),
  checkPermission("deals", "readonly"), // optional but consistent
  getDashboardDeals
);

// POST /api/deals (Create - requires write permission)
router.post(
  "/",
  requireAuth,
  subscriptionGate,
  restrictByPlan("deals", "write"),
  checkPermission("deals", "read-write"),
  dealController.createDeal
);

// GET /api/deals (Get all - requires read permission)
router.get(
  "/",
  requireAuth,
  subscriptionGate,
  restrictByPlan("deals", "read"),
  checkPermission("deals", "readonly"),
  dealController.getAllDeals
);

// GET /api/deals/:id (Get single - requires read permission)
router.get(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("deals", "read"),
  checkPermission("deals", "readonly"),
  dealController.getDealById
);

// PUT /api/deals/:id (Update - requires write permission)
router.put(
  "/:id",
  requireAuth,
  subscriptionGate,
  // restrictByPlan("deals", "write"),
  // checkPermission("deals", "read-write"),
  dealController.updateDeal
);

router.post(
  "/:id/status",
  requireAuth,
  subscriptionGate,
  restrictByPlan("deals", "write"),
  checkPermission("deals", "read-write"),
  dealController.updateDealStatus
);

// DELETE /api/deals/:id (Delete - requires write permission)
router.delete(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("deals", "write"),
  checkPermission("deals", "read-write"),
  dealController.deleteDeal
);

// POST /api/deals/bulk-import (Bulk import - requires write permission)
router.post(
  "/bulk-import",
  requireAuth,
  subscriptionGate,
  restrictByPlan("deals", "write"),
  checkPermission("deals", "read-write"),
  async (req, res) => {
    try {
      const { deals } = req.body;

      if (!deals || !Array.isArray(deals) || deals.length === 0) {
        return res.status(400).json({ message: "No deals data provided" });
      }

      console.log(`Processing ${deals.length} deals for bulk import`);

      const validDeals = [];
      const skippedDeals = [];

      for (let i = 0; i < deals.length; i++) {
        const deal = deals[i];
        const rowNumber = i + 1;

        if (!deal.title || deal.title.trim() === "") {
          skippedDeals.push({
            row: rowNumber,
            deal,
            reason: "Missing required field: Title",
          });
          continue;
        }

        if (deal.company) {
          const company = await Company.findOne({
            name: { $regex: `^${deal.company.trim()}$`, $options: "i" },
            organization: req.user.organization,
          });
          if (!company) {
            skippedDeals.push({
              row: rowNumber,
              deal,
              reason: `Company "${deal.company}" not found in your organization`,
            });
            continue;
          }
          deal.company = company._id;
        } else {
          deal.company = null;
        }

        if (deal.contact) {
          const contact = await Contact.findOne({
            name: { $regex: `^${deal.contact.trim()}$`, $options: "i" },
            organization: req.user.organization,
          });
          if (!contact) {
            skippedDeals.push({
              row: rowNumber,
              deal,
              reason: `Contact "${deal.contact}" not found in your organization`,
            });
            continue;
          }
          deal.contact = contact._id;
        } else {
          deal.contact = null;
        }

        deal.amount = parseFloat(deal.amount) || 0;
        deal.status = deal.status || "Open";
        deal.user = req.user._id;
        deal.organization = req.user.organization;

        validDeals.push(deal);
      }

      if (validDeals.length === 0) {
        return res.status(400).json({
          message: "No valid deals to import",
          imported: 0,
          total: deals.length,
          skipped: skippedDeals.length,
          errors: skippedDeals.map((skip) => `Row ${skip.row}: ${skip.reason}`),
        });
      }

      console.log(`Found ${validDeals.length} valid deals to import`);

      try {
        const results = await Deal.insertMany(validDeals, {
          ordered: false,
          rawResult: false,
        });

        console.log(`Successfully imported ${results.length} deals`);

        const response = {
          message: `Successfully imported ${results.length} deals`,
          imported: results.length,
          total: deals.length,
          skipped: skippedDeals.length,
        };

        if (skippedDeals.length > 0) {
          response.warnings = skippedDeals.map(
            (skip) => `Row ${skip.row}: ${skip.reason}`
          );
          response.message += `. ${skippedDeals.length} deals were skipped.`;
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
            `Partial success: ${successCount} imported, ${errorCount} failed`
          );

          const detailedErrors =
            error.writeErrors
              ?.slice(0, 10)
              .map(
                (err, index) =>
                  `Row ${err.index + 1}: ${err.errmsg || "Database error"}`
              ) || [];

          res.json({
            message: `Imported ${successCount} deals, ${errorCount} failed`,
            imported: successCount,
            total: deals.length,
            skipped: skippedDeals.length,
            errors: [
              ...skippedDeals.map((skip) => `Row ${skip.row}: ${skip.reason}`),
              ...detailedErrors,
            ],
            warnings:
              skippedDeals.length > 0
                ? skippedDeals.map((skip) => `Row ${skip.row}: ${skip.reason}`)
                : undefined,
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("Bulk import error:", error);
      res.status(500).json({
        message: "Failed to import deals: " + error.message,
        imported: 0,
        total: 0,
        errors: [error.message],
      });
    }
  }
);

router.post(
  "/export-selected",
  requireAuth,
  subscriptionGate,
  restrictByPlan("deals", "write"),
  dealController.exportSelectedDeals,
);

module.exports = router;
