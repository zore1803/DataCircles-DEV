const express = require('express');
const router = express.Router();
const industryController = require('../controllers/industryController');
const sessionAuth = require('../middlewares/sessionAuth');
const csrfCheck = require('../middlewares/csrfCheck');

const requireAuth = [sessionAuth, csrfCheck];
const subscriptionGate = require('../middlewares/subscriptionGate');

// CREATE custom industry
router.post('/', requireAuth, subscriptionGate, industryController.createIndustry);

// READ all (default + org custom)
router.get('/', requireAuth, subscriptionGate, industryController.getIndustries);

// UPDATE custom industry
router.put('/:id', requireAuth, subscriptionGate, industryController.updateIndustry);

// DELETE custom industry
router.delete('/:id', requireAuth, subscriptionGate, industryController.deleteIndustry);

module.exports = router;
