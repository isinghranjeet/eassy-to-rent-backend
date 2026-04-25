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

module.exports = mongoose.model('Wishlist', wishlistSchema);