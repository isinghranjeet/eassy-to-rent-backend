const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const authController = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ================= PUBLIC AUTH ROUTES =================
router.post('/register', authController.register);
router.route('/login')
  .post(authController.login)
  .head((req, res) => {
    res.status(200).end();
  });
router.post('/verify-login-otp', authController.verifyLoginOtp);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/init-admin', authController.createDefaultAdmin);
router.post('/reset-admin', authController.resetAdmin);
router.get('/debug', authController.debugAuth);

// ================= PROTECTED ROUTES =================
router.get('/profile', protect, authController.getProfile);
router.put('/profile', protect, authController.updateProfile);

// ================= ADMIN ROUTES =================
router.get('/users', protect, adminOnly, authController.getUsers);
router.get('/users/:id', protect, adminOnly, authController.getUserById);
router.delete('/users/:id', protect, adminOnly, authController.deleteUser);
router.put('/users/:id/status', protect, adminOnly, authController.updateUserStatus);

console.log('🔥🔥🔥 AUTH ROUTES FILE IS BEING LOADED! 🔥🔥🔥');
console.log('Routes registered in this file:');
console.log('  - POST /register');
console.log('  - POST /login');
console.log('  - POST /init-admin');
console.log('  - GET /profile');
console.log('  - PUT /profile');
console.log('  - GET /users');
console.log('  - GET /debug');
console.log('⚠️  LEGACY ROUTE DISABLED - Use src/routes/authRoutes.js instead');

module.exports = router; // Keep for compatibility but don't mount
