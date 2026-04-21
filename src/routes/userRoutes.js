const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response');

// Get all users (admin only)
router.get('/', protect, adminOnly, async (req, res) => {
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

// Get single user
router.get('/:id', protect, adminOnly, async (req, res) => {
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

// Update user
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
    return successResponse(res, { data: user, message: 'User updated successfully' });
  } catch (error) {
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

// Delete user
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return errorResponse(res, { statusCode: 404, message: 'User not found' });
    }
    return successResponse(res, { message: 'User deleted successfully' });
  } catch (error) {
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

// Update user status
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
    return successResponse(res, { data: user, message: `User ${status === 'active' ? 'activated' : 'suspended'} successfully` });
  } catch (error) {
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

module.exports = router;