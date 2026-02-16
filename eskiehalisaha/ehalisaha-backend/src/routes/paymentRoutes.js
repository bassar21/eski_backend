const express = require('express');
const PaymentController = require('../controllers/paymentController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/callback', PaymentController.callback);
router.post('/refund', authMiddleware, roleMiddleware('Admin'), PaymentController.refund);

module.exports = router;
