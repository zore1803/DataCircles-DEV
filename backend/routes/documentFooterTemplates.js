const express = require('express');
const router = express.Router();
const sessionAuth = require('../middlewares/sessionAuth');
const csrfCheck = require('../middlewares/csrfCheck');
const subscriptionGate = require('../middlewares/subscriptionGate');
const controller = require('../controllers/documentFooterTemplateController');

const requireAuth = [sessionAuth, csrfCheck];

// Saved Notes / Terms blocks, listed per document type.
router.get('/', requireAuth, subscriptionGate, controller.listTemplates);
router.post('/', requireAuth, subscriptionGate, controller.createTemplate);
router.patch('/:id', requireAuth, subscriptionGate, controller.updateTemplate);
router.delete('/:id', requireAuth, subscriptionGate, controller.deleteTemplate);

module.exports = router;
