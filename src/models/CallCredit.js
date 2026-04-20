const mongoose = require('mongoose');

const callCreditSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPurchased: {
    type: Number,
    default: 0
  },
  totalUsed: {
    type: Number,
    default: 0
  },
  transactions: [{
    type: { 
      type: String, 
      enum: ['purchase', 'use', 'refund'],
      required: true
    },
    pgId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'PGListing' 
    },
    contactType: { 
      type: String, 
      enum: ['call', 'whatsapp'] 
    },
    amount: {
      type: Number,
      default: 0
    },
    cost: {
      type: Number,
      default: 0
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    date: { 
      type: Date, 
      default: Date.now 
    }
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update timestamp on save
callCreditSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CallCredit', callCreditSchema);