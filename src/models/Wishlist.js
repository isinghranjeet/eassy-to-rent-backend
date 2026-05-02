const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
  pg: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PGListing',  // ← 'PG' ki jagah 'PGListing'
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  lastNotifiedAt: {
    type: Date,
    default: null
  },
  lastKnownPrice: {
    type: Number,
    default: null
  },
  lastKnownAvailability: {
    type: String,
    default: null
  }
});

const wishlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [wishlistItemSchema]
}, {
  timestamps: true
});

// ✅ OPTIMIZED: Add indexes for performance
wishlistSchema.index({ user: 1, 'items.pg': 1 }); // Compound for user's wishlist items
wishlistSchema.index({ user: 1, createdAt: -1 }); // For recent wishlist queries
wishlistSchema.index({ 'items.addedAt': -1 }); // For sorting by added date

module.exports = mongoose.model('Wishlist', wishlistSchema);
