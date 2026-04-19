// backend/src/controllers/notificationController.js
const Wishlist = require('../models/Wishlist');
const User = require('../models/User');
const { sendWishlistReminder, sendBookingConfirmation, sendTestEmail } = require('../utils/sendEmail');
const { successResponse, errorResponse } = require('../utils/response');

// @desc    Send wishlist reminder to current user (manual)
// @route   POST /api/notifications/wishlist-reminder
// @access  Private
const sendWishlistReminderToUser = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id })
      .populate('items.pg');
    
    if (!wishlist || wishlist.items.length === 0) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'No items in your wishlist'
      });
    }
    
    const user = await User.findById(req.user._id);
    const sent = await sendWishlistReminder(user, wishlist.items);
    
    if (sent) {
      return successResponse(res, {
        message: 'Wishlist reminder sent successfully',
        data: { sentTo: user.email }
      });
    } else {
      return errorResponse(res, {
        statusCode: 500,
        message: 'Failed to send email. Please check email configuration.'
      });
    }
  } catch (error) {
    console.error('Send wishlist reminder error:', error);
    return errorResponse(res, {
      statusCode: 500,
      message: error.message
    });
  }
};

// @desc    Send booking confirmation (called after booking)
// @route   POST /api/notifications/booking-confirmation
// @access  Private
const sendBookingConfirmationToUser = async (req, res) => {
  try {
    const { pgName, duration, totalAmount, moveInDate } = req.body;
    const user = await User.findById(req.user._id);
    
    const bookingDetails = { pgName, duration, totalAmount, moveInDate };
    const sent = await sendBookingConfirmation(user, bookingDetails);
    
    if (sent) {
      return successResponse(res, {
        message: 'Booking confirmation sent successfully',
        data: { sentTo: user.email }
      });
    } else {
      return errorResponse(res, {
        statusCode: 500,
        message: 'Failed to send email. Please check email configuration.'
      });
    }
  } catch (error) {
    console.error('Send booking confirmation error:', error);
    return errorResponse(res, {
      statusCode: 500,
      message: error.message
    });
  }
};

// @desc    Test email (for debugging)
// @route   POST /api/notifications/test
// @access  Private
const testEmail = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const sent = await sendTestEmail(user.email, user.name);
    
    if (sent) {
      return successResponse(res, {
        message: 'Test email sent successfully',
        data: { sentTo: user.email }
      });
    } else {
      return errorResponse(res, {
        statusCode: 500,
        message: 'Failed to send test email. Please check email configuration.'
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    return errorResponse(res, {
      statusCode: 500,
      message: error.message
    });
  }
};

module.exports = {
  sendWishlistReminderToUser,
  sendBookingConfirmationToUser,
  testEmail
};