const express = require('express');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { initializePayment, verifyPayment } = require('../controllers/paymentBookingController');
const { generateBookingUpiQr, submitManualPayment, approveManualPayment } = require('../controllers/paymentUpiManualController');
const { getPaymentStatus, getPaymentHistory, refundPayment, paymentWebhook } = require('../controllers/paymentAdminWebhookController');

// ✅ Import Cache Invalidation Helper
const { invalidateCache } = require('../middleware/cache');

const router = express.Router();

// Webhook (Public route, no auth) - Clears cache when gateway updates payment status
router.post('/webhook', async (req, res, next) => {
  await paymentWebhook(req, res, next);
  await invalidateCache('etr_cache:*');
});

// Protected routes
router.use(protect);

router.post('/init', initializePayment);

// Verify payment updates booking status -> Invalidate cache
router.post('/verify', async (req, res, next) => {
  await verifyPayment(req, res, next);
  if (res.statusCode === 200 || res.statusCode === 201) {
    await invalidateCache('etr_cache:*');
  }
});

// Private user financial data -> NOT cached for security
router.get('/history', getPaymentHistory);
router.get('/status/:bookingId', getPaymentStatus);

router.post('/booking-upi-qr', generateBookingUpiQr);
router.post('/manual', submitManualPayment);

// Admin manual payment approval -> Invalidate cache
router.post('/manual/:paymentId/approve', adminOnly, async (req, res, next) => {
  await approveManualPayment(req, res, next);
  if (res.statusCode === 200) {
    await invalidateCache('etr_cache:*');
  }
});

// Admin refund -> Invalidate cache
router.post('/refund', adminOnly, async (req, res, next) => {
  await refundPayment(req, res, next);
  if (res.statusCode === 200) {
    await invalidateCache('etr_cache:*');
  }
});

module.exports = router;