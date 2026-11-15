const mongoose = require('mongoose');
const crypto = require('crypto');
const Booking = require('../models/Booking');
const PGListing = require('../models/PGListing');
const User = require('../models/User');
const PaymentLog = require('../models/PaymentLog');
const {
  razorpay,
  timingSafeEqualHex,
  getPaymentSummary,
  syncBookingPlanIfUnpaid,
  applyPaymentToBooking,
  sendPaymentReceiptOnce,
  generatePaymentToken,
  verifyPaymentToken,
} = require('../utils/paymentCore');

const initializePayment = async (req, res) => {
  try {
    const { bookingId, paymentMethod = 'razorpay', preferredMethod = 'upi', amount, roomType, durationMonths } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized booking access' });
    }

    const pg = await PGListing.findById(booking.pgId).select('price name roomInventory').lean();
    await syncBookingPlanIfUnpaid({ booking, pg, roomType, durationMonths });

    const summary = getPaymentSummary(booking);
    const requestedAmount = amount === undefined ? summary.due : Math.round(Number(amount));

    if (!Number.isFinite(requestedAmount) || requestedAmount < 1 || requestedAmount > summary.due) {
      return res.status(422).json({ success: false, message: `Payment amount must be between ₹1 and ₹${summary.due}` });
    }

    const user = await User.findById(userId).select('name email phone').lean();
    const prefill = {
      name: booking.guestDetails?.name || user?.name || '',
      email: booking.guestDetails?.email || user?.email || '',
      contact: booking.guestDetails?.phone || user?.phone || '',
    };

    const amountPaise = Math.round(requestedAmount * 100);

    const claimedBooking = await Booking.findOneAndUpdate(
      { _id: bookingId, userId, paymentStatus: { $in: ['pending', 'partially_paid', 'processing'] } },
      { $set: { paymentStatus: 'processing', paymentProvider: 'razorpay', pendingPaymentAmount: requestedAmount, lastPaymentAttempt: new Date() }, $inc: { paymentAttempts: 1 } },
      { new: true }
    );

    if (!claimedBooking || !razorpay) {
      return res.status(503).json({ success: false, message: 'Payment gateway unavailable or busy' });
    }

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `bkg_${String(bookingId).slice(-10)}_${Date.now()}`,
      payment_capture: 1,
      notes: { bookingId: String(bookingId), userId: String(userId) },
    });

    const paymentToken = generatePaymentToken({ userId, bookingId, orderId: order.id, amountPaise });
    await Booking.updateOne({ _id: bookingId }, { $set: { razorpayOrderId: order.id } });

    await PaymentLog.create({
      bookingId,
      userId,
      amount: requestedAmount,
      status: 'initiated',
      paymentMethod: 'razorpay',
      paymentId: order.id,
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      data: { provider: 'razorpay', orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID, paymentToken, prefill },
    });
  } catch (error) {
    console.error('Init payment error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { bookingId, paymentToken: bodyToken, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const token = req.headers['x-payment-token'] || bodyToken;
    const decoded = verifyPaymentToken(token);

    if (!decoded || String(decoded.bookingId) !== String(bookingId) || String(decoded.userId) !== String(req.user._id)) {
      return res.status(401).json({ success: false, message: 'Invalid payment session token' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto.createHmac('sha256', razorpaySecret).update(body).digest('hex');

    if (!timingSafeEqualHex(expectedSignature, razorpay_signature) || booking.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'Signature verification failed' });
    }

    const expectedAmount = Number(booking.pendingPaymentAmount || getPaymentSummary(booking).due);
    const confirmedBooking = await applyPaymentToBooking({ booking, amount: expectedAmount, paymentId: razorpay_payment_id, paymentProvider: 'razorpay', signature: razorpay_signature });

    if (!confirmedBooking) {
      return res.status(409).json({ success: false, message: 'Booking payment already processed' });
    }

    const paymentLog = await PaymentLog.findOneAndUpdate(
      { paymentId: razorpay_payment_id },
      { $set: { bookingId, userId: req.user._id, amount: expectedAmount, status: 'success', paymentMethod: 'razorpay' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (paymentLog) {
      await sendPaymentReceiptOnce({ paymentLog, booking: confirmedBooking, amount: expectedAmount, orderId: razorpay_order_id });
    }

    return res.json({ success: true, message: 'Payment verified successfully', data: { booking: confirmedBooking } });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { initializePayment, verifyPayment };