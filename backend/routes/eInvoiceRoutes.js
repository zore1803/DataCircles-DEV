const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const subscriptionGate = require("../middlewares/subscriptionGate");
const c = require("../controllers/eInvoiceController");

const requireAuth = [authMiddleware, userSync];

// No restrictByPlan/checkPermission gate yet — same situation as
// purchaseReturnRoutes/salesReturnRoutes: "eInvoices" has no PlanConfig
// module entry or user.permissions entry, so adding those checks would 403
// every request. Only auth + subscription-validity are enforced for now.
router.post("/", requireAuth, subscriptionGate, c.createEInvoice);
router.get("/", requireAuth, subscriptionGate, c.getAllEInvoices);
router.get("/pagination", requireAuth, subscriptionGate, c.getAllEInvoicesWithPagination);
router.get("/:id", requireAuth, subscriptionGate, c.getEInvoiceById);
router.put("/:id/status", requireAuth, subscriptionGate, c.updateEInvoiceStatus);
router.delete("/:id", requireAuth, subscriptionGate, c.deleteEInvoice);

module.exports = router;
