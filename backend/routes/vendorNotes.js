const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const userSync = require('../middlewares/userSync');
const vendorNoteController = require('../controllers/vendorNoteController');

const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');
const restrictByPlan = require('../middlewares/restrictByPlan');

// CREATE Vendor Note
router.post('/',
  requireAuth,
  subscriptionGate,
  restrictByPlan('vendors', 'write'),
  vendorNoteController.createVendorNote
);

// GET all vendor notes for organization
router.get('/',
  requireAuth,
  subscriptionGate,
  restrictByPlan('vendors', 'read'),
  vendorNoteController.getAllVendorNotes
);

// GET all notes for a vendor
router.get('/vendor/:vendorId',
  requireAuth,
  subscriptionGate,
  restrictByPlan('vendors', 'read'),
  vendorNoteController.getNotesByVendor
);

// GET single note
router.get('/:id',
  requireAuth,
  subscriptionGate,
  restrictByPlan('vendors', 'read'),
  vendorNoteController.getVendorNoteById
);

// UPDATE note content
router.put('/:id',
  requireAuth,
  subscriptionGate,
  restrictByPlan('vendors', 'write'),
  vendorNoteController.updateVendorNote
);

// DELETE vendor note
router.delete('/:id',
  requireAuth,
  subscriptionGate,
  restrictByPlan('vendors', 'write'),
  vendorNoteController.deleteVendorNote
);

module.exports = router;
