// backend/src/models/Booking.js
const mongoose = require('mongoose');

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
    required: true,
    default: 'Single Occupancy'
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
    required: true,
    default: 1
  },
  totalAmount: {
    type: Number,
    required: true
  },
  discountApplied: {
    type: Number,
    default: 0
  },
  
  // Booking Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'refunded'],
    default: 'pending'
  },
  
  // Payment Status
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  
  // Payment Gateway Fields
  razorpayOrderId: {
    type: String,
    default: ''
  },
  razorpayPaymentId: {
    type: String,
    default: ''
  },
  razorpaySignature: {
    type: String,
    default: ''
  },
  
  // ✅ NEW: Multi-Provider Support
  paymentProvider: {
    type: String,
    enum: ['razorpay', 'stripe', 'cash', 'none'],
    default: 'none'
  },
  paymentId: {
    type: String,
    default: ''
  },
  
  // ✅ NEW: Payment Tracking
  paymentAttempts: {
    type: Number,
    default: 0
  },
  lastPaymentAttempt: {
    type: Date
  },
  paymentCompletedAt: {
    type: Date
  },
  
  // ✅ NEW: Refund Tracking
  refundAmount: {
    type: Number,
    default: 0
  },
  refundReason: {
    type: String,
    default: ''
  },
  refundedAt: {
    type: Date
  },
  refundId: {
    type: String,
    default: ''
  },
  
  // ✅ NEW: Payment Metadata
  paymentMetadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Guest Details
  guestDetails: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    aadharNumber: { type: String, default: '' },
    emergencyContact: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' }
  },
  
  specialRequests: {
    type: String,
    default: ''
  },
  
  // Review Tracking
  reviewed: {
    type: Boolean,
    default: false
  },
  reviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  },
  
  // Cancellation Tracking
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String,
    default: ''
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // ✅ NEW: Invoice Details
  invoiceNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  invoiceUrl: {
    type: String,
    default: ''
  },
  
  // ✅ NEW: Admin Notes
  adminNotes: {
    type: String,
    default: ''
  },
  
  // ✅ NEW: Coupon/Discount Details
  couponCode: {
    type: String,
    default: ''
  },
  couponDiscount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// ✅ Generate unique invoice number before saving
bookingSchema.pre('save', async function(next) {
  if (this.isNew && this.paymentStatus === 'paid' && !this.invoiceNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Booking').countDocuments() + 1;
    this.invoiceNumber = `INV-${year}-${String(count).padStart(6, '0')}`;
  }
  next();
});

// ✅ Virtual for payment status display
bookingSchema.virtual('paymentStatusDisplay').get(function() {
  const statusMap = {
    'pending': 'Awaiting Payment',
    'processing': 'Processing Payment',
    'paid': 'Payment Completed',
    'failed': 'Payment Failed',
    'refunded': 'Refunded',
    'partially_refunded': 'Partially Refunded'
  };
  return statusMap[this.paymentStatus] || this.paymentStatus;
});

// ✅ Virtual for booking status display
bookingSchema.virtual('bookingStatusDisplay').get(function() {
  const statusMap = {
    'pending': 'Pending Confirmation',
    'confirmed': 'Confirmed',
    'cancelled': 'Cancelled',
    'completed': 'Completed',
    'refunded': 'Refunded'
  };
  return statusMap[this.status] || this.status;
});

// ✅ Virtual for can cancel
bookingSchema.virtual('canCancel').get(function() {
  if (this.status !== 'confirmed') return false;
  if (this.paymentStatus !== 'paid') return false;
  
  const daysUntilCheckIn = Math.ceil(
    (new Date(this.checkInDate) - new Date()) / (1000 * 60 * 60 * 24)
  );
  
  // Can cancel only if 3+ days before check-in
  return daysUntilCheckIn >= 3;
});

// ✅ Virtual for refund eligibility
bookingSchema.virtual('refundEligible').get(function() {
  if (this.paymentStatus !== 'paid') return false;
  if (this.status === 'refunded') return false;
  
  const daysUntilCheckIn = Math.ceil(
    (new Date(this.checkInDate) - new Date()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysUntilCheckIn >= 7) return { eligible: true, percentage: 100 };
  if (daysUntilCheckIn >= 3) return { eligible: true, percentage: 50 };
  return { eligible: false, percentage: 0 };
});

// ✅ Indexes - Consolidated (removed duplicates)
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ pgId: 1, checkInDate: 1 });
// Inventory-aware availability checks
bookingSchema.index({ pgId: 1, roomType: 1, status: 1, checkInDate: 1, checkOutDate: 1 });

bookingSchema.index({ invoiceNumber: 1 }, { sparse: true }); // Single unique index
bookingSchema.index({ paymentStatus: 1, status: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ razorpayOrderId: 1, sparse: true });
bookingSchema.index({ checkInDate: 1, status: 1 });

// TTL index for pending payments
bookingSchema.index({ 
  createdAt: 1 
}, { 
  expireAfterSeconds: 3600,
  partialFilterExpression: { 
    paymentStatus: 'pending',
    status: 'pending'
  }
});

module.exports = mongoose.model('Booking', bookingSchema);