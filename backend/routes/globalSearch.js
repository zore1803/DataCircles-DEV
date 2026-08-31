const express = require('express');
const router = express.Router();
const sessionAuth = require('../middlewares/sessionAuth');
const csrfCheck = require('../middlewares/csrfCheck');
const {globalSearch} = require('../controllers/globalSearchController');

const requireAuth = [sessionAuth, csrfCheck];
const subscriptionGate = require('../middlewares/subscriptionGate');

router.get('/',
  requireAuth,
  subscriptionGate,
  globalSearch
);


module.exports = router;
