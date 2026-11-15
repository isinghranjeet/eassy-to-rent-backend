// const crypto = require('crypto');
// const jwt = require('jsonwebtoken');
// const Razorpay = require('razorpay');
// const PaymentLog = require('../models/PaymentLog');
// const Booking = require('../models/Booking');
// const PGListing = require('../models/PGListing');
// const User = require('../models/User');
// const { sendPaymentReceipt } = require('./sendEmail');

// const paymentTokenSecret = () => process.env.PAYMENT_JWT_SECRET || process.env.JWT_SECRET;

// const timingSafeEqualHex = (expectedHex, actualHex) => {
//   if (typeof expectedHex !== 'string' || typeof actualHex !== 'string') return false;
//   if (expectedHex.length !== actualHex.length) return false;
//   try {
//     return crypto.timingSafeEqual(
//       Buffer.from(expectedHex, 'hex'),
//       Buffer.from(actualHex, 'hex')
//     );
//   } catch {
//     return false;
//   }
// };

// const getPaymentSummary = (booking) => {
//   const paid = Number(
//     booking.amountPaid || (booking.paymentStatus === 'paid' ? booking.totalAmount : 0)
//   );
//   const total = Number(booking.totalAmount || 0);
//   return { total, paid, due: Math.max(0, total - paid) };
// };

// // Server-side tamper-proof recalculation if user changes Room Type or Months before first payment
// const syncBookingPlanIfUnpaid = async ({ booking, pg, roomType, durationMonths }) => {
//   if (!roomType && !durationMonths) return booking;
//   if (Number(booking.amountPaid || 0) > 0 || booking.paymentStatus !== 'pending') {
//     return booking;
//   }

//   const listing = pg || (await PGListing.findById(booking.pgId).select('price roomInventory').lean());
//   if (!listing) return booking;

//   const nextRoomType = typeof roomType === 'string' && roomType.trim() ? roomType.trim() : booking.roomType;
//   const parsedMonths = Number(durationMonths || booking.durationMonths || 1);
//   const nextMonths = Number.isFinite(parsedMonths)
//     ? Math.max(1, Math.min(24, Math.round(parsedMonths)))
//     : booking.durationMonths || 1;

//   const inventoryEntry = listing.roomInventory?.[nextRoomType];
//   if (inventoryEntry && typeof inventoryEntry.available === 'number' && inventoryEntry.available <= 0) {
//     const err = new Error(`Selected room type (${nextRoomType}) is currently sold out`);
//     err.statusCode = 409;
//     throw err;
//   }

//   const roomRate = Number(inventoryEntry?.price || listing.price || 0);
//   if (roomRate > 0) {
//     const baseTotal = roomRate * nextMonths;
//     const discount = nextMonths >= 3 ? Math.round(baseTotal * 0.1) : 0;
//     const recalculatedTotal = Math.max(1, baseTotal - discount);

//     booking.roomType = nextRoomType;
//     booking.durationMonths = nextMonths;
//     booking.discountApplied = discount;
//     booking.totalAmount = recalculatedTotal;
//     booking.amountDue = recalculatedTotal;

//     if (booking.checkInDate) {
//       const checkOut = new Date(booking.checkInDate);
//       checkOut.setMonth(checkOut.getMonth() + nextMonths);
//       booking.checkOutDate = checkOut;
//     }

//     await booking.save();
//   }

//   return booking;
// };

// const applyPaymentToBooking = async ({
//   booking,
//   amount,
//   paymentId,
//   paymentProvider,
//   signature = '',
// }) => {
//   const summary = getPaymentSummary(booking);
//   const newPaid = summary.paid + amount;
//   if (amount <= 0 || newPaid > summary.total) return null;

//   return Booking.findOneAndUpdate(
//     {
//       _id: booking._id,
//       userId: booking.userId,
//       paymentStatus: { $in: ['pending', 'processing', 'partially_paid'] },
//       $or: [{ amountPaid: summary.paid }, { amountPaid: { $exists: false } }],
//     },
//     {
//       $set: {
//         amountPaid: newPaid,
//         amountDue: Math.max(0, summary.total - newPaid),
//         paymentStatus: newPaid >= summary.total ? 'paid' : 'partially_paid',
//         status: 'confirmed',
//         paymentId,
//         razorpayPaymentId: paymentProvider === 'razorpay' ? paymentId : booking.razorpayPaymentId,
//         paymentProvider,
//         razorpaySignature: signature || undefined,
//         paymentCompletedAt: new Date(),
//         pendingPaymentAmount: null,
//         razorpayOrderId: null,
//       },
//     },
//     { new: true }
//   );
// };

// const sendPaymentReceiptOnce = async ({ paymentLog, booking, amount, orderId = '' }) => {
//   const claim = await PaymentLog.findOneAndUpdate(
//     { _id: paymentLog._id, receiptStatus: 'pending' },
//     { $set: { receiptStatus: 'sending' } },
//     { new: true }
//   );
//   if (!claim) return;

//   try {
//     const user = await User.findById(booking.userId).select('name email').lean();
//     const populatedBooking = await Booking.findById(booking._id).populate('pgId', 'name');
//     const receipt = user?.email
//       ? await sendPaymentReceipt({
//           user,
//           booking: populatedBooking,
//           payment: { amount, currency: 'INR', paymentId: claim.paymentId, orderId },
//         })
//       : { success: false, messageId: '' };

//     await PaymentLog.updateOne(
//       { _id: claim._id, receiptStatus: 'sending' },
//       {
//         $set: {
//           receiptStatus: receipt.success ? 'sent' : 'failed',
//           receiptMessageId: receipt.messageId || '',
//         },
//       }
//     );
//   } catch {
//     await PaymentLog.updateOne(
//       { _id: claim._id, receiptStatus: 'sending' },
//       { $set: { receiptStatus: 'failed' } }
//     );
//   }
// };

// // Initialize Gateways
// let razorpay;
// try {
//   if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
//     razorpay = new Razorpay({
//       key_id: process.env.RAZORPAY_KEY_ID,
//       key_secret: process.env.RAZORPAY_KEY_SECRET,
//     });
//     console.log('✅ Razorpay initialized successfully');
//   } else {
//     razorpay = null;
//   }
// } catch (err) {
//   console.error('❌ Razorpay initialization failed:', err.message);
//   razorpay = null;
// }

// let stripe = null;
// if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== '') {
//   const Stripe = require('stripe');
//   stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// }

// const generatePaymentToken = ({ userId, bookingId, orderId, amountPaise }) => {
//   const secret = paymentTokenSecret();
//   if (!secret) throw new Error('Payment security configuration is missing');
//   return jwt.sign(
//     {
//       userId: String(userId),
//       bookingId: String(bookingId),
//       orderId: String(orderId),
//       amountPaise: Number(amountPaise),
//       nonce: crypto.randomBytes(8).toString('hex'),
//     },
//     secret,
//     { expiresIn: '15m' }
//   );
// };

// const verifyPaymentToken = (token) => {
//   try {
//     const secret = paymentTokenSecret();
//     if (!secret || !token) return null;
//     return jwt.verify(token, secret);
//   } catch {
//     return null;
//   }
// };

// module.exports = {
//   razorpay,
//   stripe,
//   timingSafeEqualHex,
//   getPaymentSummary,
//   syncBookingPlanIfUnpaid,
//   applyPaymentToBooking,
//   sendPaymentReceiptOnce,
//   generatePaymentToken,
//   verifyPaymentToken,
// };