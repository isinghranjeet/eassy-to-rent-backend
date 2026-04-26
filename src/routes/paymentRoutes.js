// backend/src/routes/paymentRoutes.js
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  createCallCreditOrder,
  verifyCallCreditPayment,
  getCreditBalance,
  useContactCredit,
  generateUPIQR,
  verifyUPIPayment
} = require('../controllers/paymentController');

// ✅ Import advanced booking payment controllers
let advancedPayment;
try {
  advancedPayment = require('../controllers/advancedPaymentController');
  console.log('✅ advancedPaymentController loaded successfully');
} catch (err) {
  console.error('❌ Failed to load advancedPaymentController:', err.message);
  advancedPayment = {};
}

const { initializePayment, verifyPayment, getPaymentHistory } = advancedPayment;

const router = express.Router();

// All routes require authentication
router.use(protect);

// ─── Booking Payment Routes (Razorpay / Stripe) ───
if (initializePayment) {
  router.post('/init', initializePayment);
  console.log('✅ Route registered: POST /init');
} else {
  console.warn('⚠️ initializePayment not found — POST /init will be unavailable');
}

if (verifyPayment) {
  router.post('/verify', verifyPayment);
  console.log('✅ Route registered: POST /verify');
} else {
  console.warn('⚠️ verifyPayment not found — POST /verify will be unavailable');
}

if (getPaymentHistory) {
  router.get('/history', getPaymentHistory);
  console.log('✅ Route registered: GET /history');
} else {
  console.warn('⚠️ getPaymentHistory not found — GET /history will be unavailable');
}

// Card/Razorpay routes (Call Credits)
router.post('/create-call-credit-order', createCallCreditOrder);
router.post('/create-order', createCallCreditOrder);
router.post('/verify-call-credit', verifyCallCreditPayment);

// UPI/QR routes
router.post('/generate-upi-qr', generateUPIQR);
router.post('/verify-upi-payment', verifyUPIPayment);

// Credit management routes
router.get('/credit-balance', getCreditBalance);
router.post('/use-contact-credit', useContactCredit);

module.exports = router;
