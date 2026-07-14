const express = require("express");
const router = express.Router();
const performaInvoiceController = require("../controllers/performaInvoiceController.js");
const authMiddleware = require("../middlewares/auth");
const checkPermission = require("../middlewares/checkPermission");
const userSync = require("../middlewares/userSync");

const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');
const restrictByPlan = require('../middlewares/restrictByPlan');

// POST /api/performa-invoices (Create - requires write permission)
router.post(
  "/",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "write"),
  checkPermission("invoices", "read-write"),
  performaInvoiceController.createPerformaInvoice
);

// GET /api/performa-invoices (Get all - requires read permission)
router.get(
  "/",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "read"),
  checkPermission("invoices", "readonly"),
  performaInvoiceController.getAllPerformaInvoices
);

// GET /api/performa-invoices/pagination (Paginated - requires read permission)
router.get(
  "/pagination",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "read"),
  checkPermission("invoices", "readonly"),
  performaInvoiceController.getAllPerformaInvoicesPaginated
);

// GET /api/performa-invoices/download/:id (Download - requires read permission with organization check)
router.get(
  "/download/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "read"),
  checkPermission("invoices", "readonly"),
  performaInvoiceController.downloadPerformaInvoice
);

// DELETE /api/performa-invoices/:id (Delete - requires write permission)
router.delete(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "write"),
  checkPermission("invoices", "read-write"),
  performaInvoiceController.deletePerformaInvoice
);

// PUT /api/performa-invoices/:id (Update full proformainvoice - requires write permission)
router.put(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "write"),
  checkPermission("invoices", "read-write"),
  performaInvoiceController.updatePerformaInvoice
);

// PUT /api/performa-invoices/status/:id (Update status - requires write permission)
router.put(
  "/status/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "write"),
  checkPermission("invoices", "read-write"),
  performaInvoiceController.updateStatus
);
// PATCH /api/performa-invoices/number/:id (Rename only performaInvoiceNumber)
router.patch(
  "/number/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "write"),
  checkPermission("invoices", "read-write"),
  performaInvoiceController.updatePerformaInvoiceNumber
);

module.exports = router;
