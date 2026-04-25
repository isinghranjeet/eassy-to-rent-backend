const mongoose = require('mongoose');

const contactLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  pgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PGListing',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['call', 'whatsapp'],
    required: true
  },
  contactNumber: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound index to prevent spam
contactLogSchema.index({ userId: 1, pgId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('ContactLog', contactLogSchema);

