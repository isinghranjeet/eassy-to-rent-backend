// backend/src/routes/paymentRoutes.js
const express = require('express');
const {
  createCallCreditOrder,
  verifyCallCreditPayment,
  getCreditBalance,
  useContactCredit,
  canContact,
  generateUPIQR,
  verifyUPIPayment
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// Card/Razorpay routes
router.post('/create-call-credit-order', createCallCreditOrder);
router.post('/verify-call-credit', verifyCallCreditPayment);

// UPI/QR routes
router.post('/generate-upi-qr', generateUPIQR);
router.post('/verify-upi-payment', verifyUPIPayment);

// Credit management
router.get('/credit-balance', getCreditBalance);
router.post('/use-contact-credit', useContactCredit);
router.post('/can-contact', canContact);

module.exports = router;