const express = require('express');
const router = express.Router();
const itemFieldsController = require('../controllers/itemFieldsController');
const authMiddleware = require('../middlewares/auth');
const userSync = require('../middlewares/userSync');
const checkPermission = require('../middlewares/checkPermission');

// Bundle middlewares for cleaner route definitions
const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');

// NOTE: gated with checkPermission("items", ...) rather than
// restrictByPlan("items", ...) — "items" is not a plan module in
// PlanConfig.features.modules, so restrictByPlan would reject every request
// with "Module 'items' not available in your plan". This matches how
// routes/itemRoutes.js guards the Item endpoints themselves.

// ==========================================
// SPECIFIC / STATIC ROUTES
// (These MUST go before the /:id routes)
// ==========================================

// GET master list of item field categories
router.get('/categories', requireAuth, subscriptionGate, checkPermission('items', 'readonly'), itemFieldsController.getItemFieldCategories);

// ADD a new category
router.post('/categories', requireAuth, subscriptionGate, checkPermission('items', 'read-write'), itemFieldsController.addCategory);

// UPDATE (Rename) an existing category
router.put('/categories', requireAuth, subscriptionGate, checkPermission('items', 'read-write'), itemFieldsController.updateCategory);

// DELETE a category
router.delete('/categories/:categoryName', requireAuth, subscriptionGate, checkPermission('items', 'read-write'), itemFieldsController.deleteCategory);

// ADD multiple custom fields in bulk
router.post('/bulk', requireAuth, subscriptionGate, checkPermission('items', 'read-write'), itemFieldsController.addBulkFields);

// READ all item fields (history/logs - if needed)
router.get('/all', requireAuth, subscriptionGate, checkPermission('items', 'readonly'), itemFieldsController.getAllItemFields);

// READ latest item fields
router.get('/latest', requireAuth, subscriptionGate, checkPermission('items', 'readonly'), itemFieldsController.getLatestItemFields);


// ==========================================
// ROOT ROUTES
// ==========================================

// CREATE item fields (Initial setup)
router.post('/', requireAuth, subscriptionGate, checkPermission('items', 'read-write'), itemFieldsController.createItemFields);

// READ item fields for current user/org
router.get('/', requireAuth, subscriptionGate, checkPermission('items', 'readonly'), itemFieldsController.getItemFields);

// UPDATE item fields
router.put('/', requireAuth, subscriptionGate, checkPermission('items', 'read-write'), itemFieldsController.updateItemFields);

// DELETE item fields
router.delete('/', requireAuth, subscriptionGate, checkPermission('items', 'read-write'), itemFieldsController.deleteItemFields);


// ==========================================
// DYNAMIC ROUTES
// (Catches any URLs with an ID at the end)
// ==========================================

// READ item fields by ID
router.get('/:id', requireAuth, subscriptionGate, checkPermission('items', 'readonly'), itemFieldsController.getItemFieldsById);

// UPDATE item fields by ID
router.put('/:id', requireAuth, subscriptionGate, checkPermission('items', 'read-write'), itemFieldsController.updateItemFieldsById);

// DELETE item fields by ID
router.delete('/:id', requireAuth, subscriptionGate, checkPermission('items', 'read-write'), itemFieldsController.deleteItemFieldsById);

module.exports = router;
