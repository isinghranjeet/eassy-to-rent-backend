const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
  type: {
      type: String,
      required: true,
      enum: [
        'USER_LOGIN',
        'USER_REGISTERED',
        'USER_SUSPENDED',
        'USER_ACTIVATED',
        'PG_CREATED',
        'PG_UPDATED',
        'PG_DELETED',
        'PG_VERIFIED',
        'PG_FEATURED',
        'BOOKING_CREATED',
        'BOOKING_CANCELLED',
        'BOOKING_CONFIRMED',
        'PAYMENT_SUCCESS',
        'PAYMENT_FAILED',
        'REVIEW_SUBMITTED',
        'REVIEW_APPROVED',
        'REVIEW_REJECTED',
        'WISHLIST_ADDED',
        'ADMIN_LOGIN',
        'ADMIN_ACTION',
      ],
    },
    message: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    userName: {
      type: String,
      required: false,
    },
    targetId: {
      type: String,
      required: false,
    },
    targetName: {
      type: String,
      required: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: 'activities',
  }
);

// Index for fast recent-activity queries
activitySchema.index({ createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);

