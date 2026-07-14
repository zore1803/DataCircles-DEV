const express = require('express');
const router = express.Router();
const companyFieldsController = require('../controllers/companyFieldsController');
const authMiddleware = require('../middlewares/auth');
const userSync = require('../middlewares/userSync');
const checkPermission = require('../middlewares/checkPermission'); // Unused currently, but kept for your future use

const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');
const restrictByPlan = require('../middlewares/restrictByPlan');

// ==========================================
// SPECIFIC / STATIC ROUTES 
// (These MUST go before the /:id routes below)
// ==========================================

// READ latest company fields
router.get('/',
  requireAuth,
  subscriptionGate,
  restrictByPlan('companies', 'read'),
  companyFieldsController.getLatestCompanyFields
);

// CREATE company fields (Initial setup)
router.post('/',
  requireAuth,
  subscriptionGate,
  restrictByPlan('companies', 'write'),
  companyFieldsController.createCompanyFields
);

// GET master list of field categories
router.get('/categories',
  requireAuth,
  subscriptionGate,
  restrictByPlan('companies', 'read'),
  companyFieldsController.getCompanyFieldCategories
);

// ADD a new category
router.post('/categories',
  requireAuth,
  subscriptionGate,
  restrictByPlan('companies', 'write'),
  companyFieldsController.addCategory
);

// 👉 UPDATE (Rename) an existing category
router.put('/categories',
  requireAuth,
  subscriptionGate,
  restrictByPlan('companies', 'write'),
  companyFieldsController.updateCategory
);

// 👉 DELETE a category
router.delete('/categories/:categoryName',
  requireAuth,
  subscriptionGate,
  restrictByPlan('companies', 'write'),
  companyFieldsController.deleteCategory
);

// ADD multiple custom fields in bulk
router.post('/bulk',
  requireAuth,
  subscriptionGate,
  restrictByPlan('companies', 'write'),
  companyFieldsController.addBulkFields
);

// READ all company fields (history/logs)
router.get('/all',
  requireAuth,
  subscriptionGate,
  restrictByPlan('companies', 'read'),
  companyFieldsController.getAllCompanyFields
);

// ==========================================
// DYNAMIC ROUTES
// (These catch any URLs with an ID at the end)
// ==========================================

// READ company fields by ID
router.get('/:id',
  requireAuth,
  subscriptionGate,
  restrictByPlan('companies', 'read'),
  companyFieldsController.getCompanyFieldsById
);

// UPDATE company fields by ID
router.put('/:id',
  requireAuth,
  subscriptionGate,
  restrictByPlan('companies', 'write'),
  companyFieldsController.updateCompanyFields
);

// DELETE company fields by ID
router.delete('/:id',
  requireAuth,
  subscriptionGate,
  restrictByPlan('companies', 'write'),
  companyFieldsController.deleteCompanyFields
);

// Optional: GET categories for one specific company record (If you used Option 2 from earlier)
// router.get('/:id/categories', requireAuth, companyFieldsController.getCategoriesByCompanyId);

module.exports = router;