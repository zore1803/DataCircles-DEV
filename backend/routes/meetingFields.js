const express = require('express');
const router = express.Router();
const meetingFieldsController = require('../controllers/meetingFieldsController');
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

// GET master list of meeting field categories
router.get('/categories', requireAuth, subscriptionGate, restrictByPlan('meetings', 'read'), meetingFieldsController.getMeetingFieldCategories);

// ADD a new category
router.post('/categories', requireAuth, subscriptionGate, restrictByPlan('meetings', 'write'), meetingFieldsController.addCategory);

// 👉 UPDATE (Rename) an existing category
router.put('/categories', requireAuth, subscriptionGate, restrictByPlan('meetings', 'write'), meetingFieldsController.updateCategory);

// 👉 DELETE a category
router.delete('/categories/:categoryName', requireAuth, subscriptionGate, restrictByPlan('meetings', 'write'), meetingFieldsController.deleteCategory);

// ADD multiple custom fields in bulk
router.post('/bulk', requireAuth, subscriptionGate, restrictByPlan('meetings', 'write'), meetingFieldsController.addBulkFields);

// READ all meeting fields (history/logs - if needed)
router.get('/all', requireAuth, subscriptionGate, restrictByPlan('meetings', 'read'), meetingFieldsController.getAllMeetingFields);

// READ latest meeting fields
router.get('/latest', requireAuth, subscriptionGate, restrictByPlan('meetings', 'read'), meetingFieldsController.getLatestMeetingFields);


// ==========================================
// ROOT ROUTES
// ==========================================

// CREATE meeting fields (Initial setup)
router.post('/', requireAuth, subscriptionGate, restrictByPlan('meetings', 'write'), meetingFieldsController.createMeetingFields);

// READ meeting fields for current user/org
router.get('/', requireAuth, subscriptionGate, restrictByPlan('meetings', 'read'), meetingFieldsController.getMeetingFields);

// UPDATE meeting fields
router.put('/', requireAuth, subscriptionGate, restrictByPlan('meetings', 'write'), meetingFieldsController.updateMeetingFields);

// DELETE meeting fields
router.delete('/', requireAuth, subscriptionGate, restrictByPlan('meetings', 'write'), meetingFieldsController.deleteMeetingFields);


// ==========================================
// DYNAMIC ROUTES
// (Catches any URLs with an ID at the end)
// ==========================================

// READ meeting fields by ID
router.get('/:id', requireAuth, subscriptionGate, restrictByPlan('meetings', 'read'), meetingFieldsController.getMeetingFieldsById);

// UPDATE meeting fields by ID
router.put('/:id', requireAuth, subscriptionGate, restrictByPlan('meetings', 'write'), meetingFieldsController.updateMeetingFieldsById);

// DELETE meeting fields by ID
router.delete('/:id', requireAuth, subscriptionGate, restrictByPlan('meetings', 'write'), meetingFieldsController.deleteMeetingFieldsById);

module.exports = router;