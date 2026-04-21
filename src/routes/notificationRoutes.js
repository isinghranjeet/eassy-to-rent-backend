const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const Wishlist = require('../models/Wishlist');
const User = require('../models/User');
const { sendWishlistReminder, sendOfferEmail, sendBookingConfirmation } = require('../utils/sendEmail');
const { successResponse, errorResponse } = require('../utils/response');

// ======================
// USER ROUTES (Requires Authentication)
// ======================
router.use(protect);

// @desc    Send wishlist reminder to current user (manual)
// @route   POST /api/notifications/wishlist-reminder
// @access  Private
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

// @desc    Send booking confirmation to current user
// @route   POST /api/notifications/booking-confirmation
// @access  Private
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

// @desc    Send test email to current user (debugging)
// @route   POST /api/notifications/test
// @access  Private
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

// ======================
// ADMIN ROUTES (Requires Authentication + Admin Access)
// ======================

// @desc    Send offer email to ANY user (admin only)
// @route   POST /api/notifications/send-offer
// @access  Private/Admin
router.post('/send-offer', adminOnly, async (req, res) => {
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

// @desc    Send wishlist reminder to SPECIFIC user (admin only)
// @route   POST /api/notifications/admin/wishlist-reminder/:userId
// @access  Private/Admin
router.post('/admin/wishlist-reminder/:userId', adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, { statusCode: 404, message: 'User not found' });
    }
    
    // Get user's wishlist
    const wishlist = await Wishlist.findOne({ user: userId })
      .populate('items.pg');
    
    if (!wishlist || wishlist.items.length === 0) {
      return errorResponse(res, { statusCode: 400, message: 'User has no wishlist items' });
    }
    
    // Send reminder
    const sent = await sendWishlistReminder(user, wishlist.items);
    
    if (sent) {
      return successResponse(res, { 
        message: `Wishlist reminder sent to ${user.email}`,
        data: { sentTo: user.email, itemsCount: wishlist.items.length }
      });
    } else {
      return errorResponse(res, { 
        statusCode: 500, 
        message: 'Failed to send email. Please check SMTP configuration.' 
      });
    }
  } catch (error) {
    console.error('Admin wishlist reminder error:', error);
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

// @desc    Send bulk wishlist reminders to ALL users with wishlist items (admin only)
// @route   POST /api/notifications/admin/bulk-wishlist-reminder
// @access  Private/Admin
router.post('/admin/bulk-wishlist-reminder', adminOnly, async (req, res) => {
  try {
    // Find all users who have wishlist items
    const usersWithWishlist = await Wishlist.find({ 'items.0': { $exists: true } }).distinct('user');
    
    if (usersWithWishlist.length === 0) {
      return errorResponse(res, { statusCode: 400, message: 'No users with wishlist items found' });
    }
    
    let sentCount = 0;
    let failCount = 0;
    const failedUsers = [];
    
    for (const userId of usersWithWishlist) {
      const user = await User.findById(userId);
      const wishlist = await Wishlist.findOne({ user: userId }).populate('items.pg');
      
      if (user && wishlist && wishlist.items.length > 0) {
        const sent = await sendWishlistReminder(user, wishlist.items);
        if (sent) {
          sentCount++;
        } else {
          failCount++;
          failedUsers.push(user.email);
        }
      } else {
        failCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return successResponse(res, { 
      message: `Bulk reminder completed: ${sentCount} sent, ${failCount} failed`,
      data: { 
        sentCount, 
        failCount, 
        totalUsers: usersWithWishlist.length,
        failedUsers: failedUsers 
      }
    });
  } catch (error) {
    console.error('Bulk wishlist reminder error:', error);
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

// @desc    Send bulk offer emails to ALL active users (admin only)
// @route   POST /api/notifications/admin/bulk-offer
// @access  Private/Admin
router.post('/admin/bulk-offer', adminOnly, async (req, res) => {
  try {
    const { offerMessage, discountCode } = req.body;
    
    // Get all active users
    const activeUsers = await User.find({ status: 'active' });
    
    if (activeUsers.length === 0) {
      return errorResponse(res, { statusCode: 400, message: 'No active users found' });
    }
    
    let sentCount = 0;
    let failCount = 0;
    
    for (const user of activeUsers) {
      const sent = await sendOfferEmail(user.email, user.name, offerMessage, discountCode);
      if (sent) {
        sentCount++;
      } else {
        failCount++;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return successResponse(res, { 
      message: `Bulk offer completed: ${sentCount} sent, ${failCount} failed`,
      data: { sentCount, failCount, totalUsers: activeUsers.length }
    });
  } catch (error) {
    console.error('Bulk offer error:', error);
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

// @desc    Get notification stats (admin only)
// @route   GET /api/notifications/admin/stats
// @access  Private/Admin
router.get('/admin/stats', adminOnly, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const usersWithWishlist = await Wishlist.countDocuments({ 'items.0': { $exists: true } });
    const activeUsers = await User.countDocuments({ status: 'active' });
    const suspendedUsers = await User.countDocuments({ status: 'suspended' });
    
    // Get wishlist items count
    const wishlistStats = await Wishlist.aggregate([
      { $unwind: '$items' },
      { $group: { _id: null, totalItems: { $sum: 1 } } }
    ]);
    
    return successResponse(res, {
      data: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        usersWithWishlist,
        totalWishlistItems: wishlistStats[0]?.totalItems || 0,
        usersWithoutWishlist: totalUsers - usersWithWishlist
      }
    });
  } catch (error) {
    console.error('Notification stats error:', error);
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

module.exports = router;