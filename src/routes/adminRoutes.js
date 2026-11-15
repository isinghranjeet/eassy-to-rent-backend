const express = require('express');
const router = express.Router();

const { getAdminBookings } = require('../controllers/admin/adminBookingController');
const { getAdminPGs, updatePGStatus } = require('../controllers/admin/adminPgController');
const { 
  getAdminUsers, 
  getAdminKycSubmissions, 
  reviewUserKyc, 
  getUserActivity, 
  getUserStats, 
  getUserBookings 
} = require('../controllers/admin/adminUserController');
const { getAdminDashboardStats, getAdminAnalytics } = require('../controllers/admin/adminStatsController');
const { 
  getAdminActivity, 
  getAdminNotifications, 
  markNotificationRead, 
  markAllNotificationsRead, 
  getAuditLogs, 
  getSystemHealth, 
  getSystemErrors 
} = require('../controllers/admin/adminSystemController');
const { 
  getAdminProfile, 
  updateAdminProfile, 
  updateAdminPassword, 
  getAdminOwnActivity, 
  sendAdminOfferEmail 
} = require('../controllers/admin/adminProfileController');

// ✅ Import Advanced Cache Middleware and Invalidation Helper
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');

// ⚡ Cached GET Endpoints (Read-heavy admin operations)
router.get('/bookings', cacheMiddleware(120), getAdminBookings);
router.get('/pgs', cacheMiddleware(120), getAdminPGs);

router.patch('/pgs/:id/status', async (req, res, next) => {
  await updatePGStatus(req, res, next);
  if (res.statusCode === 200) {
    await invalidateCache('etr_cache:*');
  }
});

router.get('/users', cacheMiddleware(120), getAdminUsers);
router.get('/users/kyc', cacheMiddleware(60), getAdminKycSubmissions);

router.patch('/users/:id/kyc', async (req, res, next) => {
  await reviewUserKyc(req, res, next);
  if (res.statusCode === 200) {
    await invalidateCache('etr_cache:*');
  }
});

router.get('/users/:id/activity', cacheMiddleware(120), getUserActivity);
router.get('/users/:id/stats', cacheMiddleware(120), getUserStats);
router.get('/users/:id/bookings', cacheMiddleware(120), getUserBookings);

router.get('/stats/dashboard', cacheMiddleware(60), getAdminDashboardStats);
router.get('/stats/analytics', cacheMiddleware(300), getAdminAnalytics);

router.get('/activity', cacheMiddleware(60), getAdminActivity);
router.get('/notifications', cacheMiddleware(30), getAdminNotifications);

router.put('/notifications/:id/read', async (req, res, next) => {
  await markNotificationRead(req, res, next);
  await invalidateCache('etr_cache:*');
});

router.put('/notifications/read-all', async (req, res, next) => {
  await markAllNotificationsRead(req, res, next);
  await invalidateCache('etr_cache:*');
});

router.get('/audit-logs', cacheMiddleware(60), getAuditLogs);
router.get('/health', cacheMiddleware(30), getSystemHealth);
router.get('/errors', cacheMiddleware(30), getSystemErrors);

router.get('/profile', cacheMiddleware(300), getAdminProfile);

router.put('/profile', async (req, res, next) => {
  await updateAdminProfile(req, res, next);
  if (res.statusCode === 200) await invalidateCache('etr_cache:*');
});

router.put('/profile/password', updateAdminPassword);
router.get('/profile/activity', cacheMiddleware(120), getAdminOwnActivity);
router.post('/send-offer-email', sendAdminOfferEmail);

module.exports = router;