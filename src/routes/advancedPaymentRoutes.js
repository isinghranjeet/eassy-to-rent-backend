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
let paymentController;
try {
  paymentController = require('../controllers/advancedPaymentController');
  console.log('✅ Advanced payment controller loaded');
} catch (error) {
  console.error('❌ Payment controller error:', error.message);
  // Fallback functions
  paymentController = {
    initializePayment: (req, res) => res.status(501).json({ success: false, message: 'Payment service not configured' }),
    verifyPayment: (req, res) => res.status(501).json({ success: false, message: 'Payment service not configured' }),
    refundPayment: (req, res) => res.status(501).json({ success: false, message: 'Payment service not configured' }),
    getPaymentHistory: (req, res) => res.status(501).json({ success: false, message: 'Payment service not configured' }),
    paymentWebhook: (req, res) => res.status(501).json({ success: false, message: 'Payment service not configured' })
  };
}

// ✅ Routes - All callbacks exist
router.post('/init', protect, paymentLimiter, paymentController.initializePayment);
router.post('/verify', protect, paymentLimiter, paymentController.verifyPayment);
router.post('/refund', protect, admin, paymentController.refundPayment);
router.get('/history', protect, paymentController.getPaymentHistory);
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.paymentWebhook);

module.exports = router;