// routes/bankDetailsRoutes.js (updated with organization filtering)
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const adminMiddleware = require("../middlewares/admin");
const userSync = require("../middlewares/userSync");
const checkPermission = require("../middlewares/checkPermission");
const bankDetailsController = require("../controllers/bankDetailsController")

const requireAuth = [authMiddleware, userSync]; // Combined auth middleware
const subscriptionGate = require('../middlewares/subscriptionGate');

// Create bank details
router.post("/", requireAuth, subscriptionGate, bankDetailsController.createBankDetails);

// Read latest bank details for the organization
router.get("/", requireAuth, subscriptionGate, bankDetailsController.getLatestBankDetails);

// Get all bank details for the organization (if you need this)
router.get("/all", requireAuth, subscriptionGate, bankDetailsController.getAllBankDetails);

// Read one bank details by ID
router.get("/:id", requireAuth, subscriptionGate, bankDetailsController.getBankDetailsById);

// Update or Create bank details
router.put("/:id", requireAuth, subscriptionGate, bankDetailsController.updateBankDetails);


// Delete bank details
router.delete("/:id", requireAuth, subscriptionGate, bankDetailsController.deleteBankDetails);

module.exports = router;
