const Razorpay = require('razorpay');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Booking = require('../models/Booking');
const PGListing = require('../models/PGListing');
const User = require('../models/User');
const PaymentLog = require('../models/PaymentLog');

// ✅ Initialize Razorpay only (Stripe optional)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ✅ Optional: Initialize Stripe only if keys are present
let stripe = null;
if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== '') {
  const Stripe = require('stripe');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Generate unique payment token
const generatePaymentToken = (userId, bookingId) => {
  return jwt.sign(
    { userId, bookingId, timestamp: Date.now() },
    process.env.PAYMENT_JWT_SECRET || 'temp_secret_key_change_this',
    { expiresIn: '15m' }
  );
};

// Verify payment token
const verifyPaymentToken = (token) => {
  try {
    return jwt.verify(token, process.env.PAYMENT_JWT_SECRET || 'temp_secret_key_change_this');
  } catch (error) {
    return null;
  }
};

// @desc    Initialize Payment (Multi-Provider)
// @route   POST /api/payments/init
// @access  Private
const initializePayment = async (req, res) => {
  try {
    const { bookingId, paymentMethod = 'razorpay' } = req.body;
    const userId = req.user._id;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Generate payment token
    const paymentToken = generatePaymentToken(userId, bookingId);

    // Log payment initialization
    await PaymentLog.create({
      bookingId,
      userId,
      amount: booking.totalAmount,
      status: 'initiated',
      paymentMethod,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    let paymentData = {};

    if (paymentMethod === 'razorpay') {
      const order = await razorpay.orders.create({
        amount: Math.round(booking.totalAmount * 100),
        currency: 'INR',
        receipt: `booking_${bookingId}`,
        payment_capture: 1,
        notes: {
          bookingId: bookingId.toString(),
          userId: userId.toString(),
          paymentToken
        }
      });

      paymentData = {
        provider: 'razorpay',
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        paymentToken
      };
    } 
    else if (paymentMethod === 'stripe' && stripe) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(booking.totalAmount * 100),
        currency: 'inr',
        metadata: {
          bookingId: bookingId.toString(),
          userId: userId.toString()
        }
      });

      paymentData = {
        provider: 'stripe',
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        paymentToken
      };
    } else {
      return res.status(400).json({ success: false, message: 'Invalid payment method or Stripe not configured' });
    }

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

    // Verify payment token
    const token = req.headers['x-payment-token'];
    const decoded = verifyPaymentToken(token);
    if (!decoded || decoded.bookingId !== bookingId) {
      return res.status(401).json({ success: false, message: 'Invalid payment session' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Prevent double payment
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Payment already completed' });
    }

    let paymentVerified = false;
    let paymentId = '';

    if (provider === 'razorpay') {
      // Verify signature
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature === razorpay_signature) {
        paymentVerified = true;
        paymentId = razorpay_payment_id;
      }
    } 
    else if (provider === 'stripe' && stripe) {
      const paymentIntent = await stripe.paymentIntents.retrieve(stripe_payment_intent_id);
      if (paymentIntent.status === 'succeeded') {
        paymentVerified = true;
        paymentId = stripe_payment_intent_id;
      }
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

    // Update booking
    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
    booking.paymentId = paymentId;
    booking.paymentProvider = provider;
    booking.paymentCompletedAt = new Date();
    await booking.save();

    // Log successful payment
    await PaymentLog.create({
      bookingId,
      userId: req.user._id,
      amount: booking.totalAmount,
      status: 'success',
      paymentId,
      paymentMethod: provider,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Payment verified successfully',
      booking
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
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

    if (booking.paymentStatus !== 'paid') {
      return res.status(400).json({ success: false, message: 'Payment not completed' });
    }

    let refundSuccess = false;

    if (booking.paymentProvider === 'razorpay') {
      const refund = await razorpay.payments.refund(booking.paymentId, {
        amount: Math.round(booking.totalAmount * 100),
        notes: { reason }
      });
      refundSuccess = !!refund;
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
      booking.refundedAt = new Date();
      await booking.save();

      await PaymentLog.create({
        bookingId,
        userId: booking.userId,
        amount: booking.totalAmount,
        status: 'refunded',
        paymentId: booking.paymentId,
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
      .populate('bookingId', 'pgId totalAmount checkInDate checkOutDate')
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
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false });
    }

    const event = req.body.event;
    const payment = req.body.payload?.payment?.entity;

    if (event === 'payment.captured' && payment) {
      const bookingId = payment.notes?.bookingId;
      if (bookingId) {
        await Booking.findByIdAndUpdate(bookingId, {
          paymentStatus: 'paid',
          status: 'confirmed',
          paymentId: payment.id
        });
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
  paymentWebhook
};