const express = require("express");
const router = express.Router();
const {
  createTemplate,
  getAllTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate
} = require("../controllers/emailTemplateController");

const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const restrictByPlan = require("../middlewares/restrictByPlan");

const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');

// CRUD routes
router.post("/", requireAuth, subscriptionGate, restrictByPlan('emailTemplates', 'write'), createTemplate);
router.get("/", requireAuth, subscriptionGate, getAllTemplates);
router.get("/:id", requireAuth, subscriptionGate, getTemplateById);
router.put("/:id", requireAuth, subscriptionGate, restrictByPlan('emailTemplates', 'write'), updateTemplate);
router.delete("/:id", requireAuth, subscriptionGate, restrictByPlan('emailTemplates', 'write'), deleteTemplate);

module.exports = router;
