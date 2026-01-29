const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    pgListing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PGListing',
      required: true
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    contactInfo: {
      type: String
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved'],
      default: 'pending'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);