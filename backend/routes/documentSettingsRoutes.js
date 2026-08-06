const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const userSync = require('../middlewares/userSync');
const subscriptionGate = require('../middlewares/subscriptionGate');
const { getDocumentSettings, updateDocumentSettings } = require('../controllers/documentSettingsController');

const requireAuth = [authMiddleware, userSync];

router.get('/', requireAuth, subscriptionGate, getDocumentSettings);
router.put('/', requireAuth, subscriptionGate, updateDocumentSettings);

module.exports = router;
