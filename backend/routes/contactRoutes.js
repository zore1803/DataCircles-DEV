const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contactController");
const authMiddleware = require("../middlewares/auth");
const checkPermission = require("../middlewares/checkPermission");
const uploadMiddlewareS3 = require("../middlewares/uploadMiddlewareS3");
const restrictByPlan = require("../middlewares/restrictByPlan");
const Company = require("../models/Company");
const Contact = require("../models/Contact");

const requireAuth = [authMiddleware, require('../middlewares/userSync')];
const subscriptionGate = require('../middlewares/subscriptionGate');

// POST /api/contacts (Create - requires write permission)
router.post(
  "/",
  requireAuth,
  subscriptionGate,
  restrictByPlan("contacts", "write"),
  checkPermission("contacts", "read-write"),
  uploadMiddlewareS3().single("avatar"),
  contactController.createContact
);

// GET /api/contacts (Get all - requires read permission)
router.get(
  "/",
  requireAuth,
  subscriptionGate,
  restrictByPlan("contacts", "read"),
  checkPermission("contacts", "readonly"),
  contactController.getAllContacts
);

// GET /api/contacts/pagination (Paginated - requires read permission)
router.get(
  "/pagination",
  requireAuth,
  subscriptionGate,
  restrictByPlan("contacts", "read"),
  checkPermission("contacts", "readonly"),
  contactController.getAllContactsPaginated
);

// GET /api/contacts/:id (Get single - requires read permission)
router.get(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("contacts", "read"),
  checkPermission("contacts", "readonly"),
  contactController.getContactById
);

// GET /api/contacts/company/:id (Get by company - requires read permission)
router.get(
  "/company/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("contacts", "read"),
  checkPermission("contacts", "readonly"),
  contactController.getContactByCompanyId
);

// DELETE /api/contacts/:id (Delete - requires write permission)
router.delete(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("contacts", "write"),
  checkPermission("contacts", "read-write"),
  contactController.deleteContact
);

// PUT /api/contacts/:id/lifecycle-stage (Update lifecycle stage - requires write permission)
router.put(
  "/:id/lifecycle-stage",
  requireAuth,
  subscriptionGate,
  // restrictByPlan("contacts", "write"),
  // checkPermission("contacts", "read-write"),
  contactController.updateLifecycleStage
);

// PUT /api/contacts/update/:id (Full update with avatar - requires write permission)
router.put(
  "/update/:id",
  requireAuth,
  subscriptionGate,
  // restrictByPlan("contacts", "write"),
  // checkPermission("contacts", "read-write"),
  uploadMiddlewareS3().single("avatar"),
  contactController.updateContact
);

// GET /api/contacts/stats/lifecycle-stages (Analytics - requires read permission)
router.get(
  "/stats/lifecycle-stages",
  requireAuth,
  subscriptionGate,
  restrictByPlan("contacts", "read"),
  checkPermission("contacts", "readonly"),
  contactController.getLifecycleStageStats
);

router.post("/:primaryId/merge", requireAuth, subscriptionGate, contactController.mergeContacts);

// POST /api/contacts/bulk-import (Bulk import - requires write permission)
router.post(
  "/bulk-import",
  requireAuth,
  subscriptionGate,
  restrictByPlan("contacts", "write"),
  checkPermission("contacts", "read-write"),
  async (req, res) => {
    try {
      const { contacts } = req.body;

      if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ message: "No contacts data provided" });
      }

      console.log(`Processing ${contacts.length} contacts for bulk import`);

      const validContacts = [];
      const skippedContacts = [];

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        const rowNumber = i + 1;

        if (!contact.name || contact.name.trim() === '') {
          skippedContacts.push({
            row: rowNumber,
            contact: contact,
            reason: "Missing required field: Name",
          });
          continue;
        }

        if (contact.company) {
          // Perform case-insensitive company name search within the same organization
          const company = await Company.findOne({
            name: { $regex: `^${contact.company.trim()}$`, $options: 'i' },
            organization: req.user.organization,
          });

          if (!company) {
            skippedContacts.push({
              row: rowNumber,
              contact: contact,
              reason: `Company "${contact.company}" not found in your organization`,
            });
            continue;
          }

          contact.company = company._id;
        } else {
          contact.company = null;
        }

        // Set user and organization
        contact.user = req.user._id;
        contact.organization = req.user.organization;
        validContacts.push(contact);
      }

      if (validContacts.length === 0) {
        return res.status(400).json({
          message: "No valid contacts to import",
          imported: 0,
          total: contacts.length,
          skipped: skippedContacts.length,
          errors: skippedContacts.map(skip => `Row ${skip.row}: ${skip.reason}`),
        });
      }

      console.log(`Found ${validContacts.length} valid contacts to import`);

      try {
        // Use insertMany for bulk insertion
        const results = await Contact.insertMany(validContacts, {
          ordered: false,
          rawResult: false,
        });

        console.log(`Successfully imported ${results.length} contacts`);

        const response = {
          message: `Successfully imported ${results.length} contacts`,
          imported: results.length,
          total: contacts.length,
          skipped: skippedContacts.length,
        };

        if (skippedContacts.length > 0) {
          response.warnings = skippedContacts.map(skip => `Row ${skip.row}: ${skip.reason}`);
          response.message += `. ${skippedContacts.length} contacts were skipped.`;
        }

        res.json(response);
      } catch (error) {
        // Handle partial success in insertMany
        if (error.name === 'BulkWriteError' || error.name === 'MongoBulkWriteError') {
          const successCount = error.result?.insertedCount || 0;
          const errorCount = error.writeErrors ? error.writeErrors.length : 0;

          console.log(`Partial success: ${successCount} imported, ${errorCount} failed`);

          const detailedErrors = error.writeErrors?.slice(0, 10).map((err, index) =>
            `Row ${err.index + 1}: ${err.errmsg || 'Database error'}`
          ) || [];

          res.json({
            message: `Imported ${successCount} contacts, ${errorCount} failed`,
            imported: successCount,
            total: contacts.length,
            skipped: skippedContacts.length,
            errors: [...skippedContacts.map(skip => `Row ${skip.row}: ${skip.reason}`), ...detailedErrors],
            warnings: skippedContacts.length > 0 ? skippedContacts.map(skip => `Row ${skip.row}: ${skip.reason}`) : undefined,
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Bulk import error:', error);
      res.status(500).json({
        message: "Failed to import contacts: " + error.message,
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
  contactController.exportSelectedContacts,
);

module.exports = router;
