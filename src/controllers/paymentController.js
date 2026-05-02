const Razorpay = require('razorpay');
const crypto = require('crypto');
const QRCode = require('qrcode');
const CallCredit = require('../models/CallCredit');
const PGListing = require('../models/PGListing');
const Activity = require('../models/Activity');
const { asyncHandler } = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const { successResponse } = require('../utils/response');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_SflfuTdO7GtSJg',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'z96jUOnHgrXvouEqxVb5AAr1'
});

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
    const amount = Number(req.body.amount ?? 10);
    const userId = req.user._id;
    if (!amount || amount <= 0) throw new AppError('Amount must be a positive number', 400);

    // Your actual UPI ID
    const upiId = '9315058665@ptsbi';
    const name = 'EasyTorent';
    const note = `Credits for ${userId}`;
    
    // Create UPI URI
    const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
    
    // Generate QR Code
    const qrCode = await QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300
    });
    
    // Get or create credit record with userId
    let credit = await CallCredit.findOne({ userId });
    if (!credit) {
      credit = new CallCredit({ 
        userId,
        balance: 0,
        totalPurchased: 0,
        totalUsed: 0,
        transactions: [],
        pendingTransactions: []
      });
      await credit.save();
    }
    
    // Create pending transaction
    const transactionId = `UPI_${userId}_${Date.now()}`;
    const pendingTransaction = {
      transactionId: transactionId,
      amount: amount,
      type: 'upi',
      status: 'pending',
      createdAt: new Date()
    };
    
    if (!credit.pendingTransactions) {
      credit.pendingTransactions = [];
    }
    credit.pendingTransactions.push(pendingTransaction);
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

    const credit = await CallCredit.findOne({ userId });
    if (!credit || !credit.pendingTransactions) {
      throw new AppError('Transaction not found', 404);
    }
    
    const transaction = credit.pendingTransactions.find(t => t.transactionId === transactionId);
    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }
    
    if (transaction.status === 'completed') {
      return successResponse(res, { message: 'Already verified', data: { balance: credit.balance } });
    }
    
    transaction.status = 'completed';
    transaction.completedAt = new Date();
    
    credit.balance += 4;
    credit.totalPurchased += 4;
    credit.transactions.push({
      amount: transaction.amount,
      type: 'purchase',
      cost: transaction.amount,
      paymentMethod: 'UPI',
      date: new Date()
    });
    credit.updatedAt = new Date();
    
    await credit.save();
    
    // Log activity
    try {
      await Activity.create({
        type: 'PAYMENT_SUCCESS',
        message: `Payment of ₹${transaction.amount} verified successfully`,
        userId,
        metadata: { transactionId, amount: transaction.amount, method: 'UPI' },
      });
    } catch (activityErr) {
      console.error('Activity log error:', activityErr.message);
    }

    return successResponse(res, {
      message: 'Payment verified! Credits added.',
      data: { balance: credit.balance },
    });
  });

// Create Razorpay order for card payments
const createCallCreditOrder = asyncHandler(async (req, res) => {
    const amount = Number(req.body.amount ?? 10);
    const userId = req.user._id;
    if (!amount || amount <= 0) throw new AppError('Amount must be a positive number', 400);

    const options = {
      amount: amount * 100,
      currency: 'INR',
      receipt: `receipt_${userId}_${Date.now()}`,
      notes: { userId: userId, credits: 4, type: 'call_credit' },
      payment_capture: 1
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

// Verify card payment
const verifyCallCreditPayment = asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user._id;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      throw new AppError('Invalid signature', 400);
    }

    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    
    if (payment.status !== 'captured') {
      throw new AppError('Payment not captured', 400);
    }

    let credit = await CallCredit.findOne({ userId });
    if (!credit) {
      credit = new CallCredit({ 
        userId: userId,  // ✅ REQUIRED
        balance: 0,
        totalPurchased: 0,
        totalUsed: 0,
        transactions: [],
        pendingTransactions: []
      });
      await credit.save();
    }

    credit.balance += 4;
    credit.totalPurchased += 4;
    credit.transactions.push({
      amount: payment.amount / 100,
      type: 'purchase',
      cost: payment.amount / 100,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentMethod: 'Card',
      date: new Date()
    });
    credit.updatedAt = new Date();

    await credit.save();

    // Log activity
    try {
      await Activity.create({
        type: 'PAYMENT_SUCCESS',
        message: `Card payment of ₹${payment.amount / 100} successful`,
        userId,
        metadata: { razorpayOrderId, razorpayPaymentId, amount: payment.amount / 100, method: 'Card' },
      });
    } catch (activityErr) {
      console.error('Activity log error:', activityErr.message);
    }

    return successResponse(res, {
      message: 'Credits added successfully',
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

    let credit = await CallCredit.findOne({ userId });
    
    if (!credit) {
      credit = new CallCredit({ 
        userId: userId,  // ✅ REQUIRED
        balance: 0,
        totalPurchased: 0,
        totalUsed: 0,
        transactions: [],
        pendingTransactions: []
      });
      await credit.save();
    }
    
    if (credit.balance < 1) {
      throw new AppError('Insufficient credits. Please purchase credits to contact property owner.', 400);
    }

    credit.balance -= 1;
    credit.totalUsed += 1;
    credit.transactions.push({
      type: 'use',
      pgId: pgId,
      contactType: contactType,
      cost: 2.5,
      date: new Date()
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
  verifyUPIPayment
};