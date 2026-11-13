const Razorpay = require('razorpay');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const Booking = require('../models/Booking');
const PGListing = require('../models/PGListing');
const User = require('../models/User');
const PaymentLog = require('../models/PaymentLog');
const { sendPaymentReceipt } = require('../utils/sendEmail');

const paymentTokenSecret = () => process.env.PAYMENT_JWT_SECRET || process.env.JWT_SECRET;

const timingSafeEqualHex = (expectedHex, actualHex) => {
  if (typeof expectedHex !== 'string' || typeof actualHex !== 'string') return false;
  if (expectedHex.length !== actualHex.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedHex, 'hex'),
      Buffer.from(actualHex, 'hex')
    );
  } catch {
    return false;
  }
};

const getPaymentSummary = (booking) => {
  const paid = Number(
    booking.amountPaid || (booking.paymentStatus === 'paid' ? booking.totalAmount : 0)
  );
  const total = Number(booking.totalAmount || 0);
  return { total, paid, due: Math.max(0, total - paid) };
};

// Server-side tamper-proof recalculation if user changes Room Type or Months before first payment
const syncBookingPlanIfUnpaid = async ({ booking, pg, roomType, durationMonths }) => {
  if (!roomType && !durationMonths) return booking;
  if (Number(booking.amountPaid || 0) > 0 || booking.paymentStatus !== 'pending') {
    return booking;
  }

  const listing = pg || (await PGListing.findById(booking.pgId).select('price roomInventory').lean());
  if (!listing) return booking;

  const nextRoomType = typeof roomType === 'string' && roomType.trim() ? roomType.trim() : booking.roomType;
  const parsedMonths = Number(durationMonths || booking.durationMonths || 1);
  const nextMonths = Number.isFinite(parsedMonths)
    ? Math.max(1, Math.min(24, Math.round(parsedMonths)))
    : booking.durationMonths || 1;

  const inventoryEntry = listing.roomInventory?.[nextRoomType];
  if (inventoryEntry && typeof inventoryEntry.available === 'number' && inventoryEntry.available <= 0) {
    const err = new Error(`Selected room type (${nextRoomType}) is currently sold out`);
    err.statusCode = 409;
    throw err;
  }

  const roomRate = Number(inventoryEntry?.price || listing.price || 0);
  if (roomRate > 0) {
    const baseTotal = roomRate * nextMonths;
    const discount = nextMonths >= 3 ? Math.round(baseTotal * 0.1) : 0;
    const recalculatedTotal = Math.max(1, baseTotal - discount);

    booking.roomType = nextRoomType;
    booking.durationMonths = nextMonths;
    booking.discountApplied = discount;
    booking.totalAmount = recalculatedTotal;
    booking.amountDue = recalculatedTotal;

    if (booking.checkInDate) {
      const checkOut = new Date(booking.checkInDate);
      checkOut.setMonth(checkOut.getMonth() + nextMonths);
      booking.checkOutDate = checkOut;
    }

    await booking.save();
  }

  return booking;
};

const applyPaymentToBooking = async ({
  booking,
  amount,
  paymentId,
  paymentProvider,
  signature = '',
}) => {
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
        razorpayPaymentId: paymentProvider === 'razorpay' ? paymentId : booking.razorpayPaymentId,
        paymentProvider,
        razorpaySignature: signature || undefined,
        paymentCompletedAt: new Date(),
        pendingPaymentAmount: null,
        razorpayOrderId: null,
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
    const populatedBooking = await Booking.findById(booking._id).populate('pgId', 'name');
    const receipt = user?.email
      ? await sendPaymentReceipt({
          user,
          booking: populatedBooking,
          payment: { amount, currency: 'INR', paymentId: claim.paymentId, orderId },
        })
      : { success: false, messageId: '' };

    await PaymentLog.updateOne(
      { _id: claim._id, receiptStatus: 'sending' },
      {
        $set: {
          receiptStatus: receipt.success ? 'sent' : 'failed',
          receiptMessageId: receipt.messageId || '',
        },
      }
    );
  } catch {
    await PaymentLog.updateOne(
      { _id: claim._id, receiptStatus: 'sending' },
      { $set: { receiptStatus: 'failed' } }
    );
  }
};

// Initialize Razorpay
let razorpay;
try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log('✅ Razorpay initialized in advancedPaymentController');
  } else {
    razorpay = null;
  }
} catch (err) {
  console.error('❌ Razorpay initialization failed:', err.message);
  razorpay = null;
}

// Optional Stripe
let stripe = null;
if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== '') {
  const Stripe = require('stripe');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Generate cryptographically bound payment session token
const generatePaymentToken = ({ userId, bookingId, orderId, amountPaise }) => {
  const secret = paymentTokenSecret();
  if (!secret) throw new Error('Payment security configuration is missing');
  return jwt.sign(
    {
      userId: String(userId),
      bookingId: String(bookingId),
      orderId: String(orderId),
      amountPaise: Number(amountPaise),
      nonce: crypto.randomBytes(8).toString('hex'),
    },
    secret,
    { expiresIn: '15m' }
  );
};

const verifyPaymentToken = (token) => {
  try {
    const secret = paymentTokenSecret();
    if (!secret || !token) return null;
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
};

// @desc    Initialize Payment (Tamper-Proof Razorpay Order)
// @route   POST /api/payments/init
// @access  Private
const initializePayment = async (req, res) => {
  try {
    const {
      bookingId,
      paymentMethod = 'razorpay',
      preferredMethod = 'upi',
      amount,
      roomType,
      durationMonths,
    } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized booking access' });
    }

    if (paymentMethod !== 'razorpay') {
      return res
        .status(400)
        .json({ success: false, message: 'Only Razorpay payments are supported for bookings' });
    }

    const pg = await PGListing.findById(booking.pgId).select('price name roomInventory').lean();
    if (!pg || Number(booking.totalAmount) <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid booking pricing state' });
    }

    // Apply server-verified roomType / durationMonths update if selected inside PaymentModal
    await syncBookingPlanIfUnpaid({ booking, pg, roomType, durationMonths });

    const summary = getPaymentSummary(booking);
    const requestedAmount = amount === undefined ? summary.due : Math.round(Number(amount));

    if (!Number.isFinite(requestedAmount) || requestedAmount < 1 || requestedAmount > summary.due) {
      return res.status(422).json({
        success: false,
        message: `Payment amount must be between ₹1 and ₹${summary.due}`,
      });
    }

    if (booking.status === 'cancelled' || summary.due <= 0) {
      return res
        .status(409)
        .json({ success: false, message: 'This booking cannot accept payment' });
    }

    const user = await User.findById(userId).select('name email phone').lean();
    const prefill = {
      name: booking.guestDetails?.name || user?.name || '',
      email: booking.guestDetails?.email || user?.email || '',
      contact: booking.guestDetails?.phone || user?.phone || '',
    };

    const amountPaise = Math.round(requestedAmount * 100);
    const isSameOrderValid =
      booking.paymentStatus === 'processing' &&
      booking.razorpayOrderId &&
      Number(booking.pendingPaymentAmount) === requestedAmount &&
      booking.lastPaymentAttempt &&
      Date.now() - new Date(booking.lastPaymentAttempt).getTime() < 12 * 60 * 1000;

    if (isSameOrderValid) {
      const reusedToken = generatePaymentToken({
        userId,
        bookingId,
        orderId: booking.razorpayOrderId,
        amountPaise,
      });
      return res.json({
        success: true,
        data: {
          provider: 'razorpay',
          orderId: booking.razorpayOrderId,
          amount: amountPaise,
          currency: 'INR',
          keyId: process.env.RAZORPAY_KEY_ID,
          paymentToken: reusedToken,
          prefill,
        },
      });
    }

    if (booking.paymentStatus === 'processing') {
      await Booking.updateOne(
        { _id: bookingId, userId, paymentStatus: 'processing' },
        {
          $set: {
            paymentStatus: summary.paid > 0 ? 'partially_paid' : 'pending',
            razorpayOrderId: null,
            pendingPaymentAmount: null,
          },
        }
      );
    }

    const claimedBooking = await Booking.findOneAndUpdate(
      { _id: bookingId, userId, paymentStatus: { $in: ['pending', 'partially_paid'] } },
      {
        $set: {
          paymentStatus: 'processing',
          paymentProvider: 'razorpay',
          pendingPaymentAmount: requestedAmount,
          lastPaymentAttempt: new Date(),
        },
        $inc: { paymentAttempts: 1 },
      },
      { new: true }
    );

    if (!claimedBooking) {
      return res.status(409).json({
        success: false,
        message: 'Payment is already being initialized. Please retry shortly.',
      });
    }

    if (!razorpay) {
      await Booking.updateOne(
        { _id: bookingId, paymentStatus: 'processing' },
        { $set: { paymentStatus: summary.paid > 0 ? 'partially_paid' : 'pending' } }
      );
      return res.status(503).json({ success: false, message: 'Payment gateway is not configured' });
    }

    let order;
    try {
      order = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `bkg_${String(bookingId).slice(-10)}_${Date.now()}`,
        payment_capture: 1,
        notes: {
          bookingId: String(bookingId),
          userId: String(userId),
          preferredMethod: String(preferredMethod),
          roomType: String(booking.roomType || ''),
          durationMonths: String(booking.durationMonths || 1),
          expectedAmountPaise: String(amountPaise),
        },
      });
    } catch (error) {
      await Booking.updateOne(
        { _id: bookingId, paymentStatus: 'processing' },
        {
          $set: {
            paymentStatus: summary.paid > 0 ? 'partially_paid' : 'pending',
            pendingPaymentAmount: null,
          },
        }
      );
      throw error;
    }

    const paymentToken = generatePaymentToken({
      userId,
      bookingId,
      orderId: order.id,
      amountPaise: order.amount,
    });

    await Booking.updateOne(
      { _id: bookingId, userId, paymentStatus: 'processing' },
      { $set: { razorpayOrderId: order.id } }
    );

    await PaymentLog.create({
      bookingId,
      userId,
      amount: requestedAmount,
      status: 'initiated',
      paymentMethod: 'razorpay',
      paymentId: order.id,
      note: `Method: ${preferredMethod} | Room: ${booking.roomType} (${booking.durationMonths}M)`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({
      success: true,
      data: {
        provider: 'razorpay',
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        paymentToken,
        prefill,
      },
    });
  } catch (error) {
    console.error('Init payment error:', error);
    const errMsg =
      error?.error?.description ||
      error?.message ||
      'Payment initialization failed on server';
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: errMsg,
    });
  }
};

// @desc    Verify Payment with 6-Layer Security
// @route   POST /api/payments/verify
// @access  Private
const verifyPayment = async (req, res) => {
  try {
    const {
      bookingId,
      provider = 'razorpay',
      paymentToken: bodyToken,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // Layer 1: Verify cryptographically bound payment session token
    const token = req.headers['x-payment-token'] || bodyToken;
    const decoded = verifyPaymentToken(token);
    if (
      !decoded ||
      String(decoded.bookingId) !== String(bookingId) ||
      String(decoded.userId) !== String(req.user._id) ||
      (decoded.orderId && String(decoded.orderId) !== String(razorpay_order_id))
    ) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid or expired payment session token' });
    }

    // Layer 2: Global Anti-Replay check across all PaymentLogs
    const replayLog = await PaymentLog.findOne({
      paymentId: razorpay_payment_id,
      status: 'success',
    }).lean();
    if (replayLog) {
      if (String(replayLog.bookingId) === String(bookingId)) {
        const existingBooking = await Booking.findById(bookingId);
        return res.json({
          success: true,
          message: 'Payment already verified',
          data: { booking: existingBooking },
        });
      }
      return res
        .status(409)
        .json({ success: false, message: 'Security alert: Duplicate payment ID rejected' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (String(booking.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized booking access' });
    }

    if (booking.paymentStatus === 'paid') {
      return res
        .status(409)
        .json({ success: false, message: 'Booking payment is already completed' });
    }

    if (provider !== 'razorpay') {
      return res.status(400).json({ success: false, message: 'Unsupported payment provider' });
    }

    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
    if (
      !razorpaySecret ||
      !razorpay ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing required payment verification fields' });
    }

    // Layer 3: Timing-Safe HMAC-SHA256 Signature Verification
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', razorpaySecret)
      .update(body)
      .digest('hex');

    if (
      !timingSafeEqualHex(expectedSignature, razorpay_signature) ||
      booking.razorpayOrderId !== razorpay_order_id
    ) {
      await PaymentLog.create({
        bookingId,
        userId: req.user._id,
        amount: Number(booking.pendingPaymentAmount || 0),
        status: 'failed',
        paymentId: razorpay_payment_id,
        error: 'HMAC signature or order ID mismatch',
        ipAddress: req.ip,
      });
      return res
        .status(400)
        .json({ success: false, message: 'Security alert: Signature verification failed' });
    }

    // Layer 4: Server-to-Server Razorpay Payment & Order Fetch Cross-Check
    const [payment, order] = await Promise.all([
      razorpay.payments.fetch(razorpay_payment_id),
      razorpay.orders.fetch(razorpay_order_id),
    ]);

    const expectedAmount = Number(booking.pendingPaymentAmount || getPaymentSummary(booking).due);
    const expectedPaise = Math.round(expectedAmount * 100);

    if (
      !payment ||
      !order ||
      payment.order_id !== booking.razorpayOrderId ||
      payment.amount !== expectedPaise ||
      order.amount !== expectedPaise ||
      (decoded.amountPaise && Number(decoded.amountPaise) !== payment.amount) ||
      payment.currency !== 'INR' ||
      !['captured', 'authorized'].includes(payment.status)
    ) {
      await PaymentLog.create({
        bookingId,
        userId: req.user._id,
        amount: expectedAmount,
        status: 'failed',
        paymentId: razorpay_payment_id,
        error: `Gateway mismatch: status=${payment?.status}, amount=${payment?.amount}`,
        ipAddress: req.ip,
      });
      return res
        .status(400)
        .json({ success: false, message: 'Payment details do not match this booking' });
    }

    // Layer 5: Atomic Booking State Update
    const confirmedBooking = await applyPaymentToBooking({
      booking,
      amount: expectedAmount,
      paymentId: razorpay_payment_id,
      paymentProvider: 'razorpay',
      signature: razorpay_signature,
    });

    if (!confirmedBooking) {
      return res.status(409).json({
        success: false,
        message: 'Booking payment was already processed or is no longer payable',
      });
    }

    // Layer 6: Immutable Audit Log + Single-Dispatch Email Receipt
    const paymentLog = await PaymentLog.findOneAndUpdate(
      { paymentId: razorpay_payment_id },
      {
        $set: {
          bookingId,
          userId: req.user._id,
          amount: expectedAmount,
          status: 'success',
          paymentId: razorpay_payment_id,
          paymentMethod: 'razorpay',
          note: `Verified via Razorpay (${payment.method || 'online'}) | ${confirmedBooking.roomType} (${confirmedBooking.durationMonths}M)`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (paymentLog) {
      await sendPaymentReceiptOnce({
        paymentLog,
        booking: confirmedBooking,
        amount: expectedAmount,
        orderId: razorpay_order_id,
      });
    }

    return res.json({
      success: true,
      message: 'Payment verified successfully',
      data: { booking: confirmedBooking },
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    const errMsg =
      error?.error?.description ||
      error?.message ||
      'Payment verification failed on server';
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: errMsg,
    });
  }
};

// @desc    Generate Dynamic Scannable UPI QR for Booking
// @route   POST /api/payments/booking-upi-qr
// @access  Private
const generateBookingUpiQr = async (req, res) => {
  try {
    const { bookingId, amount, roomType, durationMonths } = req.body;
    const booking = await Booking.findOne({ _id: bookingId, userId: req.user._id });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    await syncBookingPlanIfUnpaid({ booking, roomType, durationMonths });

    const summary = getPaymentSummary(booking);
    const requestedAmount = amount === undefined ? summary.due : Math.round(Number(amount));

    if (!Number.isFinite(requestedAmount) || requestedAmount < 1 || requestedAmount > summary.due) {
      return res.status(422).json({
        success: false,
        message: `Amount must be between ₹1 and ₹${summary.due}`,
      });
    }

    const upiId = process.env.MERCHANT_UPI_ID || '9315058665@ptsbi';
    const merchantName = 'EasyToRent';
    const shortId = String(bookingId).slice(-6).toUpperCase();
    const monthsTag = booking.durationMonths ? `${booking.durationMonths}M` : '1M';
    const note = `ETR-${shortId}-${monthsTag}`;

    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
      merchantName
    )}&am=${requestedAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;

    const qrCodeDataUrl = await QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 280,
    });

    return res.json({
      success: true,
      data: {
        qrCode: qrCodeDataUrl,
        upiUri,
        upiId,
        merchantName,
        amount: requestedAmount,
        referenceNote: note,
      },
    });
  } catch (error) {
    console.error('Generate booking UPI QR error:', error);
    return res.status(error?.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Submit Manual UPI Payment with UTR Validation
// @route   POST /api/payments/manual
// @access  Private
const submitManualPayment = async (req, res) => {
  try {
    const { bookingId, amount, utrNumber, roomType, durationMonths } = req.body;
    const booking = await Booking.findOne({ _id: bookingId, userId: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    await syncBookingPlanIfUnpaid({ booking, roomType, durationMonths });

    const summary = getPaymentSummary(booking);
    const requestedAmount = Math.round(Number(amount));
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || requestedAmount > summary.due) {
      return res.status(422).json({
        success: false,
        message: `Payment amount must be greater than 0 and no more than the due amount of ₹${summary.due}`,
      });
    }

    const cleanUtr = typeof utrNumber === 'string' ? utrNumber.trim().toUpperCase() : '';
    if (!/^[A-Z0-9]{10,22}$/.test(cleanUtr)) {
      return res.status(422).json({
        success: false,
        message: 'A valid 10-22 character UPI UTR / Transaction Reference ID is required',
      });
    }

    const existingUtr = await PaymentLog.findOne({
      paymentId: `UTR_${cleanUtr}`,
    }).lean();
    if (existingUtr) {
      return res.status(409).json({
        success: false,
        message: 'This UTR / Transaction Reference ID has already been submitted',
      });
    }

    const paymentId = `UTR_${cleanUtr}`;
    const payment = await PaymentLog.create({
      bookingId,
      userId: req.user._id,
      amount: requestedAmount,
      status: 'pending',
      paymentMethod: 'manual',
      paymentId,
      note: `Manual UPI transfer (UTR: ${cleanUtr}) | Room: ${booking.roomType} (${booking.durationMonths}M)`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json({
      success: true,
      message: 'Manual payment & UTR submitted for admin verification',
      data: {
        payment,
        totalAmount: summary.total,
        amountPaid: summary.paid,
        amountDue: summary.due,
      },
    });
  } catch (error) {
    console.error('Submit manual payment error:', error);
    return res.status(error?.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Approve Manual Payment (Admin Only)
// @route   POST /api/payments/manual/:paymentId/approve
// @access  Private/Admin
const approveManualPayment = async (req, res) => {
  const log = await PaymentLog.findOneAndUpdate(
    { paymentId: req.params.paymentId, paymentMethod: 'manual', status: 'pending' },
    { $set: { status: 'success' } },
    { new: true }
  );
  if (!log) {
    return res.status(404).json({ success: false, message: 'Pending manual payment not found' });
  }

  const booking = await Booking.findById(log.bookingId);
  const updatedBooking =
    booking &&
    (await applyPaymentToBooking({
      booking,
      amount: log.amount,
      paymentId: log.paymentId,
      paymentProvider: 'cash',
    }));

  if (!updatedBooking) {
    await PaymentLog.updateOne(
      { _id: log._id, status: 'success' },
      { $set: { status: 'pending' } }
    );
    return res
      .status(409)
      .json({ success: false, message: 'Manual payment exceeds the current due amount' });
  }

  await sendPaymentReceiptOnce({
    paymentLog: log,
    booking: updatedBooking,
    amount: log.amount,
  });

  return res.json({
    success: true,
    message: 'Manual payment approved',
    data: { booking: updatedBooking },
  });
};

const getPaymentStatus = async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.bookingId, userId: req.user._id })
    .select(
      'paymentStatus status roomType durationMonths razorpayOrderId razorpayPaymentId totalAmount amountPaid amountDue paymentCompletedAt'
    )
    .lean();
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  const summary = getPaymentSummary(booking);
  return res.json({
    success: true,
    data: { ...booking, amountPaid: summary.paid, amountDue: summary.due },
  });
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
      return res.json({
        success: true,
        message: 'Refund already processed',
        data: { refundId: booking.refundId },
      });
    }
    if (!['paid', 'partially_paid'].includes(booking.paymentStatus)) {
      return res.status(400).json({ success: false, message: 'No refundable payment found' });
    }

    const refundAmount = Number(booking.amountPaid || booking.totalAmount);
    let refundSuccess = false;
    let refundId = '';

    if (booking.paymentProvider === 'razorpay') {
      const refund = await razorpay.payments.refund(booking.paymentId, {
        amount: Math.round(refundAmount * 100),
        notes: { reason },
      });
      refundSuccess = !!refund;
      refundId = refund?.id || '';
    } else if (booking.paymentProvider === 'stripe' && stripe) {
      const refund = await stripe.refunds.create({
        payment_intent: booking.paymentId,
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
        amount: refundAmount,
        status: 'refunded',
        paymentId: `${booking.paymentId}:refund:${refundId}`,
        note: reason,
        ipAddress: req.ip,
      });
    }

    return res.json({
      success: refundSuccess,
      message: refundSuccess ? 'Refund processed successfully' : 'Refund failed',
    });
  } catch (error) {
    console.error('Refund error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Payment History
// @route   GET /api/payments/history
// @access  Private
const getPaymentHistory = async (req, res) => {
  try {
    const payments = await PaymentLog.find({ userId: req.user._id })
      .populate({
        path: 'bookingId',
        select: 'pgId roomType durationMonths totalAmount amountPaid amountDue checkInDate checkOutDate',
        populate: { path: 'pgId', select: 'name' },
      })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Webhook for Payment Events
// @route   POST /api/payments/webhook
// @access  Public (HMAC Verified)
const paymentWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('Webhook secret not configured');
      return res.status(400).json({ success: false });
    }

    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!signature || !timingSafeEqualHex(expectedSignature, signature)) {
      return res.status(400).json({ success: false });
    }

    const event = req.body.event;
    const payment = req.body.payload?.payment?.entity;

    if (event === 'payment.captured' && payment) {
      const bookingId = payment.notes?.bookingId;
      const booking =
        bookingId &&
        (await Booking.findOne({ _id: bookingId, razorpayOrderId: payment.order_id }));
      const expectedAmount =
        booking && Number(booking.pendingPaymentAmount || getPaymentSummary(booking).due);

      if (
        !booking ||
        payment.amount !== Math.round(expectedAmount * 100) ||
        payment.currency !== 'INR'
      ) {
        return res.status(400).json({ success: false });
      }

      const confirmedBooking = await applyPaymentToBooking({
        booking,
        amount: expectedAmount,
        paymentId: payment.id,
        paymentProvider: 'razorpay',
      });

      if (confirmedBooking) {
        const paymentLog = await PaymentLog.findOneAndUpdate(
          { paymentId: payment.id },
          {
            $set: {
              bookingId: booking._id,
              userId: booking.userId,
              amount: expectedAmount,
              status: 'success',
              paymentMethod: 'razorpay',
              note: `Webhook verified (${payment.method || 'online'}) | ${confirmedBooking.roomType} (${confirmedBooking.durationMonths}M)`,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        await sendPaymentReceiptOnce({
          paymentLog,
          booking: confirmedBooking,
          amount: expectedAmount,
          orderId: payment.order_id,
        });
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ success: false });
  }
};

module.exports = {
  initializePayment,
  verifyPayment,
  refundPayment,
  getPaymentHistory,
  getPaymentStatus,
  generateBookingUpiQr,
  submitManualPayment,
  approveManualPayment,
  paymentWebhook,
};