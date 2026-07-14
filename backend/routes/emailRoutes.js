// routes/emailRoutes.js
const express = require("express");
const router = express.Router();
const emailController = require("../controllers/emailController");
const authMiddleware = require("../middlewares/auth");
const checkPermission = require("../middlewares/checkPermission");
const requireAuth = [authMiddleware, require('../middlewares/userSync')]; // Assuming userSync is required
const subscriptionGate = require('../middlewares/subscriptionGate');
const restrictByPlan = require('../middlewares/restrictByPlan');

// POST /api/emails/send (Send email and log - requires write permission)
router.post(
  "/send",
  requireAuth,
  subscriptionGate,
  restrictByPlan('emails', 'write'),
  checkPermission("emails", "read-write"),
  emailController.sendEmail
);

// GET /api/emails (Get all logs - requires read permission)
router.get(
  "/",
  requireAuth,
  subscriptionGate,
  restrictByPlan('emails', 'read'),
  checkPermission("emails", "readonly"),
  emailController.getAllEmailLogs
);

// GET /api/emails/pagination (Paginated logs - requires read permission)
router.get(
  "/pagination",
  requireAuth,
  subscriptionGate,
  restrictByPlan('emails', 'read'),
  checkPermission("emails", "readonly"),
  emailController.getAllEmailLogsPaginated
);

// GET /api/emails/:id (Get single log - requires read permission)
router.get(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan('emails', 'read'),
  checkPermission("emails", "readonly"),
  emailController.getEmailLogById
);

// GET /api/emails/recipient/:type/:id (Get logs by recipient - requires read permission)
router.get(
  "/recipient/:type/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan('emails', 'read'),
  checkPermission("emails", "readonly"),
  emailController.getEmailLogsByRecipient
);

module.exports = router;