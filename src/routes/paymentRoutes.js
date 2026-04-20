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

const router = express.Router();

// All routes require authentication
router.use(protect);

// Card/Razorpay routes
router.post('/create-call-credit-order', createCallCreditOrder);
router.post('/verify-call-credit', verifyCallCreditPayment);

// UPI/QR routes
router.post('/generate-upi-qr', generateUPIQR);
router.post('/verify-upi-payment', verifyUPIPayment);

// Credit management routes
router.get('/credit-balance', getCreditBalance);
router.post('/use-contact-credit', useContactCredit);

module.exports = router;