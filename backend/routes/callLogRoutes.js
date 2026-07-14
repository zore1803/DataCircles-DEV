// routes/callLogRoutes.js
const express = require("express");
const router = express.Router();
const callLogController = require("../controllers/callLogController");
const authMiddleware = require("../middlewares/auth");
const adminMiddleware = require("../middlewares/admin");
const userSync = require('../middlewares/userSync');

const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');
const restrictByPlan = require('../middlewares/restrictByPlan');

// CRUD endpoints with organization filtering
router.post("/", requireAuth, subscriptionGate, restrictByPlan("callLogs", "write"), callLogController.createCallLog);
router.get("/", requireAuth, subscriptionGate, restrictByPlan("callLogs", "read"), callLogController.getCallLogs);
router.get("/contact/:contactId", requireAuth, subscriptionGate, restrictByPlan("callLogs", "read"), callLogController.getCallLogsByContact);
router.put("/:id", requireAuth, subscriptionGate, restrictByPlan("callLogs", "write"), callLogController.updateCallLog);
router.delete("/:id", requireAuth, subscriptionGate, restrictByPlan("callLogs", "write"), callLogController.deleteCallLog);

// Admin-only routes for cross-organization access
router.get("/organization/:orgId", requireAuth, subscriptionGate, restrictByPlan("callLogs", "read"), adminMiddleware, callLogController.getCallLogsByOrganization);

module.exports = router;
