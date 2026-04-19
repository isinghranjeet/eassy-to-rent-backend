// backend/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Wishlist = require('../models/Wishlist');
const User = require('../models/User');
const { sendWishlistReminder, sendOfferEmail, sendBookingConfirmation } = require('../utils/sendEmail');
const { successResponse, errorResponse } = require('../utils/response');

// All routes require authentication
router.use(protect);

// Send wishlist reminder
router.post('/wishlist-reminder', async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id })
      .populate('items.pg');
    
    if (!wishlist || wishlist.items.length === 0) {
      return errorResponse(res, { statusCode: 400, message: 'No items in wishlist' });
    }
    
    const user = await User.findById(req.user._id);
    const sent = await sendWishlistReminder(user, wishlist.items);
    
    if (sent) {
      return successResponse(res, { message: 'Wishlist reminder sent successfully' });
    } else {
      return errorResponse(res, { statusCode: 500, message: 'Failed to send email' });
    }
  } catch (error) {
    console.error('Wishlist reminder error:', error);
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

// Send booking confirmation
router.post('/booking-confirmation', async (req, res) => {
  try {
    const { pgName, duration, totalAmount, moveInDate } = req.body;
    const user = await User.findById(req.user._id);
    
    const sent = await sendBookingConfirmation(user, { pgName, duration, totalAmount, moveInDate });
    
    if (sent) {
      return successResponse(res, { message: 'Booking confirmation sent successfully' });
    } else {
      return errorResponse(res, { statusCode: 500, message: 'Failed to send email' });
    }
  } catch (error) {
    console.error('Booking confirmation error:', error);
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

// ✅ Send offer email to ANY user (not just logged in)
router.post('/send-offer', async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email) {
      return errorResponse(res, { statusCode: 400, message: 'Email is required' });
    }
    
    const sent = await sendOfferEmail(email, name || 'User');
    
    if (sent) {
      return successResponse(res, { 
        message: `Offer email sent to ${email}`,
        data: { sentTo: email }
      });
    } else {
      return errorResponse(res, { 
        statusCode: 500, 
        message: 'Failed to send offer email. Please check SMTP configuration.' 
      });
    }
  } catch (error) {
    console.error('Send offer error:', error);
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

// Test endpoint (kept for debugging)
router.post('/test', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const sent = await sendOfferEmail(user.email, user.name);
    
    if (sent) {
      return successResponse(res, { 
        message: 'Test email sent successfully', 
        data: { sentTo: user.email } 
      });
    } else {
      return errorResponse(res, { 
        statusCode: 500, 
        message: 'Failed to send test email' 
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

module.exports = router;