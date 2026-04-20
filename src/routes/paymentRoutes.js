const express = require('express');
const {
  getCreditBalance,
  useContactCredit,
  createCallCreditOrder,
  verifyCallCreditPayment,
  canContact
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All payment routes require authentication
router.use(protect);

// Credit balance routes
router.get('/credit-balance', getCreditBalance);
router.post('/use-contact-credit', useContactCredit);
router.post('/can-contact', canContact);

// Razorpay payment routes
router.post('/create-call-credit-order', createCallCreditOrder);
router.post('/verify-call-credit', verifyCallCreditPayment);

module.exports = router;