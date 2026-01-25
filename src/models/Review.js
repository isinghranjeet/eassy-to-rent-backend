const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
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
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  likes: {
    type: Number,
    default: 0
  },
  replies: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Ensure one review per user per PG
reviewSchema.index({ user: 1, pgListing: 1 }, { unique: true });

// Index for sorting and filtering
reviewSchema.index({ pgListing: 1, rating: -1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });

// Update PG listing rating when review is added, updated, or deleted
reviewSchema.post('save', async function() {
  await updatePGListingRating(this.pgListing);
});

reviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    await updatePGListingRating(doc.pgListing);
  }
});

reviewSchema.post('findOneAndUpdate', async function(doc) {
  if (doc) {
    await updatePGListingRating(doc.pgListing);
  }
});

async function updatePGListingRating(pgListingId) {
  const Review = mongoose.model('Review');
  
  const stats = await Review.aggregate([
    { $match: { pgListing: pgListingId } },
    {
      $group: {
        _id: '$pgListing',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 }
      }
    }
  ]);
  
  if (stats.length > 0) {
    await mongoose.model('PGListing').findByIdAndUpdate(pgListingId, {
      rating: parseFloat(stats[0].averageRating.toFixed(1)),
      reviewCount: stats[0].reviewCount
    });
  } else {
    await mongoose.model('PGListing').findByIdAndUpdate(pgListingId, {
      rating: 0,
      reviewCount: 0
    });
  }
}

module.exports = mongoose.model('Review', reviewSchema);