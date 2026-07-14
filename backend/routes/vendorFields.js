const express = require('express');
const router = express.Router();
const vendorFieldsController = require('../controllers/vendorFieldsController');
const authMiddleware = require('../middlewares/auth');
const userSync = require('../middlewares/userSync');

// Bundle middlewares for cleaner route definitions
const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');
const restrictByPlan = require('../middlewares/restrictByPlan');

// ==========================================
// SPECIFIC / STATIC ROUTES 
// (These MUST go before the /:id routes)
// ==========================================

// GET master list of vendor field categories
router.get('/categories', requireAuth, subscriptionGate, restrictByPlan('vendors', 'read'), vendorFieldsController.getVendorFieldCategories);

// ADD a new category
router.post('/categories', requireAuth, subscriptionGate, restrictByPlan('vendors', 'write'), vendorFieldsController.addCategory);

// 👉 UPDATE (Rename) an existing category
router.put('/categories', requireAuth, subscriptionGate, restrictByPlan('vendors', 'write'), vendorFieldsController.updateCategory);

// 👉 DELETE a category
router.delete('/categories/:categoryName', requireAuth, subscriptionGate, restrictByPlan('vendors', 'write'), vendorFieldsController.deleteCategory);

// ADD multiple custom fields in bulk
router.post('/bulk', requireAuth, subscriptionGate, restrictByPlan('vendors', 'write'), vendorFieldsController.addBulkFields);

// READ all vendor fields (history/logs - if needed)
router.get('/all', requireAuth, subscriptionGate, restrictByPlan('vendors', 'read'), vendorFieldsController.getAllVendorFields);

// READ latest vendor fields
router.get('/latest', requireAuth, subscriptionGate, restrictByPlan('vendors', 'read'), vendorFieldsController.getLatestVendorFields);


// ==========================================
// ROOT ROUTES
// ==========================================

// CREATE vendor fields (Initial setup)
router.post('/', requireAuth, subscriptionGate, restrictByPlan('vendors', 'write'), vendorFieldsController.createVendorFields);

// READ vendor fields for current user/org
router.get('/', requireAuth, subscriptionGate, restrictByPlan('vendors', 'read'), vendorFieldsController.getVendorFields);

// UPDATE vendor fields
router.put('/', requireAuth, subscriptionGate, restrictByPlan('vendors', 'write'), vendorFieldsController.updateVendorFields);

// DELETE vendor fields
router.delete('/', requireAuth, subscriptionGate, restrictByPlan('vendors', 'write'), vendorFieldsController.deleteVendorFields);


// ==========================================
// DYNAMIC ROUTES
// (Catches any URLs with an ID at the end)
// ==========================================

// READ vendor fields by ID
router.get('/:id', requireAuth, subscriptionGate, restrictByPlan('vendors', 'read'), vendorFieldsController.getVendorFieldsById);

// UPDATE vendor fields by ID
router.put('/:id', requireAuth, subscriptionGate, restrictByPlan('vendors', 'write'), vendorFieldsController.updateVendorFieldsById);

// DELETE vendor fields by ID
router.delete('/:id', requireAuth, subscriptionGate, restrictByPlan('vendors', 'write'), vendorFieldsController.deleteVendorFieldsById);

module.exports = router;