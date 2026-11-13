const Razorpay = require('razorpay');
const crypto = require('crypto');
const QRCode = require('qrcode');
const CallCredit = require('../models/CallCredit');
const PGListing = require('../models/PGListing');
const Activity = require('../models/Activity');
const { asyncHandler } = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const { successResponse } = require('../utils/response');

const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;

const CREDIT_PACK_PRICE_INR = 10;
const CREDITS_PER_PACK = 4;

const timingSafeEqualHex = (expectedHex, actualHex) => {
  if (typeof expectedHex !== 'string' || typeof actualHex !== 'string') return false;
  if (expectedHex.length !== actualHex.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(actualHex, 'hex'));
};

// Get user credit balance
const getCreditBalance = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  let credit = await CallCredit.findOne({ userId });

  if (!credit) {
    credit = await CallCredit.create({
      userId,
      balance: 0,
      totalPurchased: 0,
      totalUsed: 0,
      transactions: [],
      pendingTransactions: [],
    });
  }

  return successResponse(res, {
    message: 'Credit balance fetched',
    data: {
      balance: credit.balance || 0,
      totalPurchased: credit.totalPurchased || 0,
      totalUsed: credit.totalUsed || 0,
    },
  });
});

// Generate UPI QR Code
const generateUPIQR = asyncHandler(async (req, res) => {
  const packs = Math.max(1, Math.min(20, Math.floor(Number(req.body.amount ?? CREDIT_PACK_PRICE_INR) / CREDIT_PACK_PRICE_INR)));
  const amount = packs * CREDIT_PACK_PRICE_INR;
  const userId = req.user._id;

  const upiId = process.env.MERCHANT_UPI_ID || '9315058665@ptsbi';
  const name = 'EasyToRent';
  const note = `Credits for ${userId}`;

  const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

  const qrCode = await QRCode.toDataURL(upiUri, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 300,
  });

  let credit = await CallCredit.findOne({ userId });
  if (!credit) {
    credit = new CallCredit({
      userId,
      balance: 0,
      totalPurchased: 0,
      totalUsed: 0,
      transactions: [],
      pendingTransactions: [],
    });
  }

  const transactionId = `UPI_${userId}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  credit.pendingTransactions = credit.pendingTransactions || [];
  credit.pendingTransactions.push({
    transactionId,
    amount,
    type: 'upi',
    status: 'pending',
    createdAt: new Date(),
  });
  await credit.save();

  return successResponse(res, {
    message: 'UPI QR generated',
    data: {
      qrCode,
      upiId,
      amount,
      transactionId,
      upiUri,
    },
  });
});

// Verify UPI Payment
const verifyUPIPayment = asyncHandler(async (req, res) => {
  const { transactionId } = req.body;
  const userId = req.user._id;

  if (typeof transactionId !== 'string' || !transactionId.trim()) {
    throw new AppError('A valid transaction ID is required', 400);
  }

  const credit = await CallCredit.findOne({ userId });
  if (!credit || !credit.pendingTransactions) {
    throw new AppError('Transaction not found', 404);
  }

  const transaction = credit.pendingTransactions.find(
    (pending) => pending.transactionId === transactionId.trim()
  );
  if (!transaction) {
    throw new AppError('Transaction not found', 404);
  }

  if (transaction.status === 'completed') {
    return successResponse(res, {
      message: 'Payment has already been verified',
      data: {
        transactionId: transaction.transactionId,
        status: transaction.status,
        balance: credit.balance,
      },
    });
  }

  if (transaction.status !== 'pending') {
    throw new AppError('This transaction cannot be verified in its current state', 409);
  }

  return successResponse(res, {
    message: 'Payment is pending admin/bank verification',
    data: {
      transactionId: transaction.transactionId,
      status: transaction.status,
      balance: credit.balance,
    },
  });
});

// Create Razorpay order for credits (server-enforced pricing)
const createCallCreditOrder = asyncHandler(async (req, res) => {
  if (!razorpay) throw new AppError('Payment gateway is not configured', 503);

  const requestedAmount = Number(req.body.amount ?? CREDIT_PACK_PRICE_INR);
  if (!Number.isFinite(requestedAmount) || requestedAmount < CREDIT_PACK_PRICE_INR) {
    throw new AppError(`Minimum recharge amount is ₹${CREDIT_PACK_PRICE_INR}`, 400);
  }

  const packs = Math.min(50, Math.floor(requestedAmount / CREDIT_PACK_PRICE_INR));
  const verifiedAmountINR = packs * CREDIT_PACK_PRICE_INR;
  const creditsToGrant = packs * CREDITS_PER_PACK;
  const userId = req.user._id;

  const options = {
    amount: verifiedAmountINR * 100,
    currency: 'INR',
    receipt: `rcpt_${String(userId).slice(-8)}_${Date.now()}`,
    notes: {
      userId: String(userId),
      credits: String(creditsToGrant),
      expectedAmountPaise: String(verifiedAmountINR * 100),
      type: 'call_credit',
    },
    payment_capture: 1,
  };

  const order = await razorpay.orders.create(options);

  return successResponse(res, {
    message: 'Payment order created',
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    },
  });
});

// Verify payment with anti-replay, HMAC timing-safe check & Razorpay API verification
const verifyCallCreditPayment = asyncHandler(async (req, res) => {
  if (!razorpay) throw new AppError('Payment gateway is not configured', 503);

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const userId = req.user._id;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new AppError('Missing Razorpay verification parameters', 400);
  }

  // 1. Replay Attack Prevention: Check if paymentId was already processed anywhere
  const alreadyProcessed = await CallCredit.findOne({
    'transactions.razorpayPaymentId': razorpay_payment_id,
  }).lean();
  if (alreadyProcessed) {
    throw new AppError('Duplicate payment detected: this transaction has already been credited', 409);
  }

  // 2. Timing-Safe HMAC-SHA256 Signature Verification
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (!timingSafeEqualHex(expectedSignature, razorpay_signature)) {
    throw new AppError('Security alert: Invalid payment signature', 400);
  }

  // 3. Server-to-Server Razorpay Fetch & Cross-Check
  const [payment, order] = await Promise.all([
    razorpay.payments.fetch(razorpay_payment_id),
    razorpay.orders.fetch(razorpay_order_id),
  ]);

  if (!payment || !order) {
    throw new AppError('Unable to verify payment with Razorpay', 400);
  }
  if (payment.order_id !== razorpay_order_id) {
    throw new AppError('Order ID mismatch detected', 400);
  }
  if (order.notes?.userId && String(order.notes.userId) !== String(userId)) {
    throw new AppError('Unauthorized payment ownership mismatch', 403);
  }
  if (payment.status !== 'captured') {
    throw new AppError(`Payment not captured (current status: ${payment.status})`, 400);
  }
  if (payment.currency !== 'INR' || payment.amount < CREDIT_PACK_PRICE_INR * 100) {
    throw new AppError('Invalid payment currency or underpaid amount', 400);
  }
  if (payment.amount !== order.amount) {
    throw new AppError('Paid amount does not match order amount', 400);
  }

  const paidINR = Math.floor(payment.amount / 100);
  const creditsEarned = Math.floor(paidINR / CREDIT_PACK_PRICE_INR) * CREDITS_PER_PACK;

  let credit = await CallCredit.findOne({ userId });
  if (!credit) {
    credit = new CallCredit({
      userId,
      balance: 0,
      totalPurchased: 0,
      totalUsed: 0,
      transactions: [],
      pendingTransactions: [],
    });
  }

  credit.balance += creditsEarned;
  credit.totalPurchased += creditsEarned;
  credit.transactions.push({
    amount: paidINR,
    type: 'purchase',
    cost: paidINR,
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    paymentMethod: payment.method || 'Razorpay',
    date: new Date(),
  });
  credit.updatedAt = new Date();
  await credit.save();

  try {
    await Activity.create({
      type: 'PAYMENT_SUCCESS',
      message: `Verified ${payment.method || 'Razorpay'} payment of ₹${paidINR}`,
      userId,
      metadata: {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        amount: paidINR,
        method: payment.method,
      },
    });
  } catch (activityErr) {
    console.error('Activity log error:', activityErr.message);
  }

  return successResponse(res, {
    message: `${creditsEarned} credits added successfully`,
    data: { balance: credit.balance },
  });
});

// Use credit for contact
const useContactCredit = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { pgId, contactType } = req.body;

  if (!pgId || !contactType) {
    throw new AppError('PG ID and contact type are required', 400);
  }

  const credit = await CallCredit.findOne({ userId });
  if (!credit || credit.balance < 1) {
    throw new AppError('Insufficient credits. Please purchase credits to contact property owner.', 400);
  }

  credit.balance -= 1;
  credit.totalUsed += 1;
  credit.transactions.push({
    type: 'use',
    pgId,
    contactType,
    cost: 2.5,
    date: new Date(),
  });
  credit.updatedAt = new Date();
  await credit.save();

  const pg = await PGListing.findById(pgId);
  const contactNumber = pg?.ownerPhone || process.env.SUPPORT_PHONE || '9315058665';

  return successResponse(res, {
    message: 'Credit used successfully',
    data: {
      balance: credit.balance,
      contactNumber,
    },
  });
});

module.exports = {
  createCallCreditOrder,
  verifyCallCreditPayment,
  getCreditBalance,
  useContactCredit,
  generateUPIQR,
  verifyUPIPayment,
};