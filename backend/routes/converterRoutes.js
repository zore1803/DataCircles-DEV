const express = require('express');
const router = express.Router();
const converterController = require('../controllers/converterController');
const authMiddleware = require("../middlewares/auth");
const checkPermission = require("../middlewares/checkPermission");
const userSync = require("../middlewares/userSync");
const restrictByPlan = require('../middlewares/restrictByPlan');

const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');

// Invoice conversions
router.post('/invoices/convert-to-proforma/:id', requireAuth, subscriptionGate, restrictByPlan('invoices', 'write'), checkPermission('invoices', 'read-write'), converterController.convertToProformaInvoice);
router.post('/invoices/convert-to-quotation/:id', requireAuth, subscriptionGate, restrictByPlan('invoices', 'write'), checkPermission('invoices', 'read-write'), converterController.convertToQuotation);
router.post('/invoices/convert-to-delivery-challan/:id', requireAuth, subscriptionGate, restrictByPlan('invoices', 'write'), checkPermission('invoices', 'read-write'), converterController.convertToDeliveryChallan);

// Proforma Invoice conversions
router.post('/performa-invoices/convert-to-tax/:id', requireAuth, subscriptionGate, restrictByPlan('invoices', 'write'), checkPermission('invoices', 'read-write'), converterController.convertToTaxInvoice);
router.post('/performa-invoices/convert-to-quotation/:id', requireAuth, subscriptionGate, restrictByPlan('invoices', 'write'), checkPermission('invoices', 'read-write'), converterController.convertProformaToQuotation);
router.post('/performa-invoices/convert-to-delivery-challan/:id', requireAuth, subscriptionGate, restrictByPlan('invoices', 'write'), checkPermission('invoices', 'read-write'), converterController.convertProformaToDeliveryChallan);

// Quotation conversions
router.post('/quotations/convert-to-tax/:id', requireAuth, subscriptionGate, restrictByPlan('quotations', 'write'), checkPermission('quotations', 'read-write'), converterController.convertQuotationToTaxInvoice);
router.post('/quotations/convert-to-proforma/:id', requireAuth, subscriptionGate, restrictByPlan('quotations', 'write'), checkPermission('quotations', 'read-write'), converterController.convertQuotationToProforma);
router.post('/quotations/convert-to-delivery-challan/:id', requireAuth, subscriptionGate, restrictByPlan('quotations', 'write'), checkPermission('quotations', 'read-write'), converterController.convertQuotationToDeliveryChallan);

// Delivery Challan conversions
router.post('/delivery-challans/convert-to-tax/:id', requireAuth, subscriptionGate, restrictByPlan('delivery-challans', 'write'), checkPermission('delivery-challans', 'read-write'), converterController.convertDeliveryChallanToTaxInvoice);
router.post('/delivery-challans/convert-to-proforma/:id', requireAuth, subscriptionGate, restrictByPlan('delivery-challans', 'write'), checkPermission('delivery-challans', 'read-write'), converterController.convertDeliveryChallanToProforma);
router.post('/delivery-challans/convert-to-quotation/:id', requireAuth, subscriptionGate, restrictByPlan('delivery-challans', 'write'), checkPermission('delivery-challans', 'read-write'), converterController.convertDeliveryChallanToQuotation);

module.exports = router;