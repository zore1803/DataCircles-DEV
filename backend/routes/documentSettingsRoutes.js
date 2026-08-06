const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const userSync = require('../middlewares/userSync');
const subscriptionGate = require('../middlewares/subscriptionGate');
const {
  getDocumentSettings,
  updateDocumentSettings,
  getSignatures,
  saveSignature,
  deleteSignature,
  setDefaultSignature,
} = require('../controllers/documentSettingsController');

const requireAuth = [authMiddleware, userSync];

router.get('/', requireAuth, subscriptionGate, getDocumentSettings);
router.put('/', requireAuth, subscriptionGate, updateDocumentSettings);

router.get('/signatures', requireAuth, subscriptionGate, getSignatures);
router.post('/signatures', requireAuth, subscriptionGate, saveSignature);
router.delete('/signatures/:id', requireAuth, subscriptionGate, deleteSignature);
router.patch('/signatures/:id/default', requireAuth, subscriptionGate, setDefaultSignature);


module.exports = router;
