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
  // ✅ NEW: Status field for admin approval
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // ✅ NEW: Admin notes (optional)
  adminNote: {
    type: String,
    trim: true,
    maxlength: 500
  },
  // ✅ NEW: Approved by (admin user ID)
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // ✅ NEW: Approved at date
  approvedAt: {
    type: Date
  },
  likes: {
    type: Number,
    default: 0
  },
  helpful: {
    type: Number,
    default: 0
  },
  images: [{
    type: String
  }],
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
reviewSchema.index({ status: 1, createdAt: -1 }); // ✅ NEW: Index for pending reviews

// Update PG listing rating when review is added, updated, or deleted
reviewSchema.post('save', async function() {
  // ✅ Only update rating if review is approved
  if (this.status === 'approved') {
    await updatePGListingRating(this.pgListing);
  }
});

reviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc && doc.status === 'approved') {
    await updatePGListingRating(doc.pgListing);
  }
});

reviewSchema.post('findOneAndUpdate', async function(doc) {
  if (doc && doc.status === 'approved') {
    await updatePGListingRating(doc.pgListing);
  }
});

async function updatePGListingRating(pgListingId) {
  const Review = mongoose.model('Review');
  
  // ✅ Only aggregate approved reviews
  const stats = await Review.aggregate([
    { $match: { 
        pgListing: pgListingId,
        status: 'approved'  // ✅ Only approved reviews
      } 
    },
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

// ✅ NEW: Virtual for pending reviews count
reviewSchema.virtual('isPending').get(function() {
  return this.status === 'pending';
});

// ✅ NEW: Virtual for is approved
reviewSchema.virtual('isApproved').get(function() {
  return this.status === 'approved';
});

module.exports = mongoose.model('Review', reviewSchema);