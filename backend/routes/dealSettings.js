// routes/dealSettings.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const userSync = require('../middlewares/userSync');
const subscriptionGate = require('../middlewares/subscriptionGate');
const dealSettingsController = require('../controllers/dealSettings.controller');

const requireAuth = [authMiddleware, userSync];

// GET /deal-settings
router.get('/', requireAuth, subscriptionGate, dealSettingsController.getDealSettings);

// PUT /deal-settings
router.put('/', requireAuth, subscriptionGate, dealSettingsController.updateDealSettings);

module.exports = router;
