// routes/dealSettings.js
const express = require('express');
const router = express.Router();
const sessionAuth = require('../middlewares/sessionAuth');
const csrfCheck = require('../middlewares/csrfCheck');
const subscriptionGate = require('../middlewares/subscriptionGate');
const dealSettingsController = require('../controllers/dealSettings.controller');

const requireAuth = [sessionAuth, csrfCheck];

// GET /deal-settings
router.get('/', requireAuth, subscriptionGate, dealSettingsController.getDealSettings);

// PUT /deal-settings
router.put('/', requireAuth, subscriptionGate, dealSettingsController.updateDealSettings);

module.exports = router;
