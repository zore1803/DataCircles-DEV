const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const userSync = require('../middlewares/userSync');
const noteController = require('../controllers/noteController');

const requireAuth = [authMiddleware, userSync];
const subscriptionGate = require('../middlewares/subscriptionGate');

// CREATE Note
router.post('/',
  requireAuth,
  subscriptionGate,
  noteController.createNote
);

router.post("/bulk", requireAuth, subscriptionGate, noteController.createBulkNotes);
router.post("/bulk-contact-notes", requireAuth, subscriptionGate, noteController.createBulkContactNotes);

// GET all notes for organization
router.get('/',
  requireAuth,
  subscriptionGate,
  noteController.getAllNotes
);

// GET all notes for a company (specific route before generic /:id)
router.get('/company/:companyId',
  requireAuth,
  subscriptionGate,
  noteController.getNotesByCompany
);

// GET all notes for a contact (specific route before generic /:id)
router.get('/contact/:contactId',
  requireAuth,
  subscriptionGate,
  noteController.getNotesByContact
);

// GET single note
router.get('/:id',
  requireAuth,
  subscriptionGate,
  noteController.getNoteById
);

// UPDATE note content or tags
router.put('/:id',
  requireAuth,
  subscriptionGate,
  noteController.updateNote
);

// DELETE note
router.delete('/:id',
  requireAuth,
  subscriptionGate,
  noteController.deleteNote
);

module.exports = router;
