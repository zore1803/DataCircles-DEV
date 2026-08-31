const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const sessionAuth = require('../middlewares/sessionAuth');
const csrfCheck = require('../middlewares/csrfCheck');

// No subscriptionGate/restrictByPlan here: the wallet is independent of the
// subscription, so plan state must not gate access to prepaid credits.
const requireAuth = [sessionAuth, csrfCheck];

router.get('/', requireAuth, walletController.getWallet);
router.get('/transactions', requireAuth, walletController.getTransactions);
router.post('/order', requireAuth, walletController.createOrder);
router.post('/verify', requireAuth, walletController.verifyPayment);

module.exports = router;
