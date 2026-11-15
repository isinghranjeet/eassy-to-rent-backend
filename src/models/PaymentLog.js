const mongoose = require('mongoose');

const paymentLogSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true // Indexed via compound index below as well, but clean here
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  status: {
    type: String,
    enum: ['pending', 'initiated', 'processing', 'success', 'failed', 'refunded'],
    default: 'initiated',
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'stripe', 'card', 'upi', 'upi_qr', 'manual', 'netbanking'],
    default: 'razorpay'
  },
  paymentId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  error: {
    type: String,
    default: ''
  },
  note: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  receiptStatus: {
    type: String,
    enum: ['pending', 'sending', 'sent', 'failed'],
    default: 'pending',
    index: true
  },
  receiptMessageId: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ Optimized Compound Indexes (Single field indexes handled cleanly)
paymentLogSchema.index({ bookingId: 1, createdAt: -1 });
paymentLogSchema.index({ userId: 1, createdAt: -1 });
paymentLogSchema.index({ status: 1, createdAt: -1 });

const PaymentLog = mongoose.model('PaymentLog', paymentLogSchema);

module.exports = PaymentLog;