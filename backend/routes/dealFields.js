const express = require('express');
const router = express.Router();
const dealFieldsController = require('../controllers/dealFieldsController');
const authMiddleware = require('../middlewares/auth');
const userSync = require('../middlewares/userSync');
const restrictByPlan = require('../middlewares/restrictByPlan');

// Bundle middlewares for cleaner route definitions
const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');

// ==========================================
// SPECIFIC / STATIC ROUTES 
// (These MUST go before the /:id routes below)
// ==========================================

// GET master list of deal field categories
router.get('/categories', requireAuth, subscriptionGate, restrictByPlan('deals', 'read'), dealFieldsController.getDealFieldCategories);

// ADD a new category
router.post('/categories', requireAuth, subscriptionGate, restrictByPlan('deals', 'write'), dealFieldsController.addCategory);

// ADD multiple custom fields in bulk
router.post('/bulk', requireAuth, subscriptionGate, restrictByPlan('deals', 'write'), dealFieldsController.addBulkFields);

// READ all deal fields (history/logs)
router.get('/all', requireAuth, subscriptionGate, restrictByPlan('deals', 'read'), dealFieldsController.getAllDealFields);

// READ latest deal fields
router.get('/latest', requireAuth, subscriptionGate, restrictByPlan('deals', 'read'), dealFieldsController.getLatestDealFields);

// PUT route to rename a category
router.put('/categories', requireAuth, subscriptionGate, restrictByPlan('deals', 'write'), dealFieldsController.updateCategory);

// DELETE route to remove a category (uses URL param for the name)
router.delete('/categories/:categoryName', requireAuth, subscriptionGate, restrictByPlan('deals', 'write'), dealFieldsController.deleteCategory);


// ==========================================
// ROOT ROUTES
// ==========================================

// READ deal fields
router.get('/', requireAuth, subscriptionGate, restrictByPlan('deals', 'read'), dealFieldsController.getDealFields);

// CREATE deal fields (Initial setup)
router.post('/', requireAuth, subscriptionGate, restrictByPlan('deals', 'write'), dealFieldsController.createDealFields);

// UPDATE deal fields
router.put('/', requireAuth, subscriptionGate, restrictByPlan('deals', 'write'), dealFieldsController.updateDealFields);

// DELETE deal fields
router.delete('/', requireAuth, subscriptionGate, restrictByPlan('deals', 'write'), dealFieldsController.deleteDealFields);


// ==========================================
// DYNAMIC ROUTES
// (Catches any URLs with an ID at the end)
// ==========================================

// READ deal fields by ID
router.get('/:id', requireAuth, subscriptionGate, restrictByPlan('deals', 'read'), dealFieldsController.getDealFieldsById);

// UPDATE deal fields by ID
router.put('/:id', requireAuth, subscriptionGate, restrictByPlan('deals', 'write'), dealFieldsController.updateDealFieldsById);

// DELETE deal fields by ID
router.delete('/:id', requireAuth, subscriptionGate, restrictByPlan('deals', 'write'), dealFieldsController.deleteDealFieldsById);

module.exports = router;