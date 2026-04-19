const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ================= PUBLIC AUTH ROUTES =================

// Register user
router.post('/register', authController.register);

// Login user (send OTP)
router.post('/login', authController.login);

// Verify login OTP
router.post('/verify-login-otp', authController.verifyLoginOtp);

// Forgot password (send OTP)
router.post('/forgot-password', authController.forgotPassword);

// Reset password using OTP
router.post('/reset-password', authController.resetPassword);

// Debug route
router.get('/debug', authController.debugAuth);

// ================= GOOGLE LOGIN ROUTES =================

// Google token exchange (Frontend -> Backend)
router.post('/google-token', authController.googleTokenLogin);

// ================= PROTECTED ROUTES =================

// Get profile
router.get('/profile', protect, authController.getProfile);

// Update profile
router.put('/profile', protect, authController.updateProfile);

// ================= ADMIN ROUTES =================

// Get all users
router.get('/users', protect, adminOnly, authController.getUsers);

// Get single user
router.get('/users/:id', protect, adminOnly, authController.getUserById);

// Delete user
router.delete('/users/:id', protect, adminOnly, authController.deleteUser);

// Update user status
router.put('/users/:id/status', protect, adminOnly, authController.updateUserStatus);

// ================= DEV ONLY ROUTES =================

// Create default admin (only for development)
if (process.env.NODE_ENV === 'development') {
  router.post('/init-admin', authController.createDefaultAdmin);
  router.post('/reset-admin', authController.resetAdmin);
}

module.exports = router;