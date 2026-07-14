const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");
const authMiddleware = require("../middlewares/auth");
const checkPermission = require("../middlewares/checkPermission");
const userSync = require("../middlewares/userSync");
const restrictByPlan = require("../middlewares/restrictByPlan");

const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');

// POST /api/invoices (Create - requires write permission)
router.post(
  "/",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "write"),
  checkPermission("invoices", "read-write"),
  invoiceController.createInvoice
);

// GET /api/invoices (Get all - requires read permission)
router.get(
  "/",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "read"),
  checkPermission("invoices", "readonly"),
  invoiceController.getAllInvoices
);

router.get(
  "/company/:companyId",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "read"),
  checkPermission("invoices", "readonly"),
  invoiceController.getInvoicesByCompany
);

// GET /api/invoices/pagination (Paginated - requires read permission)
router.get(
  "/pagination",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "read"),
  checkPermission("invoices", "readonly"),
  invoiceController.getAllInvoicesPaginated
);

// GET /api/invoices/download/:id (Download - requires read permission with organization check)
router.get(
  "/download/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "read"),
  checkPermission("invoices", "readonly"),
  invoiceController.downloadInvoice
);

// DELETE /api/invoices/:id (Delete - requires write permission)
router.delete(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "write"),
  checkPermission("invoices", "read-write"),
  invoiceController.deleteInvoice
);

// PUT /api/invoices/:id (Update full invoice - requires write permission)
router.put(
  "/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "write"),
  checkPermission("invoices", "read-write"),
  invoiceController.updateInvoice
);

// PUT /api/invoices/status/:id (Update status - requires write permission)
router.put(
  "/status/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "write"),
  checkPermission("invoices", "read-write"),
  invoiceController.updateStatus
);

// routes/invoiceRoutes.js (append before module.exports)
router.patch(
  "/number/:id",
  requireAuth,
  subscriptionGate,
  restrictByPlan("invoices", "write"),
  checkPermission("invoices", "read-write"),
  invoiceController.updateInvoiceNumber
);

module.exports = router;
