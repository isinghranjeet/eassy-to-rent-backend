const express = require('express');
const router = express.Router();
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
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/google', authController.googleLogin);
router.post('/google-token', authController.googleTokenLogin);

if (process.env.NODE_ENV !== 'production') {
  router.post('/init-admin', authController.createDefaultAdmin);
  router.post('/reset-admin', authController.resetAdmin);
}

// ================= PROTECTED ROUTES =================
router.get('/profile', protect, authController.getProfile);
router.put('/profile', protect, authController.updateProfile);
router.post('/logout', protect, authController.logout);
router.post('/logout-all', protect, authController.logoutAll);

// ================= ADMIN ROUTES =================
router.get('/users', protect, adminOnly, authController.getUsers);
router.get('/users/:id', protect, adminOnly, authController.getUserById);
router.delete('/users/:id', protect, adminOnly, authController.deleteUser);
router.put('/users/:id/status', protect, adminOnly, authController.updateUserStatus);

module.exports = router;
