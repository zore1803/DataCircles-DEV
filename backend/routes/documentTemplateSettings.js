const express = require("express");
const router = express.Router();
const sessionAuth = require("../middlewares/sessionAuth");
const csrfCheck = require("../middlewares/csrfCheck");
const subscriptionGate = require("../middlewares/subscriptionGate");
const documentTemplateSettingsController = require("../controllers/documentTemplateSettingsController");

const requireAuth = [sessionAuth, csrfCheck];

// Template choices for the organization's accounting documents.
router.get(
  "/",
  requireAuth,
  subscriptionGate,
  documentTemplateSettingsController.getDocumentTemplates
);

router.put(
  "/",
  requireAuth,
  subscriptionGate,
  documentTemplateSettingsController.updateDocumentTemplates
);

module.exports = router;
