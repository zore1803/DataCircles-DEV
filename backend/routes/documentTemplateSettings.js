const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const subscriptionGate = require("../middlewares/subscriptionGate");
const documentTemplateSettingsController = require("../controllers/documentTemplateSettingsController");

const requireAuth = [authMiddleware, userSync];

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
