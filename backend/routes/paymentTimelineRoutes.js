const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const subscriptionGate = require("../middlewares/subscriptionGate");
const paymentTimelineController = require("../controllers/paymentTimelineController");

const requireAuth = [authMiddleware, userSync];

router.get("/", requireAuth, subscriptionGate, paymentTimelineController.getPaymentsTimeline);
router.post("/", requireAuth, subscriptionGate, paymentTimelineController.createPayment);
router.put("/:id", requireAuth, subscriptionGate, paymentTimelineController.updateTimelineEntry);
router.delete("/:id", requireAuth, subscriptionGate, paymentTimelineController.deleteTimelineEntry);

module.exports = router;
