const CallCredit = require('../models/CallCredit');
const PGListing = require('../models/PGListing');

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

    // Deduct 1 credit
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

    // Get PG owner contact info
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

// Create order for call credits
const createCallCreditOrder = async (req, res) => {
  try {
    const { amount = 10 } = req.body;
    const userId = req.user.id;

    // Mock response for now (since Razorpay integration needs keys)
    res.json({
      success: true,
      orderId: `mock_order_${Date.now()}`,
      amount: amount * 100,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || 'mock_key_id'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Failed to create order' });
  }
};

// Verify payment and add credits
const verifyCallCreditPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.id;

    let credit = await CallCredit.findOne({ userId });
    if (!credit) {
      credit = new CallCredit({ userId, balance: 0 });
    }

    credit.balance += 4;
    credit.totalPurchased += 4;
    credit.transactions.push({
      amount: 10,
      type: 'purchase',
      cost: 10,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id
    });
    credit.updatedAt = new Date();

    await credit.save();

    res.json({
      success: true,
      message: 'Credits added successfully',
      balance: credit.balance
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
};

// Check if user can contact
const canContact = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pgId, type } = req.body;

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
  getCreditBalance,
  useContactCredit,
  createCallCreditOrder,
  verifyCallCreditPayment,
  canContact
};