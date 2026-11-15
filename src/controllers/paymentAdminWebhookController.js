const Booking = require('../models/Booking');
const PaymentLog = require('../models/PaymentLog');
const { razorpay, stripe, timingSafeEqualHex, getPaymentSummary, applyPaymentToBooking, sendPaymentReceiptOnce } = require('../utils/paymentCore');

const getPaymentStatus = async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.bookingId, userId: req.user._id }).lean();
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  const summary = getPaymentSummary(booking);
  return res.json({ success: true, data: { ...booking, amountPaid: summary.paid, amountDue: summary.due } });
};

const getPaymentHistory = async (req, res) => {
  try {
    const payments = await PaymentLog.find({ userId: req.user._id })
      .populate({ path: 'bookingId', select: 'pgId roomType durationMonths totalAmount amountPaid amountDue', populate: { path: 'pgId', select: 'name' } })
      .sort({ createdAt: -1 })
      .limit(50);
    return res.json({ success: true, data: payments });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const refundPayment = async (req, res) => {
  try {
    const { bookingId, reason } = req.body;
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required' });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const refundAmount = Number(booking.amountPaid || booking.totalAmount);
    let refundSuccess = false;
    let refundId = '';

    if (booking.paymentProvider === 'razorpay' && razorpay) {
      const refund = await razorpay.payments.refund(booking.paymentId, { amount: Math.round(refundAmount * 100), notes: { reason } });
      refundSuccess = !!refund;
      refundId = refund?.id || '';
    } else if (booking.paymentProvider === 'stripe' && stripe) {
      const refund = await stripe.refunds.create({ payment_intent: booking.paymentId });
      refundSuccess = !!refund;
    }

    if (refundSuccess) {
      booking.paymentStatus = 'refunded';
      booking.status = 'cancelled';
      booking.refundReason = reason;
      booking.refundId = refundId;
      booking.refundedAt = new Date();
      await booking.save();
    }

    return res.json({ success: refundSuccess, message: refundSuccess ? 'Refund processed successfully' : 'Refund failed' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const paymentWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) return res.status(400).json({ success: false });

    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const expectedSignature = require('crypto').createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    if (!signature || !timingSafeEqualHex(expectedSignature, signature)) return res.status(400).json({ success: false });

    const event = req.body.event;
    const payment = req.body.payload?.payment?.entity;

    if (event === 'payment.captured' && payment) {
      const bookingId = payment.notes?.bookingId;
      const booking = bookingId && (await Booking.findOne({ _id: bookingId, razorpayOrderId: payment.order_id }));
      const expectedAmount = booking && Number(booking.pendingPaymentAmount || getPaymentSummary(booking).due);

      if (booking && payment.amount === Math.round(expectedAmount * 100)) {
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
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
};

module.exports = { getPaymentStatus, getPaymentHistory, refundPayment, paymentWebhook };