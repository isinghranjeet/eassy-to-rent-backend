// backend/src/models/Booking.js (Enhanced)
import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PGListing',
    required: true
  },
  roomType: {
    type: String,
    required: true
  },
  checkInDate: {
    type: Date,
    required: true
  },
  checkOutDate: {
    type: Date,
    required: true
  },
  durationMonths: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  discountApplied: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'refunded'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  guestDetails: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    aadharNumber: String,
    emergencyContact: String
  },
  specialRequests: String,
  reviewed: {
    type: Boolean,
    default: false
  },
  reviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  },
  cancelledAt: Date,
  cancellationReason: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for faster queries
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ pgId: 1, checkInDate: 1 });

export default mongoose.model('Booking', bookingSchema);