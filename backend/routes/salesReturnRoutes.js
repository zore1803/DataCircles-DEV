const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const subscriptionGate = require("../middlewares/subscriptionGate");
const c = require("../controllers/salesReturnController");

const requireAuth = [authMiddleware, userSync];

// No restrictByPlan/checkPermission gate yet — same situation as
// purchaseReturnRoutes: "salesReturns" has no PlanConfig module entry or
// user.permissions entry, so adding those checks would 403 every request.
// Only auth + subscription-validity are enforced for now.
router.post("/", requireAuth, subscriptionGate, c.createSalesReturn);
router.get("/", requireAuth, subscriptionGate, c.getAllSalesReturns);
router.get("/pagination", requireAuth, subscriptionGate, c.getAllSalesReturnsWithPagination);
router.get("/download/:id", requireAuth, subscriptionGate, c.downloadSalesReturn);
router.post("/bulk-import", requireAuth, subscriptionGate, c.bulkImportSalesReturns);
// Must come before /:id so "invoice" isn't swallowed as a return id.
router.get("/invoice/:invoiceId/available", requireAuth, subscriptionGate, c.getInvoiceItemsForReturn);
router.get("/:id", requireAuth, subscriptionGate, c.getSalesReturnById);
router.put("/:id", requireAuth, subscriptionGate, c.updateSalesReturn);
router.put("/:id/status", requireAuth, subscriptionGate, c.updateSalesReturnStatus);
router.delete("/:id", requireAuth, subscriptionGate, c.deleteSalesReturn);

module.exports = router;
