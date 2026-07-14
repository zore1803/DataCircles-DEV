const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const checkPermission = require("../middlewares/checkPermission");
const purchaseController = require("../controllers/purchaseController");

const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');
const restrictByPlan = require('../middlewares/restrictByPlan');

// Create Purchase
router.post("/",
  requireAuth,
  subscriptionGate,
  restrictByPlan('purchases', 'write'),
  checkPermission("purchases", "read-write"),
  purchaseController.createPurchase
);

// Get All Purchases
router.get("/",
  requireAuth,
  subscriptionGate,
  restrictByPlan('purchases', 'read'),
  checkPermission("purchases", "readonly"),
  purchaseController.getAllPurchases
);

// Get All Purchases with Pagination (specific route before generic /:id)
router.get("/pagination",
  requireAuth,
  subscriptionGate,
  restrictByPlan('purchases', 'read'),
  checkPermission("purchases", "readonly"),
  purchaseController.getAllPurchasesWithPagination
);

// Get Purchases for a Vendor (specific route before generic /:id)
router.get("/vendor/:vendorId",
  requireAuth,
  subscriptionGate,
  restrictByPlan('purchases', 'read'),
  checkPermission("purchases", "readonly"),
  purchaseController.getPurchasesByVendor
);

// Get Single Purchase
router.get("/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan('purchases', 'read'),
  checkPermission("purchases", "readonly"),
  purchaseController.getPurchaseById
);

// Update Purchase
router.put("/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan('purchases', 'write'),
  checkPermission("purchases", "read-write"),
  purchaseController.updatePurchase
);

// Update only Status (specific route)
router.put("/:id/status",
  requireAuth,
  subscriptionGate,
  restrictByPlan('purchases', 'write'),
  checkPermission("purchases", "read-write"),
  purchaseController.updatePurchaseStatus
);

// Delete Purchase
router.delete("/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan('purchases', 'write'),
  checkPermission("purchases", "read-write"),
  purchaseController.deletePurchase
);

module.exports = router;
