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

// ✅ Import Cache Invalidation Helper
const { invalidateCache } = require('../middleware/cache');

// All profile routes require authentication
router.use(protect);

// GET /api/profile - Get full profile (🔒 NOT CACHED for privacy & security)
router.get('/', getProfile);

// PUT /api/profile - Update profile fields -> Invalidate cache
router.put('/', async (req, res, next) => {
  await updateProfile(req, res, next);
  if (res.statusCode === 200) {
    await invalidateCache('etr_cache:*');
  }
});

// PUT /api/profile/photo - Update profile photo -> Invalidate cache
router.put('/photo', async (req, res, next) => {
  await updateProfilePhoto(req, res, next);
  if (res.statusCode === 200) {
    await invalidateCache('etr_cache:*');
  }
});

// PUT /api/profile/password - Change password (Secure - no cache needed)
router.put('/password', changePassword);

// PUT /api/profile/settings - Update settings -> Invalidate cache
router.put('/settings', async (req, res, next) => {
  await updateSettings(req, res, next);
  if (res.statusCode === 200) {
    await invalidateCache('etr_cache:*');
  }
});

// DELETE /api/profile - Delete account -> Invalidate cache
router.delete('/', async (req, res, next) => {
  await deleteAccount(req, res, next);
  if (res.statusCode === 200) {
    await invalidateCache('etr_cache:*');
  }
});

module.exports = router;