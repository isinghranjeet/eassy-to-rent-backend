// backend/src/models/CallCredit.js
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
  pendingTransactions: [{
    transactionId: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['upi', 'card', 'wallet'],
      default: 'upi'
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'expired'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: null
    },
    upiId: {
      type: String,
      default: null
    },
    razorpayOrderId: {
      type: String,
      default: null
    },
    razorpayPaymentId: {
      type: String,
      default: null
    }
  }],
  transactions: [{
    amount: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['purchase', 'use', 'refund', 'bonus'],
      required: true
    },
    pgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PGListing',
      default: null
    },
    contactType: {
      type: String,
      enum: ['call', 'whatsapp'],
      default: null
    },
    cost: {
      type: Number,
      default: 0
    },
    paymentMethod: {
      type: String,
      enum: ['UPI', 'Card', 'Razorpay', 'Wallet', 'Free'],
      default: 'Razorpay'
    },
    razorpayOrderId: {
      type: String,
      default: null
    },
    razorpayPaymentId: {
      type: String,
      default: null
    },
    description: {
      type: String,
      default: ''
    },
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

// Update the updatedAt timestamp on save
callCreditSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to add credits
callCreditSchema.methods.addCredits = async function(amount, paymentMethod, paymentDetails = {}) {
  this.balance += amount;
  this.totalPurchased += amount;
  this.transactions.push({
    amount: amount,
    type: 'purchase',
    paymentMethod: paymentMethod,
    razorpayOrderId: paymentDetails.razorpayOrderId || null,
    razorpayPaymentId: paymentDetails.razorpayPaymentId || null,
    description: `Purchased ${amount} credits via ${paymentMethod}`,
    date: new Date()
  });
  this.updatedAt = new Date();
  await this.save();
  return this.balance;
};

// Method to use credits
callCreditSchema.methods.useCredits = async function(amount, pgId, contactType) {
  if (this.balance < amount) {
    throw new Error('Insufficient credits');
  }
  
  this.balance -= amount;
  this.totalUsed += amount;
  this.transactions.push({
    amount: amount,
    type: 'use',
    pgId: pgId,
    contactType: contactType,
    cost: amount,
    description: `Used ${amount} credit(s) to ${contactType} owner of PG ${pgId}`,
    date: new Date()
  });
  this.updatedAt = new Date();
  await this.save();
  return this.balance;
};

// Method to check if user has enough credits
callCreditSchema.methods.hasEnoughCredits = function(amount = 1) {
  return this.balance >= amount;
};

// Method to get pending UPI transaction
callCreditSchema.methods.getPendingUPITransaction = function(transactionId) {
  if (!this.pendingTransactions) return null;
  return this.pendingTransactions.find(t => t.transactionId === transactionId && t.status === 'pending');
};

// Method to complete pending transaction
callCreditSchema.methods.completePendingTransaction = async function(transactionId) {
  const transaction = this.pendingTransactions.find(t => t.transactionId === transactionId);
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  if (transaction.status === 'completed') {
    throw new Error('Transaction already completed');
  }
  
  transaction.status = 'completed';
  transaction.completedAt = new Date();
  
  // Add credits to balance
  this.balance += 4;
  this.totalPurchased += 4;
  this.transactions.push({
    amount: 4,
    type: 'purchase',
    paymentMethod: 'UPI',
    description: `UPI payment of ₹${transaction.amount} completed. Transaction ID: ${transactionId}`,
    date: new Date()
  });
  
  this.updatedAt = new Date();
  await this.save();
  
  return this.balance;
};

// Static method to get or create user credit record
callCreditSchema.statics.getOrCreate = async function(userId) {
  let credit = await this.findOne({ userId });
  if (!credit) {
    credit = new this({
      userId: userId,
      balance: 0,
      totalPurchased: 0,
      totalUsed: 0,
      transactions: [],
      pendingTransactions: []
    });
    await credit.save();
  }
  return credit;
};

// Create indexes for better query performance
callCreditSchema.index({ userId: 1 });
callCreditSchema.index({ 'pendingTransactions.transactionId': 1 });
callCreditSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CallCredit', callCreditSchema);