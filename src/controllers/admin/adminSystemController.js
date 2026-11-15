const os = require('os');
const AuditLog = require('../../models/AuditLog');
const AdminNotification = require('../../models/AdminNotification');
const ErrorLog = require('../../models/ErrorLog');
const Activity = require('../../models/Activity');
const { successResponse, errorResponse } = require('../../utils/response');
const { asyncHandler } = require('../../middleware/asyncHandler');

const getAdminActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const activities = await Activity.find().sort({ createdAt: -1 }).limit(limit).lean();
  return successResponse(res, { message: 'Activity fetched successfully', data: activities });
});

const getAdminNotifications = asyncHandler(async (req, res) => {
  const notifications = await AdminNotification.find().sort({ createdAt: -1 }).limit(20).lean();
  return successResponse(res, { message: 'Notifications fetched', data: notifications });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await AdminNotification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
  if (!notification) return errorResponse(res, { statusCode: 404, message: 'Notification not found' });
  return successResponse(res, { message: 'Marked as read', data: notification });
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await AdminNotification.updateMany({ read: false }, { read: true });
  return successResponse(res, { message: 'All marked as read', data: { updated: true } });
});

const getAuditLogs = asyncHandler(async (req, res) => {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(50).lean();
  return successResponse(res, { message: 'Audit logs fetched', data: logs });
});

const getSystemHealth = asyncHandler(async (req, res) => {
  const uptimePercentage = Number(Math.min(100, (process.uptime() / 86400) * 100).toFixed(1));
  return successResponse(res, {
    message: 'System health fetched',
    data: {
      overall: 'healthy',
      uptime: uptimePercentage,
      serverLoad: { cpu: Number((os.loadavg()[0] || 0).toFixed(1)), memory: Number(((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100).toFixed(1)) }
    }
  });
});

const getSystemErrors = asyncHandler(async (req, res) => {
  const errors = await ErrorLog.find().sort({ createdAt: -1 }).limit(20).lean();
  return successResponse(res, { message: 'Errors fetched', data: errors });
});

module.exports = { getAdminActivity, getAdminNotifications, markNotificationRead, markAllNotificationsRead, getAuditLogs, getSystemHealth, getSystemErrors };