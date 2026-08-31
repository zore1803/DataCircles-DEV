const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const sessionAuth = require('../middlewares/sessionAuth');
const csrfCheck = require('../middlewares/csrfCheck');

const requireAuth = [sessionAuth, csrfCheck];
const subscriptionGate = require('../middlewares/subscriptionGate');

// GET organization code
router.get('/:id', requireAuth, subscriptionGate,
  organizationController.getOrganizationCode
);

// UPDATE organization code (manual update)
router.put('/:id', requireAuth, subscriptionGate,
  organizationController.updateOrganizationCode
);

// RESET organization code (auto-generate new one)
router.post('/:id/reset-code', requireAuth, subscriptionGate,
  organizationController.resetOrganizationCode
);

module.exports = router;
