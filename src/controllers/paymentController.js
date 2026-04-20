const Razorpay = require('razorpay');
const crypto = require('crypto');
const CallCredit = require('../models/CallCredit');
const PGListing = require('../models/PGListing');

// Initialize Razorpay with your test keys
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_SflfuTdO7GtSJg',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'z96jUOnHgrXvouEqxVb5AAr1'
});

// Create REAL Razorpay order (NO MOCK)
const createCallCreditOrder = async (req, res) => {
  try {
    const { amount = 10 } = req.body;
    const userId = req.user.id;

    console.log('Creating REAL Razorpay order for user:', userId);

    const options = {
      amount: amount * 100, // ₹10 = 1000 paise
      currency: 'INR',
      receipt: `receipt_${userId}_${Date.now()}`,
      notes: {
        userId: userId,
        credits: 4,
        type: 'call_credit'
      },
      payment_capture: 1
    };

    // Create REAL order from Razorpay
    const order = await razorpay.orders.create(options);
    
    console.log('✅ REAL Razorpay order created:', order.id);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('❌ Error creating Razorpay order:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create order'
    });
  }
};

// Verify payment and add credits
const verifyCallCreditPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.id;

    console.log('Verifying payment for order:', razorpay_order_id);

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('❌ Invalid signature');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // Fetch payment details
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    
    if (payment.status !== 'captured') {
      console.error('❌ Payment not captured:', payment.status);
      return res.status(400).json({ success: false, message: 'Payment not captured' });
    }

    // Add credits to user
    let credit = await CallCredit.findOne({ userId });
    if (!credit) {
      credit = new CallCredit({ userId, balance: 0 });
    }

    credit.balance += 4;
    credit.totalPurchased += 4;
    credit.transactions.push({
      amount: payment.amount / 100,
      type: 'purchase',
      cost: payment.amount / 100,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      date: new Date()
    });
    credit.updatedAt = new Date();

    await credit.save();

    console.log('✅ Credits added. New balance:', credit.balance);

    res.json({
      success: true,
      message: 'Credits added successfully',
      balance: credit.balance
    });
  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Payment verification failed'
    });
  }
};

// Get user credit balance
const getCreditBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    
    let credit = await CallCredit.findOne({ userId });
    
    if (!credit) {
      credit = new CallCredit({ 
        userId, 
        balance: 0,
        totalPurchased: 0,
        totalUsed: 0,
        transactions: []
      });
      await credit.save();
    }
    
    res.json({
      success: true,
      balance: credit.balance,
      totalPurchased: credit.totalPurchased,
      totalUsed: credit.totalUsed
    });
  } catch (error) {
    console.error('Error fetching credit balance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch credit balance' 
    });
  }
};

// Use credit for contact
const useContactCredit = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pgId, contactType } = req.body;

    if (!pgId || !contactType) {
      return res.status(400).json({
        success: false,
        message: 'PG ID and contact type are required'
      });
    }

    let credit = await CallCredit.findOne({ userId });
    
    if (!credit) {
      credit = new CallCredit({ 
        userId, 
        balance: 0,
        totalPurchased: 0,
        totalUsed: 0,
        transactions: []
      });
      await credit.save();
    }
    
    if (credit.balance < 1) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient credits. Please purchase credits to contact property owner.',
        balance: 0
      });
    }

    credit.balance -= 1;
    credit.totalUsed += 1;
    credit.transactions.push({
      type: 'use',
      pgId: pgId,
      contactType: contactType,
      cost: 2.5,
      date: new Date()
    });
    credit.updatedAt = new Date();

    await credit.save();

    const pg = await PGListing.findById(pgId);
    const contactNumber = pg?.ownerPhone || process.env.SUPPORT_PHONE || '9315058665';

    res.json({
      success: true,
      message: 'Credit used successfully',
      balance: credit.balance,
      contactNumber: contactNumber
    });
  } catch (error) {
    console.error('Error using credit:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to use credit' 
    });
  }
};

// Check if user can contact
const canContact = async (req, res) => {
  try {
    const userId = req.user.id;
    const credit = await CallCredit.findOne({ userId });
    
    if (!credit || credit.balance < 1) {
      return res.json({
        success: true,
        canContact: false,
        message: 'Insufficient credits. Please purchase credits to contact.',
        balance: credit?.balance || 0
      });
    }

    res.json({
      success: true,
      canContact: true,
      balance: credit.balance
    });
  } catch (error) {
    console.error('Error checking contact eligibility:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createCallCreditOrder,
  verifyCallCreditPayment,
  getCreditBalance,
  useContactCredit,
  canContact
};