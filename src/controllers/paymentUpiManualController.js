const QRCode = require('qrcode');
const Booking = require('../models/Booking');
const PaymentLog = require('../models/PaymentLog');
const { getPaymentSummary, syncBookingPlanIfUnpaid, applyPaymentToBooking, sendPaymentReceiptOnce } = require('../utils/paymentCore');

const generateBookingUpiQr = async (req, res) => {
  try {
    const { bookingId, amount, roomType, durationMonths } = req.body;
    const booking = await Booking.findOne({ _id: bookingId, userId: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    await syncBookingPlanIfUnpaid({ booking, roomType, durationMonths });
    const summary = getPaymentSummary(booking);
    const requestedAmount = amount === undefined ? summary.due : Math.round(Number(amount));

    const upiId = process.env.MERCHANT_UPI_ID || '9315058665@ptsbi';
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=EasyToRent&am=${requestedAmount.toFixed(2)}&cu=INR`;
    const qrCodeDataUrl = await QRCode.toDataURL(upiUri, { width: 280 });

    return res.json({ success: true, data: { qrCode: qrCodeDataUrl, upiUri, upiId, amount: requestedAmount } });
  } catch (error) {
    console.error('❌ Generate booking UPI QR error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const submitManualPayment = async (req, res) => {
  try {
    const { bookingId, amount, utrNumber, roomType, durationMonths } = req.body;
    
    const booking = await Booking.findOne({ _id: bookingId, userId: req.user._id });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    await syncBookingPlanIfUnpaid({ booking, pg: null, roomType, durationMonths });
    const requestedAmount = Math.round(Number(amount));
    const cleanUtr = typeof utrNumber === 'string' ? utrNumber.trim().toUpperCase() : '';

    if (!/^[A-Z0-9]{10,22}$/.test(cleanUtr)) {
      return res.status(422).json({ success: false, message: 'A valid 10-22 character UTR / Reference ID is required' });
    }

    const paymentId = `UTR_${cleanUtr}`;

    // 1. Upsert Payment Log to prevent duplicate key crashes
    const payment = await PaymentLog.findOneAndUpdate(
      { paymentId },
      {
        $set: {
          bookingId,
          userId: req.user._id,
          amount: requestedAmount,
          status: 'pending',
          paymentMethod: 'manual',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 2. Update Booking using allowed enum value
    booking.paymentId = paymentId;
    booking.paymentProvider = 'cash';
    booking.paymentStatus = 'processing';
    booking.pendingPaymentAmount = requestedAmount;
    await booking.save();

    return res.status(201).json({ 
      success: true, 
      message: 'Manual payment submitted for verification', 
      data: { payment } 
    });
  } catch (error) {
    console.error('❌ Submit manual payment 500 error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error during manual payment submission' });
  }
};

const approveManualPayment = async (req, res) => {
  try {
    const identifier = req.params.paymentId; // Can be UTR paymentId or Booking _id

    let log = await PaymentLog.findOne({
      $or: [
        { paymentId: identifier, paymentMethod: 'manual', status: 'pending' },
        { bookingId: identifier, paymentMethod: 'manual', status: 'pending' }
      ]
    });

    if (!log) {
      const bookingCheck = await Booking.findById(identifier);
      if (bookingCheck && bookingCheck.paymentId) {
        log = await PaymentLog.findOne({ paymentId: bookingCheck.paymentId, status: 'pending' });
      }
    }

    if (!log) {
      return res.status(404).json({ success: false, message: 'Pending manual payment log not found for this identifier' });
    }

    log.status = 'success';
    await log.save();

    const booking = await Booking.findById(log.bookingId);
    const updatedBooking = booking && (await applyPaymentToBooking({ booking, amount: log.amount, paymentId: log.paymentId, paymentProvider: 'cash' }));

    if (!updatedBooking) {
      log.status = 'pending';
      await log.save();
      return res.status(409).json({ success: false, message: 'Manual payment exceeds due amount' });
    }

    await sendPaymentReceiptOnce({ paymentLog: log, booking: updatedBooking, amount: log.amount });
    return res.json({ success: true, message: 'Manual payment approved successfully', data: { booking: updatedBooking } });
  } catch (error) {
    console.error('❌ Approve manual payment error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { generateBookingUpiQr, submitManualPayment, approveManualPayment };