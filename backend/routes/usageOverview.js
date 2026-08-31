const express = require("express");
const router = express.Router();
const sessionAuth = require("../middlewares/sessionAuth");
const csrfCheck = require("../middlewares/csrfCheck");
const subscriptionGate = require("../middlewares/subscriptionGate");
const usageOverviewController = require("../controllers/usageOverviewController");

const requireAuth = [sessionAuth, csrfCheck];

router.get("/", requireAuth, subscriptionGate, usageOverviewController.getUsageOverview);

module.exports = router;
