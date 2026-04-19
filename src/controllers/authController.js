const User = require('../models/User');
const { generateToken } = require('../utils/generateToken');
const { successResponse, errorResponse } = require('../utils/response');
const { sendEmail, sendOtpEmail, sendTestEmail } = require('../utils/sendEmail');
const crypto = require('crypto');

// Rate limiting store (use Redis in production)
const loginAttempts = new Map();
const otpRequests = new Map();

// Memory management - prevent unlimited growth
setInterval(() => {
  if (loginAttempts.size > 1000) {
    console.log(`Cleaning up loginAttempts map (${loginAttempts.size} entries)`);
    loginAttempts.clear();
  }
  if (otpRequests.size > 1000) {
    console.log(`Cleaning up otpRequests map (${otpRequests.size} entries)`);
    otpRequests.clear();
  }
}, 30 * 60 * 1000); // Clean every 30 minutes

// Helper function to clear rate limiting entries
const clearRateLimit = (key) => {
  setTimeout(() => {
    loginAttempts.delete(key);
    otpRequests.delete(key);
  }, 15 * 60 * 1000); // Clear after 15 minutes
};

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

    // Enhanced password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(rawPassword)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      });
    }

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
      lastLoginIP: req.ip,
    });

    // Generate token
    const token = generateToken(user._id, user.role);

    // Log registration
    console.log(`New user registered: ${user.email} from IP ${req.ip}`);

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

    // Rate limiting check
    const ipKey = `login_${req.ip}`;
    const emailKey = `login_${rawEmail}`;
    
    if (loginAttempts.get(ipKey) >= 5 || loginAttempts.get(emailKey) >= 5) {
      return errorResponse(res, {
        statusCode: 429,
        message: 'Too many login attempts. Please try again after 15 minutes.',
      });
    }

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
      // Increment failed attempts
      loginAttempts.set(ipKey, (loginAttempts.get(ipKey) || 0) + 1);
      loginAttempts.set(emailKey, (loginAttempts.get(emailKey) || 0) + 1);
      clearRateLimit(ipKey);
      clearRateLimit(emailKey);
      
      return errorResponse(res, {
        statusCode: 401,
        message: 'Invalid email or password',
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(rawPassword);
    if (!isPasswordMatch) {
      // Increment failed attempts
      loginAttempts.set(ipKey, (loginAttempts.get(ipKey) || 0) + 1);
      loginAttempts.set(emailKey, (loginAttempts.get(emailKey) || 0) + 1);
      clearRateLimit(ipKey);
      clearRateLimit(emailKey);
      
      return errorResponse(res, {
        statusCode: 401,
        message: 'Invalid email or password',
      });
    }

    // Clear rate limiting on successful login
    loginAttempts.delete(ipKey);
    loginAttempts.delete(emailKey);

    // Check if user is active
    if (user.status === 'suspended') {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Your account has been suspended. Please contact support.',
      });
    }

    if (user.status === 'inactive') {
      return errorResponse(res, {
        statusCode: 403,
        message: 'Your account is inactive. Please verify your email or contact support.',
      });
    }

    // Check OTP request rate
    const otpKey = `otp_${user.email}`;
    const lastOtpRequest = otpRequests.get(otpKey);
    if (lastOtpRequest && Date.now() - lastOtpRequest < 60000) {
      return errorResponse(res, {
        statusCode: 429,
        message: 'Please wait 60 seconds before requesting another OTP',
      });
    }

    // Generate secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
    
    // Hash OTP before storing (security enhancement)
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    user.otp = hashedOtp;
    user.otpExpires = otpExpires;
    await user.save();

    // Update OTP request time
    otpRequests.set(otpKey, Date.now());
    clearRateLimit(otpKey);

    // Send attractive email with OTP
    const subject = '🔐 Secure Login Verification - PG Finder';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login Verification OTP</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div style="max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">🔐</div>
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Login Verification Required</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Secure access to your account</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">Hello <strong style="color: #667eea;">${user.name}</strong>,</p>
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">We received a login request for your PG Finder account. Use the verification code below to complete your login.</p>
            </div>
            
            <!-- OTP Box -->
            <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 30px; border-radius: 15px; text-align: center; margin: 20px 0;">
              <p style="color: #4a5568; font-size: 14px; margin-bottom: 15px; letter-spacing: 1px;">YOUR VERIFICATION CODE</p>
              <div style="background: white; padding: 20px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <span style="font-size: 48px; font-weight: bold; letter-spacing: 8px; color: #667eea; font-family: monospace;">${otp}</span>
              </div>
              <p style="color: #718096; font-size: 12px; margin-top: 15px;">Code expires in <strong style="color: #e53e3e;">5 minutes</strong></p>
            </div>
            
            <!-- Security Information -->
            <div style="background: #fef5e7; border-left: 4px solid #ed8936; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #975a16; font-size: 14px; display: flex; align-items: center;">
                <span style="font-size: 20px; margin-right: 10px;">⚠️</span>
                <strong>Security Tip:</strong> Never share this code with anyone. Our support team will never ask for this code.
              </p>
            </div>
            
            <div style="background: #f0f9ff; border-radius: 8px; padding: 15px; margin-top: 20px;">
              <p style="margin: 0; color: #2c5282; font-size: 13px; display: flex; align-items: center;">
                <span style="font-size: 18px; margin-right: 10px;">📍</span>
                Login details: <strong>IP Address:</strong> ${req.ip} | <strong>Time:</strong> ${new Date().toLocaleString()}
              </p>
              <p style="margin: 10px 0 0; color: #2c5282; font-size: 12px;">If this wasn't you, please <a href="#" style="color: #667eea;">reset your password immediately</a>.</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #718096; font-size: 12px; margin: 0;">This is an automated message from PG Finder. Please do not reply to this email.</p>
            <p style="color: #a0aec0; font-size: 11px; margin: 10px 0 0;">&copy; 2024 PG Finder. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Your PG Finder login verification OTP is: ${otp}\n\nThis code will expire in 5 minutes.\n\nSecurity Tip: Never share this code with anyone.\n\nLogin Details:\nIP Address: ${req.ip}\nTime: ${new Date().toLocaleString()}\n\nIf this wasn't you, please reset your password immediately.`;

    // Send email with proper check
    const isSent = await sendEmail({
      email: user.email,
      subject,
      html,
      text,
    });

    if (!isSent) {
      console.error(`❌ Failed to send OTP email to: ${user.email}`);
      
      // In development, return OTP for testing
      if (process.env.NODE_ENV === 'development') {
        return errorResponse(res, {
          statusCode: 500,
          message: `Failed to send email. Testing OTP: ${otp}`,
        });
      }
      
      return errorResponse(res, {
        statusCode: 500,
        message: "Failed to send verification email. Please try again or contact support.",
      });
    }

    const responseData = { requireOtp: true, email: user.email };
    
    // Only show debug OTP in development environment
    if (process.env.NODE_ENV === 'development') {
      responseData.debugOtp = otp;
    }

    return successResponse(res, {
      message: 'Verification code sent to your email. Please verify to login.',
      statusCode: 200,
      data: responseData,
    });
  } catch (error) {
    console.error('Login error:', error);
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
        lastLoginIP: user.lastLoginIP,
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

    // Update fields with validation
    if (req.body.name) user.name = req.body.name.trim();
    
    if (req.body.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(req.body.email)) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'Please provide a valid email address',
        });
      }
      
      const newEmail = req.body.email.toLowerCase().trim();
      
      // Check if email is already in use by another user
      const existingUser = await User.findOne({ email: newEmail });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return errorResponse(res, {
          statusCode: 400,
          message: "Email already in use by another account",
        });
      }
      
      user.email = newEmail;
    }
    
    if (req.body.phone) user.phone = req.body.phone.trim();

    // If password is provided, validate and update
    if (req.body.password) {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(req.body.password)) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character',
        });
      }
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

    // Validate admin credentials exist in environment
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      return errorResponse(res, {
        statusCode: 500,
        message: 'Admin credentials not configured in environment variables',
      });
    }

    // Create admin user
    const admin = await User.create({
      name: 'Admin User',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin',
      status: 'active',
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

// @desc    Reset admin password
// @route   POST /api/auth/reset-admin
// @access  Public (one-time setup helper)
exports.resetAdmin = async (req, res, next) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      return errorResponse(res, {
        statusCode: 500,
        message: 'Admin credentials not configured',
      });
    }

    const admin = await User.findOne({ email: adminEmail, role: 'admin' });
    if (!admin) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'Admin user not found',
      });
    }

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

    // Hash the provided OTP for comparison
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    if (user.otp !== hashedOtp) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'Invalid verification code',
      });
    }

    if (user.otpExpires < Date.now()) {
      return errorResponse(res, {
        statusCode: 401,
        message: 'Verification code has expired. Please request a new one.',
      });
    }

    // OTP is valid - clear it and update login info
    user.otp = null;
    user.otpExpires = null;
    user.lastLogin = new Date();
    user.lastLoginIP = req.ip;
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

    // Rate limiting for password reset requests
    const resetKey = `reset_${rawEmail}`;
    const lastResetRequest = otpRequests.get(resetKey);
    if (lastResetRequest && Date.now() - lastResetRequest < 120000) {
      return errorResponse(res, {
        statusCode: 429,
        message: 'Please wait 2 minutes before requesting another password reset',
      });
    }

    const user = await User.findOne({ email: rawEmail });
    if (!user) {
      // Don't reveal if email exists or not for security
      return successResponse(res, {
        message: 'If an account exists with this email, you will receive a password reset OTP.',
        data: { email: rawEmail },
      });
    }

    // Check if account is active
    if (user.status === 'suspended') {
      return errorResponse(res, {
        statusCode: 403,
        message: 'This account has been suspended. Please contact support.',
      });
    }

    // Generate secure OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    user.otp = hashedOtp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Update rate limiting
    otpRequests.set(resetKey, Date.now());
    clearRateLimit(resetKey);

    // Attractive password reset email
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset OTP</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
        <div style="max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">🔑</div>
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Reset Your Password</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Secure password recovery</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">Hello <strong style="color: #f5576c;">${user.name}</strong>,</p>
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">We received a request to reset your password. Use the verification code below to proceed.</p>
            </div>
            
            <!-- OTP Box -->
            <div style="background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%); padding: 30px; border-radius: 15px; text-align: center; margin: 20px 0;">
              <p style="color: #c53030; font-size: 14px; margin-bottom: 15px; letter-spacing: 1px;">PASSWORD RESET CODE</p>
              <div style="background: white; padding: 20px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <span style="font-size: 48px; font-weight: bold; letter-spacing: 8px; color: #f5576c; font-family: monospace;">${otp}</span>
              </div>
              <p style="color: #718096; font-size: 12px; margin-top: 15px;">Code expires in <strong style="color: #e53e3e;">10 minutes</strong></p>
            </div>
            
            <!-- Security Information -->
            <div style="background: #fff5f0; border-left: 4px solid #ed8936; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #975a16; font-size: 14px; display: flex; align-items: center;">
                <span style="font-size: 20px; margin-right: 10px;">⚠️</span>
                <strong>Important:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
              </p>
            </div>
            
            <div style="background: #fef5e7; border-radius: 8px; padding: 15px; margin-top: 20px;">
              <p style="margin: 0; color: #975a16; font-size: 13px; display: flex; align-items: center;">
                <span style="font-size: 18px; margin-right: 10px;">🕒</span>
                This request was made from IP: ${req.ip} at ${new Date().toLocaleString()}
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #718096; font-size: 12px; margin: 0;">This is an automated message from PG Finder. Please do not reply to this email.</p>
            <p style="color: #a0aec0; font-size: 11px; margin: 10px 0 0;">&copy; 2024 PG Finder. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Your PG Finder password reset OTP is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this password reset, please ignore this email.\n\nRequest Details:\nIP Address: ${req.ip}\nTime: ${new Date().toLocaleString()}`;

    // Send email with proper check
    const isSent = await sendEmail({
      email: user.email,
      subject: '🔑 Password Reset OTP - PG Finder',
      html,
      text,
    });

    if (!isSent) {
      console.error(`❌ Failed to send password reset email to: ${user.email}`);
      return errorResponse(res, {
        statusCode: 500,
        message: "Failed to send password reset email. Please try again.",
      });
    }

    return successResponse(res, {
      message: 'If an account exists with this email, you will receive a password reset OTP.',
      data: { email: rawEmail },
    });
  } catch (error) {
    console.error('Forgot password error:', error);
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

    // Enhanced password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      });
    }

    const user = await User.findOne({ email: rawEmail });
    if (!user) {
      return errorResponse(res, { statusCode: 404, message: 'User not found' });
    }

    // Hash OTP for comparison
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    if (user.otp !== hashedOtp) {
      return errorResponse(res, { statusCode: 401, message: 'Invalid verification code' });
    }

    if (user.otpExpires < Date.now()) {
      return errorResponse(res, { statusCode: 401, message: 'Verification code has expired. Please request a new one.' });
    }

    // Check if new password is different from old one
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'New password must be different from your current password',
      });
    }

    // Update password
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

// @desc    Logout user (optional)
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    // In a token-based system, logout is handled client-side by removing the token
    // This endpoint can be used for any additional cleanup
    return successResponse(res, {
      message: 'Logged out successfully',
    });
  } catch (error) {
    return next(error);
  }
};