const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const {globalSearch} = require('../controllers/globalSearchController');

const requireAuth = [authMiddleware, require('../middlewares/userSync')];
const subscriptionGate = require('../middlewares/subscriptionGate');

router.get('/',
  requireAuth,
  subscriptionGate,
  globalSearch
);


module.exports = router;
