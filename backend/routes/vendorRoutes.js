const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const checkPermission = require("../middlewares/checkPermission");
const restrictByPlan = require("../middlewares/restrictByPlan");
const uploadMiddlewareS3 = require("../middlewares/uploadMiddlewareS3");
const vendorController = require("../controllers/vendorController");

const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');

// Create Vendor
router.post("/",
  requireAuth,
  subscriptionGate,
  // restrictByPlan("vendors", "write"),
  // checkPermission("vendors", "read-write"),
  uploadMiddlewareS3().single("avatar"),
  vendorController.createVendor
);

// Get All Vendors (enhanced search)
router.get("/",
  requireAuth,
  subscriptionGate,
  restrictByPlan("vendors", "read"),
  checkPermission("vendors", "readonly"),
  vendorController.getAllVendors
);

// Get All Vendors (paginated) - specific route before /:id
router.get("/pagination",
  requireAuth,
  subscriptionGate,
  restrictByPlan("vendors", "read"),
  checkPermission("vendors", "readonly"),
  vendorController.getAllVendorsWithPagination
);

// Bulk Import Vendors - specific route before /:id
router.post("/bulk-import",
  requireAuth,
  subscriptionGate,
  restrictByPlan("vendors", "write"),
  checkPermission("vendors", "read-write"),
  vendorController.bulkImportVendors
);

// Get All Payments (paginated) - specific route before /:id
router.get("/payments/pagination",
  requireAuth,
  subscriptionGate,
  restrictByPlan("vendors", "read"),
  checkPermission("vendors", "readonly"),
  vendorController.getAllPaymentsWithPagination
);

// Delete Payment (by payment ID only) - specific route before /:id
router.delete("/payments/:paymentId",
  requireAuth,
  subscriptionGate,
  restrictByPlan("vendors", "write"),
  checkPermission("vendors", "read-write"),
  vendorController.deletePaymentById
);

// Get Vendor by ID
router.get("/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("vendors", "read"),
  checkPermission("vendors", "readonly"),
  vendorController.getVendorById
);

// Update Vendor
router.put("/:id",
  requireAuth,
  subscriptionGate,
  // restrictByPlan("vendors", "write"),
  // checkPermission("vendors", "read-write"),
  uploadMiddlewareS3().single("avatar"),
  vendorController.updateVendor
);

// Delete Vendor
router.delete("/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("vendors", "write"),
  checkPermission("vendors", "read-write"),
  vendorController.deleteVendor
);

// Add Payment for Vendor
router.post("/:vendorId/payments",
  requireAuth,
  subscriptionGate,
  restrictByPlan("vendors", "write"),
  checkPermission("vendors", "read-write"),
  vendorController.addPaymentForVendor
);

// Get All Payments for a Vendor
router.get("/:vendorId/payments",
  requireAuth,
  subscriptionGate,
  restrictByPlan("vendors", "read"),
  checkPermission("vendors", "readonly"),
  vendorController.getPaymentsForVendor
);

// Update Payment
router.put("/:vendorId/payments/:paymentId",
  requireAuth,
  subscriptionGate,
  restrictByPlan("vendors", "write"),
  checkPermission("vendors", "read-write"),
  vendorController.updatePayment
);

// Delete Payment (by vendor and payment ID)
router.delete("/:vendorId/payments/:paymentId",
  requireAuth,
  subscriptionGate,
  restrictByPlan("vendors", "write"),
  checkPermission("vendors", "read-write"),
  vendorController.deletePaymentByVendorAndId
);

module.exports = router;
