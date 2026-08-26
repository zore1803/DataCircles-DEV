const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const salesOrderController = require("../controllers/salesOrderController");

const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require("../middlewares/subscriptionGate");

// No restrictByPlan/checkPermission gate — "salesOrders" has no PlanConfig
// module entry or user.permissions entry on any existing plan/user yet
// (same situation purchaseReturn.js documents), so adding those checks now
// would 403 every request until that plan/permission plumbing is set up
// separately. Only auth + subscription-validity are enforced for now.
router.post("/", requireAuth, subscriptionGate, salesOrderController.createSalesOrder);
router.get("/pagination", requireAuth, subscriptionGate, salesOrderController.getAllSalesOrdersPaginated);
router.get("/download/:id", requireAuth, subscriptionGate, salesOrderController.downloadSalesOrder);
router.post("/:id/duplicate", requireAuth, subscriptionGate, salesOrderController.duplicateSalesOrder);
router.get("/:id", requireAuth, subscriptionGate, salesOrderController.getSalesOrderById);
router.put("/:id", requireAuth, subscriptionGate, salesOrderController.updateSalesOrder);
router.put("/:id/status", requireAuth, subscriptionGate, salesOrderController.updateStatus);
router.delete("/:id", requireAuth, subscriptionGate, salesOrderController.deleteSalesOrder);
router.post("/bulk-status", requireAuth, subscriptionGate, salesOrderController.bulkUpdateStatus);
router.post("/bulk-delete", requireAuth, subscriptionGate, salesOrderController.bulkDelete);

module.exports = router;
