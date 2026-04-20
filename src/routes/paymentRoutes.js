const express = require('express');
const {
  createCallCreditOrder,
  verifyCallCreditPayment,
  getCreditBalance,
  useContactCredit,
  canContact
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All payment routes require authentication
router.use(protect);

// Order creation
router.post('/create-call-credit-order', createCallCreditOrder);

// Payment verification
router.post('/verify-call-credit', verifyCallCreditPayment);

// Credit management
router.get('/credit-balance', getCreditBalance);
router.post('/use-contact-credit', useContactCredit);
router.post('/can-contact', canContact);

module.exports = router;