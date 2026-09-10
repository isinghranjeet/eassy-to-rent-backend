const Razorpay = require('razorpay');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const PGListing = require('../models/PGListing');
const User = require('../models/User');
const PaymentLog = require('../models/PaymentLog');
const { sendPaymentReceipt } = require('../utils/sendEmail');

const paymentTokenSecret = () => process.env.PAYMENT_JWT_SECRET || process.env.JWT_SECRET;

const getPaymentSummary = (booking) => {
  const paid = Number(booking.amountPaid || (booking.paymentStatus === 'paid' ? booking.totalAmount : 0));
  const total = Number(booking.totalAmount || 0);
  return { total, paid, due: Math.max(0, total - paid) };
};

const applyPaymentToBooking = async ({ booking, amount, paymentId, paymentProvider, signature = '' }) => {
  const summary = getPaymentSummary(booking);
  const newPaid = summary.paid + amount;
  if (amount <= 0 || newPaid > summary.total) return null;

  return Booking.findOneAndUpdate(
    {
      _id: booking._id,
      userId: booking.userId,
      paymentStatus: { $in: ['pending', 'processing', 'partially_paid'] },
      $or: [{ amountPaid: summary.paid }, { amountPaid: { $exists: false } }],
    },
    {
      $set: {
        amountPaid: newPaid,
        amountDue: Math.max(0, summary.total - newPaid),
        paymentStatus: newPaid >= summary.total ? 'paid' : 'partially_paid',
        status: 'confirmed',
        paymentId,
        paymentProvider,
        razorpaySignature: signature || undefined,
        paymentCompletedAt: new Date(),
        pendingPaymentAmount: null,
      },
    },
    { new: true }
  );
};

const sendPaymentReceiptOnce = async ({ paymentLog, booking, amount, orderId = '' }) => {
  const claim = await PaymentLog.findOneAndUpdate(
    { _id: paymentLog._id, receiptStatus: 'pending' },
    { $set: { receiptStatus: 'sending' } },
    { new: true }
  );
  if (!claim) return;

  try {
    const user = await User.findById(booking.userId).select('name email').lean();
    const receipt = user?.email
      ? await sendPaymentReceipt({ user, booking: await Booking.findById(booking._id).populate('pgId', 'name'), payment: { amount, currency: 'INR', paymentId: claim.paymentId, orderId } })
      : { success: false, messageId: '' };
    await PaymentLog.updateOne({ _id: claim._id, receiptStatus: 'sending' }, { $set: { receiptStatus: receipt.success ? 'sent' : 'failed', receiptMessageId: receipt.messageId || '' } });
  } catch (error) {
    await PaymentLog.updateOne({ _id: claim._id, receiptStatus: 'sending' }, { $set: { receiptStatus: 'failed' } });
  }
};

// ✅ Initialize Razorpay only (Stripe optional)
let razorpay;
try {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
  console.log('✅ Razorpay initialized in advancedPaymentController');
} catch (err) {
  console.error('❌ Razorpay initialization failed:', err.message);
  razorpay = null;
}

// ✅ Optional: Initialize Stripe only if keys are present
let stripe = null;
if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== '') {
  const Stripe = require('stripe');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Generate unique payment token
const generatePaymentToken = (userId, bookingId) => {
  const secret = paymentTokenSecret();
  if (!secret) throw new Error('Payment security configuration is missing');
  return jwt.sign(
    { userId, bookingId, timestamp: Date.now() },
    secret,
    { expiresIn: '15m' }
  );
};

// Verify payment token
const verifyPaymentToken = (token) => {
  try {
    const secret = paymentTokenSecret();
    if (!secret) return null;
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
};

// @desc    Initialize Payment (Multi-Provider)
// @route   POST /api/payments/init
// @access  Private
const initializePayment = async (req, res) => {
  try {
    const { bookingId, paymentMethod = 'razorpay', amount } = req.body;
    const userId = req.user._id;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (paymentMethod !== 'razorpay') {
      return res.status(400).json({ success: false, message: 'Only Razorpay payments are supported for bookings' });
    }
    const summary = getPaymentSummary(booking);
    const requestedAmount = amount === undefined ? summary.due : Number(amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || requestedAmount > summary.due) {
      return res.status(422).json({ success: false, message: `Payment amount must be greater than 0 and no more than the due amount of ${summary.due}` });
    }
    if (booking.status === 'cancelled' || summary.due <= 0) {
      return res.status(409).json({ success: false, message: 'This booking cannot accept payment' });
    }
    if (booking.paymentStatus === 'processing' && booking.razorpayOrderId) {
      return res.json({ success: true, data: { provider: 'razorpay', orderId: booking.razorpayOrderId, amount: Math.round(Number(booking.pendingPaymentAmount || summary.due) * 100), currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID, paymentToken: generatePaymentToken(userId, bookingId) } });
    }

    const stalePaymentAttempt = booking.paymentStatus === 'processing'
      && !booking.razorpayOrderId
      && booking.lastPaymentAttempt
      && Date.now() - new Date(booking.lastPaymentAttempt).getTime() > 2 * 60 * 1000;
    if (stalePaymentAttempt) {
      await Booking.updateOne(
        { _id: bookingId, userId, paymentStatus: 'processing', razorpayOrderId: { $in: ['', null] } },
        { $set: { paymentStatus: 'pending' } }
      );
    }

    const claimedBooking = await Booking.findOneAndUpdate(
      { _id: bookingId, userId, paymentStatus: { $in: ['pending', 'partially_paid'] } },
      { $set: { paymentStatus: 'processing', paymentProvider: 'razorpay', pendingPaymentAmount: requestedAmount, lastPaymentAttempt: new Date() }, $inc: { paymentAttempts: 1 } },
      { new: true }
    );
    if (!claimedBooking) {
      return res.status(409).json({ success: false, message: 'Payment is already being initialized. Please retry shortly.' });
    }

    // Generate payment token
    const paymentToken = generatePaymentToken(userId, bookingId);

    if (!razorpay) {
      await Booking.updateOne({ _id: bookingId, paymentStatus: 'processing' }, { $set: { paymentStatus: 'pending' } });
      return res.status(503).json({ success: false, message: 'Payment gateway is not configured' });
    }
    let order;
    try {
      order = await razorpay.orders.create({
        amount: Math.round(requestedAmount * 100),
        currency: 'INR',
        receipt: `booking_${bookingId}`,
        payment_capture: 1,
        notes: {
          bookingId: bookingId.toString(),
          userId: userId.toString(),
          paymentToken
        }
      });
    } catch (error) {
      await Booking.updateOne({ _id: bookingId, paymentStatus: 'processing' }, { $set: { paymentStatus: 'pending' } });
      throw error;
    }
    await Booking.updateOne({ _id: bookingId, userId, paymentStatus: 'processing' }, { $set: { razorpayOrderId: order.id } });
    await PaymentLog.create({
      bookingId, userId, amount: requestedAmount, status: 'initiated', paymentMethod: 'razorpay', paymentId: order.id,
      ipAddress: req.ip, userAgent: req.headers['user-agent']
    });

    const paymentData = {
        provider: 'razorpay',
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        paymentToken
      };

    res.json({
      success: true,
      data: paymentData
    });
  } catch (error) {
    console.error('Init payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify Payment with Enhanced Security
// @route   POST /api/payments/verify
// @access  Private
const verifyPayment = async (req, res) => {
  try {
    const { 
      bookingId, 
      provider, 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      stripe_payment_intent_id 
    } = req.body;

    // Verify payment token and bind it to the authenticated user and booking.
    const token = req.headers['x-payment-token'];
    const decoded = verifyPaymentToken(token);
    if (!decoded || decoded.bookingId !== bookingId || decoded.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ success: false, message: 'Invalid payment session' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Idempotent replay: return the already confirmed booking.
    if (booking.paymentStatus === 'paid') {
      if (booking.razorpayPaymentId === razorpay_payment_id) return res.json({ success: true, message: 'Payment already verified', booking });
      return res.status(409).json({ success: false, message: 'Booking payment is already completed' });
    }

    let paymentVerified = false;
    let paymentId = '';

    if (provider === 'razorpay') {
      // Verify signature
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!razorpaySecret || !razorpay || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid payment verification request' });
      }
      const expectedSignature = crypto
        .createHmac('sha256', razorpaySecret)
        .update(body.toString())
        .digest('hex');

      const signaturesMatch = expectedSignature.length === razorpay_signature.length
        && crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpay_signature));
      if (!signaturesMatch || booking.razorpayOrderId !== razorpay_order_id) return res.status(400).json({ success: false, message: 'Payment verification failed' });
      const payment = await razorpay.payments.fetch(razorpay_payment_id);
      const expectedAmount = Number(booking.pendingPaymentAmount || getPaymentSummary(booking).due);
      if (payment.order_id !== booking.razorpayOrderId || payment.amount !== Math.round(expectedAmount * 100) || payment.currency !== 'INR' || !['captured', 'authorized'].includes(payment.status)) {
        return res.status(400).json({ success: false, message: 'Payment details do not match this booking' });
      }
      paymentVerified = true;
      paymentId = razorpay_payment_id;
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported payment provider' });
    }

    if (!paymentVerified) {
      await PaymentLog.create({
        bookingId,
        userId: req.user._id,
        amount: booking.totalAmount,
        status: 'failed',
        error: 'Payment verification failed',
        ipAddress: req.ip
      });
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const expectedAmount = Number(booking.pendingPaymentAmount || getPaymentSummary(booking).due);
    const confirmedBooking = await applyPaymentToBooking({ booking, amount: expectedAmount, paymentId, paymentProvider: provider, signature: razorpay_signature });
    if (!confirmedBooking) return res.status(409).json({ success: false, message: 'Booking payment was already processed or is no longer payable' });

    // Log successful payment
    await PaymentLog.findOneAndUpdate({ paymentId }, {
      bookingId,
      userId: req.user._id,
      amount: expectedAmount,
      status: 'success',
      paymentId,
      paymentMethod: provider,
      ipAddress: req.ip
    }, { upsert: true, new: true, setDefaultsOnInsert: true });

    const paymentLog = await PaymentLog.findOne({ paymentId });
    if (paymentLog) await sendPaymentReceiptOnce({ paymentLog, booking: confirmedBooking, amount: expectedAmount, orderId: razorpay_order_id });

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: { booking: confirmedBooking }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const submitManualPayment = async (req, res) => {
  const { bookingId, amount } = req.body;
  const booking = await Booking.findOne({ _id: bookingId, userId: req.user._id });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

  const summary = getPaymentSummary(booking);
  const requestedAmount = Number(amount);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || requestedAmount > summary.due) {
    return res.status(422).json({ success: false, message: `Payment amount must be greater than 0 and no more than the due amount of ${summary.due}` });
  }

  const paymentId = `manual_${new mongoose.Types.ObjectId()}`;
  const payment = await PaymentLog.create({
    bookingId,
    userId: req.user._id,
    amount: requestedAmount,
    status: 'pending',
    paymentMethod: 'manual',
    paymentId,
    note: 'Manual payment submitted for verification',
    ipAddress: req.ip,
  });
  return res.status(201).json({
    success: true,
    message: 'Manual payment submitted for verification',
    data: { payment, totalAmount: summary.total, amountPaid: summary.paid, amountDue: summary.due },
  });
};

const approveManualPayment = async (req, res) => {
  const log = await PaymentLog.findOneAndUpdate(
    { paymentId: req.params.paymentId, paymentMethod: 'manual', status: 'pending' },
    { $set: { status: 'success' } },
    { new: true }
  );
  if (!log) return res.status(404).json({ success: false, message: 'Pending manual payment not found' });

  const booking = await Booking.findById(log.bookingId);
  const updatedBooking = booking && await applyPaymentToBooking({
    booking,
    amount: log.amount,
    paymentId: log.paymentId,
    paymentProvider: 'cash',
  });
  if (!updatedBooking) {
    await PaymentLog.updateOne({ _id: log._id, status: 'success' }, { $set: { status: 'pending' } });
    return res.status(409).json({ success: false, message: 'Manual payment exceeds the current due amount' });
  }
  await sendPaymentReceiptOnce({ paymentLog: log, booking: updatedBooking, amount: log.amount });
  return res.json({ success: true, message: 'Manual payment approved', data: { booking: updatedBooking } });
};

const getPaymentStatus = async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.bookingId, userId: req.user._id })
    .select('paymentStatus status razorpayOrderId razorpayPaymentId totalAmount amountPaid amountDue paymentCompletedAt')
    .lean();
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  const summary = getPaymentSummary(booking);
  return res.json({ success: true, data: { ...booking, amountPaid: summary.paid, amountDue: summary.due } });
};

// @desc    Refund Payment (Admin only)
// @route   POST /api/payments/refund
// @access  Private/Admin
const refundPayment = async (req, res) => {
  try {
    const { bookingId, reason } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.paymentStatus === 'refunded' && booking.refundId) {
      return res.json({ success: true, message: 'Refund already processed', data: { refundId: booking.refundId } });
    }
    if (booking.paymentStatus !== 'paid') {
      return res.status(400).json({ success: false, message: 'Payment not completed' });
    }

    let refundSuccess = false;
    let refundId = '';

    if (booking.paymentProvider === 'razorpay') {
      const refund = await razorpay.payments.refund(booking.paymentId, {
        amount: Math.round(booking.totalAmount * 100),
        notes: { reason }
      });
      refundSuccess = !!refund;
      refundId = refund?.id || '';
    } 
    else if (booking.paymentProvider === 'stripe' && stripe) {
      const refund = await stripe.refunds.create({
        payment_intent: booking.paymentId
      });
      refundSuccess = !!refund;
    }

    if (refundSuccess) {
      booking.paymentStatus = 'refunded';
      booking.status = 'cancelled';
      booking.refundReason = reason;
      booking.refundId = refundId;
      booking.refundedAt = new Date();
      await booking.save();

      await PaymentLog.create({
        bookingId,
        userId: booking.userId,
        amount: booking.totalAmount,
        status: 'refunded',
        paymentId: `${booking.paymentId}:refund:${refundId}`,
        note: reason,
        ipAddress: req.ip
      });
    }

    res.json({
      success: refundSuccess,
      message: refundSuccess ? 'Refund processed successfully' : 'Refund failed'
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Payment History
// @route   GET /api/payments/history
// @access  Private
const getPaymentHistory = async (req, res) => {
  try {
    const payments = await PaymentLog.find({ userId: req.user._id })
      .populate({ path: 'bookingId', select: 'pgId totalAmount amountPaid amountDue checkInDate checkOutDate', populate: { path: 'pgId', select: 'name' } })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Webhook for Payment Events
// @route   POST /api/payments/webhook
// @access  Public (but verified)
const paymentWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('Webhook secret not configured');
      return res.status(400).json({ success: false });
    }

    // Verify webhook signature
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!signature || signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return res.status(400).json({ success: false });
    }

    const event = req.body.event;
    const payment = req.body.payload?.payment?.entity;

    if (event === 'payment.captured' && payment) {
      const bookingId = payment.notes?.bookingId;
      const booking = bookingId && await Booking.findOne({ _id: bookingId, razorpayOrderId: payment.order_id });
      const expectedAmount = booking && Number(booking.pendingPaymentAmount || getPaymentSummary(booking).due);
      if (!booking || payment.amount !== Math.round(expectedAmount * 100) || payment.currency !== 'INR') {
        return res.status(400).json({ success: false });
      }
      const confirmedBooking = await applyPaymentToBooking({ booking, amount: expectedAmount, paymentId: payment.id, paymentProvider: 'razorpay' });
      if (confirmedBooking) {
        const paymentLog = await PaymentLog.findOneAndUpdate(
          { paymentId: payment.id },
          { $set: { bookingId: booking._id, userId: booking.userId, amount: expectedAmount, status: 'success', paymentMethod: 'razorpay' } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        await sendPaymentReceiptOnce({ paymentLog, booking: confirmedBooking, amount: expectedAmount, orderId: payment.order_id });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false });
  }
};

module.exports = {
  initializePayment,
  verifyPayment,
  refundPayment,
  getPaymentHistory,
  getPaymentStatus,
  submitManualPayment,
  approveManualPayment,
  paymentWebhook
};