const express = require('express');
const router = express.Router();
const PayoutLedger = require('../models/PayoutLedger');

router.get('/', async (req, res, next) => {
  try {
    const payouts = await PayoutLedger.find({}).sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      message: 'Payout ledger fetched successfully',
      data: payouts
    });
  } catch (error) {
    return next(error);
  }
});

// ✅ CRITICAL: Must export router function
module.exports = router;