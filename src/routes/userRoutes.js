const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response');

// ✅ Import Advanced Cache Middleware and Invalidation Helper
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');

// ✅ Corrected import path from modular admin controllers
const { getUserActivity, getUserStats } = require('../controllers/admin/adminUserController');

// Get all users (admin only) -> ⚡ Cached for 120 seconds
router.get('/', protect, adminOnly, cacheMiddleware(120), async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    return successResponse(res, {
      data: {
        items: users,
        total: users.length
      }
    });
  } catch (error) {
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

// Get single user -> ⚡ Cached for 120 seconds
router.get('/:id', protect, adminOnly, cacheMiddleware(120), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return errorResponse(res, { statusCode: 404, message: 'User not found' });
    }
    return successResponse(res, { data: user });
  } catch (error) {
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

// Update user -> Invalidate cache on success
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return errorResponse(res, { statusCode: 404, message: 'User not found' });
    }

    // 🧹 Clear cache on user update
    await invalidateCache('etr_cache:*');

    return successResponse(res, { data: user, message: 'User updated successfully' });
  } catch (error) {
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

// Delete user -> Invalidate cache on success
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return errorResponse(res, { statusCode: 404, message: 'User not found' });
    }

    // 🧹 Clear cache on user deletion
    await invalidateCache('etr_cache:*');

    return successResponse(res, { message: 'User deleted successfully' });
  } catch (error) {
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

// Update user status -> Invalidate cache on success
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return errorResponse(res, { statusCode: 404, message: 'User not found' });
    }

    // 🧹 Clear cache on status change
    await invalidateCache('etr_cache:*');

    return successResponse(res, { data: user, message: `User ${status === 'active' ? 'activated' : 'suspended'} successfully` });
  } catch (error) {
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

// Get user activity history (admin only) -> ⚡ Cached for 60 seconds
router.get('/:id/activity', protect, adminOnly, cacheMiddleware(60), getUserActivity);

// Get user stats — bookings & reviews count (admin only) -> ⚡ Cached for 60 seconds
router.get('/:id/stats', protect, adminOnly, cacheMiddleware(60), getUserStats);

// Update wishlist email preference (self-service) -> Invalidate cache
router.put('/wishlist-email-preference', protect, async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return errorResponse(res, { statusCode: 400, message: 'enabled must be a boolean' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { wishlistEmailEnabled: enabled },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return errorResponse(res, { statusCode: 404, message: 'User not found' });
    }

    // 🧹 Clear cache on preference update
    await invalidateCache('etr_cache:*');

    return successResponse(res, {
      message: `Wishlist email notifications ${enabled ? 'enabled' : 'disabled'}`,
      data: { wishlistEmailEnabled: user.wishlistEmailEnabled }
    });
  } catch (error) {
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

module.exports = router;