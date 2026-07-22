const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getProfile,
  updateProfile,
  updateProfilePhoto,
  changePassword,
  updateSettings,
  deleteAccount,
} = require('../controllers/profileController');

// All profile routes require authentication
router.use(protect);

// GET /api/profile - Get full profile
router.get('/', getProfile);

// PUT /api/profile - Update profile fields
router.put('/', updateProfile);

// PUT /api/profile/photo - Update profile photo
router.put('/photo', updateProfilePhoto);

// PUT /api/profile/password - Change password
router.put('/password', changePassword);

// PUT /api/profile/settings - Update settings
router.put('/settings', updateSettings);

// DELETE /api/profile - Delete account
router.delete('/', deleteAccount);

module.exports = router;

