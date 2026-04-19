const mongoose = require('mongoose');

const priceAlertSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pg: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PGListing',
    required: true
  },
  desiredPrice: {
    type: Number,
    required: true
  },
  currentPrice: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
priceAlertSchema.index({ user: 1, pg: 1, isActive: 1 });
priceAlertSchema.index({ pg: 1, isActive: 1, notified: 1 });

module.exports = mongoose.model('PriceAlert', priceAlertSchema);