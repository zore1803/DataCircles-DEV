const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const subscriptionGate = require("../middlewares/subscriptionGate");
const usageOverviewController = require("../controllers/usageOverviewController");

const requireAuth = [authMiddleware, userSync];

router.get("/", requireAuth, subscriptionGate, usageOverviewController.getUsageOverview);

module.exports = router;
