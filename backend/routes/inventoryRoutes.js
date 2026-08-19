// routes/inventoryRoutes.js
// Inventory is a view over the Item collection, so it reuses the "items" permission module
// rather than introducing a new one — anyone who can read products can read their stock, and
// anyone who can edit products can move stock.
const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");
const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const subscriptionGate = require("../middlewares/subscriptionGate");
const checkPermission = require("../middlewares/checkPermission");

const requireAuth = [authMiddleware, userSync];
const readGate = [requireAuth, subscriptionGate, checkPermission("items", "readonly")];
const writeGate = [requireAuth, subscriptionGate, checkPermission("items", "read-write")];

// List stock-tracked items + KPI summary
router.get("/", readGate, inventoryController.getInventory);

// Per-item stock ledger
router.get("/:id/movements", readGate, inventoryController.getMovements);

// Stock movements
router.post("/:id/stock-in", writeGate, inventoryController.stockIn);
router.post("/:id/stock-out", writeGate, inventoryController.stockOut);

// Enable tracking / opening stock / low-stock threshold
router.patch("/:id/settings", writeGate, inventoryController.updateInventorySettings);

module.exports = router;
