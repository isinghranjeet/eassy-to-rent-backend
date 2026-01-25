const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pgListing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PGListing',
    required: true
  },
  roomType: {
    type: String,
    required: true,
    enum: ['single', 'double', 'triple', 'quad', 'dormitory']
  },
  startDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in months
    required: true,
    min: 1,
    max: 12
  },
  totalAmount: {
    type: Number,
    required: true
  },
  deposit: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  payment: {
    method: {
      type: String,
      enum: ['cash', 'online', 'bank_transfer'],
      default: 'online'
    },
    transactionId: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    amount: Number,
    date: Date
  },
  specialRequests: {
    type: String
  },
  contactInfo: {
    name: String,
    phone: String,
    email: String,
    emergencyContact: String
  }
}, {
  timestamps: true
});

// Indexes
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ pgListing: 1, status: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);