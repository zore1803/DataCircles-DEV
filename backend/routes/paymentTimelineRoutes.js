const express = require("express");
const router = express.Router();
const sessionAuth = require("../middlewares/sessionAuth");
const csrfCheck = require("../middlewares/csrfCheck");
const subscriptionGate = require("../middlewares/subscriptionGate");
const paymentTimelineController = require("../controllers/paymentTimelineController");

const requireAuth = [sessionAuth, csrfCheck];

router.get("/", requireAuth, subscriptionGate, paymentTimelineController.getPaymentsTimeline);
router.get("/:id/receipt", requireAuth, subscriptionGate, paymentTimelineController.getPaymentReceipt);
router.post("/", requireAuth, subscriptionGate, paymentTimelineController.createPayment);
router.put("/:id", requireAuth, subscriptionGate, paymentTimelineController.updateTimelineEntry);
router.delete("/:id", requireAuth, subscriptionGate, paymentTimelineController.deleteTimelineEntry);

module.exports = router;
