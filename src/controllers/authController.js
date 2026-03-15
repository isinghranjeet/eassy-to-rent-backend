const User = require('../models/User');
const { generateToken } = require('../utils/generateToken');
const { successResponse, errorResponse } = require('../utils/response');
const sendEmail = require('../utils/sendEmail');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const rawName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const rawEmail =
      typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const rawPassword =
      typeof req.body.password === 'string' ? req.body.password.trim() : '';
    const role = ['user', 'owner'].includes(req.body.role) ? req.body.role : 'user';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : undefined;

    // Basic validation
    if (!rawName || !rawEmail || !rawPassword) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide name, email and password',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(rawEmail)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide a valid email address',
      });
    }

    if (rawPassword.length < 8) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Password must be at least 8 characters long',
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ email: rawEmail });
    if (userExists) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'User already exists with this email',
      });
    }

    // Create user
    const user = await User.create({
      name: rawName,
      email: rawEmail,
      password: rawPassword,
      role,
      phone,
    });

    // Generate token
    const token = generateToken(user._id, user.role);

    return successResponse(res, {
      statusCode: 201,
      message: 'User registered successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const rawEmail =
      typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const rawPassword =
      typeof req.body.password === 'string' ? req.body.password.trim() : '';

    // Validation
    if (!rawEmail || !rawPassword) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide email and password',
      });
    }

    // Check for user
    const user = await User.findOne({ email: rawEmail }).select('+password');

    if (!user) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'Invalid email or password',
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(rawPassword);
    if (!isPasswordMatch) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'Invalid email or password',
      });
    }

    // Check if user is active
    if (user.status === 'suspended') {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Your account has been suspended by an administrator. Please contact support.',
      });
    }

    if (user.status === 'inactive') {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Your account is inactive. Please contact support to reactivate.',
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
    await user.save();

    // Send email
    const subject = 'Your Login OTP - PG Finder';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #2563eb; text-align: center;">Login Verification OTP</h2>
        <p>Your OTP for login is:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; border-radius: 8px; margin: 20px 0; color: #1e40af; letter-spacing: 4px;">
          ${otp}
        </div>
        <p>This OTP is valid for <strong>5 minutes</strong>. If you did not attempt to log in, please ignore this email.</p>
      </div>
    `;

    await sendEmail({ email: user.email, subject, html, text: `Your OTP is: ${otp}` });

    const responseData = { requireOtp: true, email: user.email };
    if (process.env.NODE_ENV === 'development' || true) { // keep visible for testing
      responseData.debugOtp = otp;
    }

    return successResponse(res, {
      message: 'OTP sent to your email. Please verify to login.',
      statusCode: 200,
      data: responseData,
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    return successResponse(res, {
      message: 'Profile fetched successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        status: user.status,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
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

    // Update fields
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;

    // If password is provided, update it
    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    // Generate new token if email was changed
    const token = generateToken(updatedUser._id, updatedUser.role);

    return successResponse(res, {
      message: 'Profile updated successfully',
      data: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Create default admin user
// @route   POST /api/auth/init-admin
// @access  Public (only for initial setup - disable in production)
exports.createDefaultAdmin = async (req, res, next) => {
  try {
    // Check if admin already exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Admin user already exists',
        errors: {
          email: adminExists.email,
          role: adminExists.role,
        },
      });
    }

    // Create admin user — use ADMIN_EMAIL / ADMIN_PASSWORD from .env
    const admin = await User.create({
      name: 'Admin User',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin',
    });

    // Generate token
    const token = generateToken(admin._id, admin.role);

    return successResponse(res, {
      statusCode: 201,
      message: 'Default admin created successfully',
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Reset admin password to what's in .env
// @route   POST /api/auth/reset-admin
// @access  Public (one-time setup helper)
exports.resetAdmin = async (req, res, next) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    const admin = await User.findOne({ email: adminEmail, role: 'admin' });
    if (!admin) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'Admin user not found',
      });
    }

    // Set the new password (the pre-save hook in the User model will hash it)
    admin.password = adminPassword;
    await admin.save();

    return successResponse(res, {
      message: 'Admin password reset successfully',
      data: { email: admin.email },
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Get all users (admin only)
// @route   GET /api/auth/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password');
    return successResponse(res, {
      message: 'Users fetched successfully',
      data: {
        count: users.length,
        items: users,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Debug endpoint to check authentication
// @route   GET /api/auth/debug
// @access  Public
exports.debugAuth = (req, res) =>
  successResponse(res, {
    message: 'Auth debug endpoint',
    data: {
      headers: req.headers,
      timestamp: new Date().toISOString(),
    },
  });

// @desc    Get single user by ID (admin only)
// @route   GET /api/auth/users/:id
// @access  Private/Admin
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    return successResponse(res, {
      message: 'User fetched successfully',
      data: user,
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Delete user (admin only)
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user._id.toString()) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Admin cannot delete their own account',
      });
    }

    // Prevent deleting other admins
    if (user.role === 'admin') {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Cannot delete another admin account',
      });
    }

    await User.findByIdAndDelete(req.params.id);

    return successResponse(res, {
      message: `User "${user.name}" deleted successfully`,
      data: { deletedId: req.params.id },
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Update user status (admin only)
// @route   PUT /api/auth/users/:id/status
// @access  Private/Admin
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid status. Must be: active, inactive, or suspended',
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    // Prevent admin from changing their own status
    if (user._id.toString() === req.user._id.toString()) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Admin cannot change their own status',
      });
    }

    user.status = status;
    await user.save();

    return successResponse(res, {
      message: `User status updated to "${status}"`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Verify Login OTP
// @route   POST /api/auth/verify-login-otp
// @access  Public
exports.verifyLoginOtp = async (req, res, next) => {
  try {
    const rawEmail = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';

    if (!rawEmail || !otp) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide email and OTP',
      });
    }

    const user = await User.findOne({ email: rawEmail });

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    if (user.otp !== otp) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'Invalid OTP',
      });
    }

    if (user.otpExpires < Date.now()) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'OTP has expired',
      });
    }

    // OTP is valid
    user.otp = null;
    user.otpExpires = null;
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id, user.role);

    return successResponse(res, {
      message: 'Login successful',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        token,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Forgot Password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const rawEmail = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';

    if (!rawEmail) {
      return errorResponse(res, { statusCode: 400, message: 'Please provide your email address' });
    }

    const user = await User.findOne({ email: rawEmail });
    if (!user) {
      return errorResponse(res, { statusCode: 404, message: 'No account found with this email' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #2563eb; text-align: center;">Reset Your Password</h2>
        <p>You requested a password reset. Use the OTP below:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; border-radius: 8px; margin: 20px 0; color: #1e40af; letter-spacing: 4px;">
          ${otp}
        </div>
        <p>This OTP is valid for <strong>10 minutes</strong>. If you didn't request this, ignore this email.</p>
      </div>
    `;

    await sendEmail({ email: user.email, subject: 'Password Reset OTP - PG Finder', html, text: `Your OTP is: ${otp}` });

    return successResponse(res, {
      message: 'Password reset OTP sent to your email',
      data: { email: user.email },
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Reset Password - Verify OTP & Set New Password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const rawEmail = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword.trim() : '';

    if (!rawEmail || !otp || !newPassword) {
      return errorResponse(res, { statusCode: 400, message: 'Please provide email, OTP, and new password' });
    }

    if (newPassword.length < 8) {
      return errorResponse(res, { statusCode: 400, message: 'Password must be at least 8 characters long' });
    }

    const user = await User.findOne({ email: rawEmail });
    if (!user) {
      return errorResponse(res, { statusCode: 404, message: 'User not found' });
    }

    if (user.otp !== otp) {
      return errorResponse(res, { statusCode: 401, message: 'Invalid OTP' });
    }

    if (user.otpExpires < Date.now()) {
      return errorResponse(res, { statusCode: 401, message: 'OTP has expired. Please request a new one.' });
    }

    // Update password (pre-save hook will hash it)
    user.password = newPassword;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    return successResponse(res, {
      message: 'Password reset successfully. You can now login with your new password.',
      data: { email: user.email },
    });
  } catch (error) {
    return next(error);
  }
};
