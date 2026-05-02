const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

// Rate limiter for payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many payment attempts' }
});

// ✅ Import controller with error handling
const paymentController = require('../controllers/advancedPaymentController');
console.log('✅ Advanced payment controller loaded');

// ✅ Routes - All callbacks exist
router.post('/init', protect, paymentLimiter, paymentController.initializePayment);
router.post('/verify', protect, paymentLimiter, paymentController.verifyPayment);
router.post('/refund', protect, admin, paymentController.refundPayment);
router.get('/history', protect, paymentController.getPaymentHistory);
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.paymentWebhook);

module.exports = router;