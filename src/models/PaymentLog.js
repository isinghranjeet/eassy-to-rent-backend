const mongoose = require('mongoose');

const paymentLogSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['initiated', 'processing', 'success', 'failed', 'refunded'],
    default: 'initiated'
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'stripe', 'card', 'upi', 'netbanking'],
    default: 'razorpay'
  },
  paymentId: String,
  error: String,
  note: String,
  ipAddress: String,
  userAgent: String,
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

paymentLogSchema.index({ bookingId: 1, createdAt: -1 });
paymentLogSchema.index({ userId: 1, createdAt: -1 });
paymentLogSchema.index({ status: 1 });

module.exports = mongoose.model('PaymentLog', paymentLogSchema);