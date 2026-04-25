const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  getAdminActivity,
  getAdminNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getAdminPGs,
  updatePGStatus,
  getAdminDashboardStats,
  getAdminAnalytics,
  getAdminUsers,
  getAuditLogs,
  getSystemHealth,
  getSystemErrors,
  getAdminProfile,
  updateAdminProfile,
  updateAdminPassword,
  getAdminOwnActivity,
  getUserActivity,
  getUserStats,
  sendAdminOfferEmail
} = require('../controllers/adminController');

// Apply auth middleware to all admin routes
router.use(protect, adminOnly);

// ============================
// ACTIVITY
// ============================
router.get('/activity', getAdminActivity);

// ============================
// NOTIFICATIONS
// ============================
router.get('/notifications', getAdminNotifications);
router.put('/notifications/:id/read', markNotificationRead);
router.put('/notifications/:id/acknowledge', markNotificationRead);
router.put('/notifications/read-all', markAllNotificationsRead);

// ============================
// USER MANAGEMENT
// ============================
router.get('/users', getAdminUsers);
router.get('/users/:id/activity', getUserActivity);
router.get('/users/:id/stats', getUserStats);

// ============================
// PG MANAGEMENT
// ============================
router.get('/pgs', getAdminPGs);
router.patch('/pgs/:id/status', updatePGStatus);

// ============================
// STATS & ANALYTICS
// ============================
router.get('/stats/dashboard', getAdminDashboardStats);
router.get('/stats/analytics', getAdminAnalytics);
router.get('/audit-logs', getAuditLogs);
router.get('/system/health', getSystemHealth);
router.get('/system/errors', getSystemErrors);

// ============================
// ADMIN OFFER EMAIL
// ============================
router.post('/send-offer-email', sendAdminOfferEmail);

// ============================
// ADMIN PROFILE MANAGEMENT
// ============================
router.get('/profile', getAdminProfile);
router.put('/profile', updateAdminProfile);
router.put('/profile/password', updateAdminPassword);
router.get('/profile/activity', getAdminOwnActivity);

module.exports = router;

