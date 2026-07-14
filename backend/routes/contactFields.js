const express = require('express');
const router = express.Router();
const contactFieldsController = require('../controllers/contactFieldsController');
const authMiddleware = require('../middlewares/auth');
const userSync = require('../middlewares/userSync');
const checkPermission = require('../middlewares/checkPermission'); // Optional: for future use

// Bundle middlewares for cleaner route definitions
const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');
const restrictByPlan = require('../middlewares/restrictByPlan');

// ==========================================
// SPECIFIC / STATIC ROUTES 
// (These MUST go before the /:id routes below)
// ==========================================

// GET master list of contact field categories
router.get('/categories',
  requireAuth,
  subscriptionGate,
  restrictByPlan('contacts', 'read'),
  contactFieldsController.getContactFieldCategories
);

// ADD a new category
router.post('/categories',
  requireAuth,
  subscriptionGate,
  restrictByPlan('contacts', 'write'),
  contactFieldsController.addCategory
);

// 👉 UPDATE (Rename) an existing category
router.put('/categories',
  requireAuth,
  subscriptionGate,
  restrictByPlan('contacts', 'write'),
  contactFieldsController.updateCategory
);

// 👉 DELETE a category
router.delete('/categories/:categoryName',
  requireAuth,
  subscriptionGate,
  restrictByPlan('contacts', 'write'),
  contactFieldsController.deleteCategory
);

// ADD multiple custom fields in bulk
router.post('/bulk',
  requireAuth,
  subscriptionGate,
  restrictByPlan('contacts', 'write'),
  contactFieldsController.addBulkFields
);

// READ all contact fields (history/logs)
router.get('/all',
  requireAuth,
  subscriptionGate,
  restrictByPlan('contacts', 'read'),
  contactFieldsController.getAllContactFields
);

// READ latest contact fields
router.get('/latest',
  requireAuth,
  subscriptionGate,
  restrictByPlan('contacts', 'read'),
  contactFieldsController.getLatestContactFields
);


// ==========================================
// ROOT ROUTES
// (Operations affecting the current user/org directly)
// ==========================================

// READ contact fields
router.get('/',
  requireAuth,
  subscriptionGate,
  restrictByPlan('contacts', 'read'),
  contactFieldsController.getContactFields
);

// CREATE contact fields (Initial setup)
router.post('/',
  requireAuth,
  subscriptionGate,
  restrictByPlan('contacts', 'write'),
  contactFieldsController.createContactFields
);

// UPDATE contact fields
router.put('/',
  requireAuth,
  subscriptionGate,
  restrictByPlan('contacts', 'write'),
  contactFieldsController.updateContactFields
);

// DELETE contact fields
router.delete('/',
  requireAuth,
  subscriptionGate,
  restrictByPlan('contacts', 'write'),
  contactFieldsController.deleteContactFields
);


// ==========================================
// DYNAMIC ROUTES
// (These catch any URLs with an ID at the end)
// ==========================================

// READ contact fields by ID
router.get('/:id',
  requireAuth,
  subscriptionGate,
  restrictByPlan('contacts', 'read'),
  contactFieldsController.getContactFieldsById
);

// UPDATE contact fields by ID
router.put('/:id',
  requireAuth,
  subscriptionGate,
  restrictByPlan('contacts', 'write'),
  contactFieldsController.updateContactFieldsById
);

// DELETE contact fields by ID
router.delete('/:id',
  requireAuth,
  subscriptionGate,
  restrictByPlan('contacts', 'write'),
  contactFieldsController.deleteContactFieldsById
);

module.exports = router;