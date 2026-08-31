const express = require('express');
const router = express.Router();
const taskFieldsController = require('../controllers/taskFieldsController');
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

// GET master list of task field categories
router.get('/categories', requireAuth, subscriptionGate, restrictByPlan('tasks', 'read'), taskFieldsController.getTaskFieldCategories);

// ADD a new category
router.post('/categories', requireAuth, subscriptionGate, restrictByPlan('tasks', 'write'), taskFieldsController.addCategory);

// 👉 UPDATE (Rename) an existing category
router.put('/categories', requireAuth, subscriptionGate, restrictByPlan('tasks', 'write'), taskFieldsController.updateCategory);

// 👉 DELETE a category
router.delete('/categories/:categoryName', requireAuth, subscriptionGate, restrictByPlan('tasks', 'write'), taskFieldsController.deleteCategory);

// ADD multiple custom fields in bulk
router.post('/bulk', requireAuth, subscriptionGate, restrictByPlan('tasks', 'write'), taskFieldsController.addBulkFields);

// READ all task fields (history/logs - if needed)
router.get('/all', requireAuth, subscriptionGate, restrictByPlan('tasks', 'read'), taskFieldsController.getAllTaskFields);

// READ latest task fields
router.get('/latest', requireAuth, subscriptionGate, restrictByPlan('tasks', 'read'), taskFieldsController.getLatestTaskFields);


// ==========================================
// ROOT ROUTES
// ==========================================

// CREATE task fields (Initial setup)
router.post('/', requireAuth, subscriptionGate, restrictByPlan('tasks', 'write'), taskFieldsController.createTaskFields);

// READ task fields for current user/org
router.get('/', requireAuth, subscriptionGate, restrictByPlan('tasks', 'read'), taskFieldsController.getTaskFields);

// UPDATE task fields
router.put('/', requireAuth, subscriptionGate, restrictByPlan('tasks', 'write'), taskFieldsController.updateTaskFields);

// DELETE task fields
router.delete('/', requireAuth, subscriptionGate, restrictByPlan('tasks', 'write'), taskFieldsController.deleteTaskFields);


// ==========================================
// DYNAMIC ROUTES
// (Catches any URLs with an ID at the end)
// ==========================================

// READ task fields by ID
router.get('/:id', requireAuth, subscriptionGate, restrictByPlan('tasks', 'read'), taskFieldsController.getTaskFieldsById);

// UPDATE task fields by ID
router.put('/:id', requireAuth, subscriptionGate, restrictByPlan('tasks', 'write'), taskFieldsController.updateTaskFieldsById);

// DELETE task fields by ID
router.delete('/:id', requireAuth, subscriptionGate, restrictByPlan('tasks', 'write'), taskFieldsController.deleteTaskFieldsById);

module.exports = router;