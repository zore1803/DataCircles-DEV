const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const contactFolderController = require('../controllers/contactFolderController');

const requireAuth = [authMiddleware, require('../middlewares/userSync')];
const subscriptionGate = require('../middlewares/subscriptionGate');
const restrictByPlan = require('../middlewares/restrictByPlan');

// CREATE a folder
router.post('/',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'write'),
  contactFolderController.createFolder
);

// GET all folders for the user's organization
router.get('/',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'read'),
  contactFolderController.getAllFolders
);

// GET all folders created by the current user
router.get('/my-folders',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'read'),
  contactFolderController.getMyFolders
);

// GET contacts not in any folder (for organization)
router.get('/unassigned/contacts',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'read'),
  contactFolderController.getUnassignedContacts
);

// GET a single folder
router.get('/:id',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'read'),
  contactFolderController.getFolderById
);

// UPDATE folder (name or contacts)
router.put('/:id',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'write'),
  contactFolderController.updateFolder
);

// ADD contact to folder
router.put('/:id/add-contact',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'write'),
  contactFolderController.addContactToFolder
);

// REMOVE contact from folder
router.put('/:id/remove-contact',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'write'),
  contactFolderController.removeContactFromFolder
);

// DELETE a folder
router.delete('/:id',
  requireAuth,
  subscriptionGate,
  restrictByPlan('folders', 'write'),
  contactFolderController.deleteFolder
);

module.exports = router;
