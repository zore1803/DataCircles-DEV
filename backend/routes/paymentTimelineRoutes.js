const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const subscriptionGate = require("../middlewares/subscriptionGate");
const paymentTimelineController = require("../controllers/paymentTimelineController");

const requireAuth = [authMiddleware, userSync];

router.get("/", requireAuth, subscriptionGate, paymentTimelineController.getPaymentsTimeline);

// Allocation lookups — declared before the "/:id/..." routes below so
// "parties", "open-documents" and "credit-balances" aren't swallowed as ids.
router.get("/parties", requireAuth, subscriptionGate, paymentTimelineController.getPaymentParties);
router.get("/open-documents/all", requireAuth, subscriptionGate, paymentTimelineController.getAllOpenDocuments);
router.get("/open-documents", requireAuth, subscriptionGate, paymentTimelineController.getOpenDocuments);
router.get("/credit-balances", requireAuth, subscriptionGate, paymentTimelineController.getCreditBalances);
router.post("/credit/apply", requireAuth, subscriptionGate, paymentTimelineController.applyCreditBalance);

router.get("/:id/receipt", requireAuth, subscriptionGate, paymentTimelineController.getPaymentReceipt);
router.get("/:id/allocations", requireAuth, subscriptionGate, paymentTimelineController.getPaymentAllocations);
router.post("/:id/allocations", requireAuth, subscriptionGate, paymentTimelineController.allocateExistingPayment);
router.delete("/:id/allocations/:allocationId", requireAuth, subscriptionGate, paymentTimelineController.deleteAllocation);

router.post("/", requireAuth, subscriptionGate, paymentTimelineController.createPayment);
router.put("/:id", requireAuth, subscriptionGate, paymentTimelineController.updateTimelineEntry);
router.delete("/:id", requireAuth, subscriptionGate, paymentTimelineController.deleteTimelineEntry);

module.exports = router;
