const User = require('../models/User');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Wishlist = require('../models/Wishlist');
const { successResponse, errorResponse } = require('../utils/response');

// @desc    Get full user profile
// @route   GET /api/profile
// @access  Private
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -otp -otpExpires -refreshToken')
      .lean();

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    // Get additional stats - query from actual collections
    const [bookingCount, reviewCount, wishlistDoc] = await Promise.all([
      Booking.countDocuments({ userId: req.user._id }),
      Review.countDocuments({ userId: req.user._id }),
      Wishlist.findOne({ user: req.user._id }).select('items').lean(),
    ]);

    const totalWishlist = wishlistDoc?.items?.length || 0;

    const profileData = {
      ...user,
      stats: {
        totalBookings: bookingCount,
        totalReviews: reviewCount,
        totalWishlist,
      },
      memberSince: user.createdAt,
      accountType: user.role,
      isVerified: user.isEmailVerified || false,
    };

    return successResponse(res, {
      message: 'Profile fetched successfully',
      data: profileData,
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    const allowedFields = [
      'name', 'phone', 'bio', 'gender', 'dateOfBirth',
      'occupation', 'college', 'address', 'city', 'state', 'country',
    ];

    // Only update allowed fields
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'name' && typeof req.body.name === 'string') {
          user.name = req.body.name.trim();
        } else if (field === 'phone' && typeof req.body.phone === 'string') {
          user.phone = req.body.phone.trim();
        } else {
          user[field] = req.body[field];
        }
      }
    }

    const updatedUser = await user.save();

    return successResponse(res, {
      message: 'Profile updated successfully',
      data: updatedUser.toJSON(),
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Update profile photo
// @route   PUT /api/profile/photo
// @access  Private
exports.updateProfilePhoto = async (req, res, next) => {
  try {
    const { profileImage } = req.body;

    if (!profileImage) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Profile image URL is required',
      });
    }

    // Validate URL format
    try {
      new URL(profileImage);
    } catch {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid image URL',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage, avatar: profileImage },
      { new: true }
    ).select('-password -otp -otpExpires -refreshToken');

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    return successResponse(res, {
      message: 'Profile photo updated successfully',
      data: { profileImage: user.profileImage },
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Change password
// @route   PUT /api/profile/password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide current password and new password',
      });
    }

    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      });
    }

    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    // Check if user has a password (not social login only)
    if (!user.password) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'This account uses social login. Set a password via forgot password feature.',
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'Current password is incorrect',
      });
    }

    // Check new password is different
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'New password must be different from current password',
      });
    }

    user.password = newPassword;
    await user.save();

    return successResponse(res, {
      message: 'Password changed successfully',
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Update notification settings
// @route   PUT /api/profile/settings
// @access  Private
exports.updateSettings = async (req, res, next) => {
  try {
    const allowedSettings = [
      'emailNotifications', 'bookingUpdates', 'propertyAlerts',
      'marketingEmails', 'pushNotifications', 'profileVisibility',
      'wishlistEmailEnabled',
    ];

    const updateData = {};
    for (const field of allowedSettings) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'No valid settings provided',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpires -refreshToken');

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    return successResponse(res, {
      message: 'Settings updated successfully',
      data: {
        emailNotifications: user.emailNotifications,
        bookingUpdates: user.bookingUpdates,
        propertyAlerts: user.propertyAlerts,
        marketingEmails: user.marketingEmails,
        pushNotifications: user.pushNotifications,
        profileVisibility: user.profileVisibility,
        wishlistEmailEnabled: user.wishlistEmailEnabled,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Delete user account
// @route   DELETE /api/profile
// @access  Private
exports.deleteAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    // Prevent admin self-deletion
    if (user.role === 'admin') {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Admin accounts cannot be deleted. Contact support.',
      });
    }

    // Delete associated data
    await Promise.all([
      Booking.deleteMany({ userId: user._id }),
      Review.deleteMany({ userId: user._id }),
      // Note: Wishlist items are embedded in the User model, so they're deleted with the user
    ]);

    await User.findByIdAndDelete(user._id);

    return successResponse(res, {
      message: 'Account deleted successfully',
    });
  } catch (error) {
    return next(error);
  }
};

