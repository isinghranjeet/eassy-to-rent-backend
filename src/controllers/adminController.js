const os = require('os');
const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const AdminNotification = require('../models/AdminNotification');
const User = require('../models/User');
const PGListing = require('../models/PGListing');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const PaymentLog = require('../models/PaymentLog');
const ErrorLog = require('../models/ErrorLog');
const Activity = require('../models/Activity');
const { successResponse, errorResponse } = require('../utils/response');
const { asyncHandler } = require('../middleware/asyncHandler');
const { sendOfferEmail } = require('../services/notificationService');

// ============================
// ACTIVITY SYSTEM
// ============================

/**
 * @desc    Get recent admin activity feed
 * @route   GET /api/admin/activity
 * @access  Private/Admin
 */
const getAdminActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  const activities = await Activity.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const mapped = activities.map((item) => ({
    id: item._id.toString(),
    type: mapActivityType(item.type),
    message: item.message,
    userId: item.userId?.toString(),
    userName: item.userName,
    targetId: item.targetId,
    targetName: item.targetName,
    metadata: item.metadata || {},
    timestamp: item.createdAt.toISOString(),
    read: false,
  }));

  return successResponse(res, {
    message: 'Recent activity fetched successfully',
    data: mapped,
  });
});

// Map internal activity types to frontend ActivityEventType values
function mapActivityType(type) {
  const typeMap = {
    USER_REGISTERED: 'user_signup',
    PG_CREATED: 'pg_created',
    BOOKING_CREATED: 'booking_created',
    PAYMENT_SUCCESS: 'payment_success',
    REVIEW_PENDING: 'review_submitted',
  };
  return typeMap[type] || type;
}

// Helper to format audit log messages
function formatAuditMessage(log) {
  const actionMessages = {
    login: `${log.userName || 'User'} logged in`,
    logout: `${log.userName || 'User'} logged out`,
    user_create: `${log.userName || 'User'} created a new account`,
    user_update: `${log.userName || 'User'} updated profile`,
    user_delete: `${log.userName || 'User'} deleted an account`,
    user_suspend: `${log.userName || 'Admin'} suspended a user`,
    user_activate: `${log.userName || 'Admin'} activated a user`,
    pg_create: `${log.userName || 'Owner'} created a new PG listing`,
    pg_update: `${log.userName || 'Owner'} updated a PG listing`,
    pg_delete: `${log.userName || 'Admin'} deleted a PG listing`,
    pg_verify: `${log.userName || 'Admin'} verified a PG listing`,
    booking_create: `${log.userName || 'User'} created a booking`,
    booking_cancel: `${log.userName || 'User'} cancelled a booking`,
    offer_sent: `Offer email sent`,
    reminder_sent: `Reminder sent to users`,
    export_data: `${log.userName || 'Admin'} exported data`,
    settings_change: `${log.userName || 'Admin'} changed system settings`
  };
  return actionMessages[log.action] || `${log.action} performed`;
}

// ============================
// NOTIFICATIONS SYSTEM
// ============================

/**
 * @desc    Get admin notifications (stored + dynamic alerts)
 * @route   GET /api/admin/notifications
 * @access  Private/Admin
 */
const getAdminNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  // Fetch stored notifications
  const storedNotifications = await AdminNotification.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Generate dynamic alerts based on current system state
  const dynamicAlerts = await generateDynamicAlerts();

  // Combine and sort
  const allItems = [
    ...dynamicAlerts.map((a) => ({ ...a, isDynamic: true })),
    ...storedNotifications.map((n) => ({ ...n, isDynamic: false }))
  ];

  allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const notifications = allItems.slice(0, limit).map((item) => ({
    ...item,
    id: item._id || item.id,
    acknowledged: !!item.read,
    severity: item.severity || item.type || 'info',
    category: item.category || 'system_error'
  }));

  return successResponse(res, {
    message: 'Notifications fetched successfully',
    data: notifications
  });
});

/**
 * Generate real-time dynamic alerts based on DB state
 */
async function generateDynamicAlerts() {
  const alerts = [];
  const now = new Date();

  // Pending reviews
  const pendingReviewsCount = await Review.countDocuments({ status: 'pending' });
  if (pendingReviewsCount > 0) {
    alerts.push({
      _id: 'dynamic_pending_reviews',
      title: 'Reviews Pending Approval',
      message: `${pendingReviewsCount} review${pendingReviewsCount > 1 ? 's are' : ' is'} waiting for approval.`,
      type: 'warning',
      read: false,
      link: '/admin/reviews',
      icon: 'MessageSquare',
      createdAt: now,
      metadata: { count: pendingReviewsCount }
    });
  }

  // Unverified PGs
  const unverifiedPGsCount = await PGListing.countDocuments({ verified: false });
  if (unverifiedPGsCount > 0) {
    alerts.push({
      _id: 'dynamic_unverified_pgs',
      title: 'Unverified PG Listings',
      message: `${unverifiedPGsCount} PG listing${unverifiedPGsCount > 1 ? 's' : ''} pending verification.`,
      type: 'warning',
      read: false,
      link: '/admin/pgs',
      icon: 'Building',
      createdAt: now,
      metadata: { count: unverifiedPGsCount }
    });
  }

  // Today's bookings
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayBookings = await Booking.countDocuments({ createdAt: { $gte: todayStart } });
  if (todayBookings > 0) {
    alerts.push({
      _id: 'dynamic_today_bookings',
      title: 'New Bookings Today',
      message: `${todayBookings} new booking${todayBookings > 1 ? 's' : ''} received today.`,
      type: 'info',
      read: false,
      link: '/admin/bookings',
      icon: 'Calendar',
      createdAt: now,
      metadata: { count: todayBookings }
    });
  }

  // Suspended users
  const suspendedUsers = await User.countDocuments({ status: 'suspended' });
  if (suspendedUsers > 0) {
    alerts.push({
      _id: 'dynamic_suspended_users',
      title: 'Suspended Users',
      message: `${suspendedUsers} user account${suspendedUsers > 1 ? 's are' : ' is'} currently suspended.`,
      type: 'alert',
      read: false,
      link: '/admin/users',
      icon: 'ShieldAlert',
      createdAt: now,
      metadata: { count: suspendedUsers }
    });
  }

  // Failed payments today
  const failedPayments = await PaymentLog.countDocuments({
    status: 'failed',
    createdAt: { $gte: todayStart }
  });
  if (failedPayments > 0) {
    alerts.push({
      _id: 'dynamic_failed_payments',
      title: 'Failed Payments Today',
      message: `${failedPayments} payment${failedPayments > 1 ? 's' : ''} failed today.`,
      type: 'error',
      read: false,
      link: '/admin/payments',
      icon: 'CreditCard',
      createdAt: now,
      metadata: { count: failedPayments }
    });
  }

  return alerts;
}

/**
 * @desc    Mark notification as read
 * @route   PUT /api/admin/notifications/:id/read
 * @access  Private/Admin
 */
const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id.startsWith('dynamic_')) {
    return successResponse(res, {
      message: 'Dynamic alert dismissed',
      data: { dismissed: true }
    });
  }

  const notification = await AdminNotification.findByIdAndUpdate(
    id,
    { read: true },
    { new: true }
  );

  if (!notification) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'Notification not found'
    });
  }

  return successResponse(res, {
    message: 'Notification marked as read',
    data: notification
  });
});

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/admin/notifications/read-all
 * @access  Private/Admin
 */
const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await AdminNotification.updateMany({ read: false }, { read: true });

  return successResponse(res, {
    message: 'All notifications marked as read',
    data: { updated: true }
  });
});

// ============================
// AUDIT LOGS + SYSTEM HEALTH
// ============================

const getAuditLogs = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const sortBy = ['createdAt', 'action', 'status'].includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
  const skip = (page - 1) * limit;

  const query = {};
  if (req.query.action && req.query.action !== 'all') {
    query.action = req.query.action;
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(query)
  ]);

  return successResponse(res, {
    message: 'Audit logs fetched successfully',
    data: {
      items: logs,
      total,
      page,
      pages: Math.ceil(total / limit)
    }
  });
});

const getSystemHealth = asyncHandler(async (req, res) => {
  const now = new Date();
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [recentErrorCount, dailyErrorCount] = await Promise.all([
    ErrorLog.countDocuments({ createdAt: { $gte: lastHour } }),
    ErrorLog.countDocuments({ createdAt: { $gte: todayStart } })
  ]);

  const uptimePercentage = Number(Math.min(100, (process.uptime() / 86400) * 100).toFixed(1));
  const responseTimeSamples = [32, 110, 140, 58, 92, 170];
  const apiSections = [
    { label: '/api/health', status: 'healthy', responseTime: responseTimeSamples[0] },
    { label: '/api/auth/login', status: 'healthy', responseTime: responseTimeSamples[1] },
    { label: '/api/admin/activity', status: 'healthy', responseTime: responseTimeSamples[2] },
    { label: '/api/admin/notifications', status: 'healthy', responseTime: responseTimeSamples[3] },
    { label: '/api/admin/pgs', status: 'healthy', responseTime: responseTimeSamples[4] }
  ];

  return successResponse(res, {
    message: 'System health fetched successfully',
    data: {
      overall: recentErrorCount > 5 ? 'degraded' : 'healthy',
      uptime: uptimePercentage,
      errorRate: Number(((recentErrorCount / 20) * 100).toFixed(1)),
      apiHealth: apiSections,
      slowEndpoints: apiSections.filter((item) => item.responseTime > 120),
      serverLoad: {
        cpu: Number((os.loadavg()[0] || 0).toFixed(1)),
        memory: Number(((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100).toFixed(1)),
        disk: 0
      },
      cacheHitRatio: 0
    }
  });
});

const getSystemErrors = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const sortBy = ['createdAt', 'level', 'source'].includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
  const skip = (page - 1) * limit;

  const logs = await ErrorLog.find()
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean();

  return successResponse(res, {
    message: 'System error logs fetched successfully',
    data: logs
  });
});

// ============================
// PG MANAGEMENT ADMIN
// ============================

/**
 * @desc    Get paginated PG listings with admin filters
 * @route   GET /api/admin/pgs
 * @access  Private/Admin
 */
const getAdminPGs = asyncHandler(async (req, res) => {
  const {
    status,
    city,
    type,
    search,
    verified,
    featured,
    published,
    minPrice,
    maxPrice,
    sort = '-createdAt',
    page = 1,
    limit = 20
  } = req.query;

  const pageNum = Math.max(parseInt(page), 1);
  const limitNum = Math.min(Math.max(parseInt(limit), 1), 100);
  const skip = (pageNum - 1) * limitNum;

  let query = {};

  // Status filter maps to boolean fields
  if (status) {
    switch (status.toLowerCase()) {
      case 'published':
        query.published = true;
        break;
      case 'unpublished':
        query.published = false;
        break;
      case 'verified':
        query.verified = true;
        break;
      case 'unverified':
        query.verified = false;
        break;
      case 'featured':
        query.featured = true;
        break;
      case 'draft':
        query.published = false;
        break;
    }
  }

  if (verified !== undefined) query.verified = verified === 'true';
  if (featured !== undefined) query.featured = featured === 'true';
  if (published !== undefined) query.published = published === 'true';

  if (city && city !== 'all') {
    query.city = { $regex: city, $options: 'i' };
  }

  if (type && type !== 'all') {
    query.type = type.toLowerCase();
  }

  if (minPrice !== undefined) {
    query.price = { ...query.price, $gte: parseFloat(minPrice) };
  }

  if (maxPrice !== undefined) {
    query.price = { ...query.price, $lte: parseFloat(maxPrice) };
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { address: { $regex: search, $options: 'i' } },
      { city: { $regex: search, $options: 'i' } },
      { ownerName: { $regex: search, $options: 'i' } },
      { ownerEmail: { $regex: search, $options: 'i' } }
    ];
  }

  const [pgs, total] = await Promise.all([
    PGListing.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    PGListing.countDocuments(query)
  ]);

  // Enrich with computed fields
  const items = pgs.map((pg) => ({
    ...pg,
    hasVirtualTour: !!(pg.videoUrl || pg.virtualTour),
    statusLabel: pg.published ? (pg.verified ? 'Live' : 'Pending') : 'Draft'
  }));

  return successResponse(res, {
    message: 'PG listings fetched successfully',
    data: {
      count: items.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      items
    }
  });
});

/**
 * @desc    Update PG status (published/verified/featured toggle)
 * @route   PATCH /api/admin/pgs/:id/status
 * @access  Private/Admin
 */
const updatePGStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { field, value } = req.body;

  const validFields = ['published', 'featured', 'verified', 'adminRecommended'];
  if (!field || !validFields.includes(field)) {
    return errorResponse(res, {
      statusCode: 400,
      message: `Invalid field. Must be one of: ${validFields.join(', ')}`
    });
  }

  const pg = await PGListing.findByIdAndUpdate(
    id,
    { [field]: value, updatedAt: Date.now() },
    { new: true, runValidators: true }
  );

  if (!pg) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'PG listing not found'
    });
  }

  return successResponse(res, {
    message: `PG ${field} updated successfully`,
    data: pg
  });
});

// ============================
// ADMIN STATS / DASHBOARD
// ============================

/**
 * @desc    Get admin dashboard KPIs
 * @route   GET /api/admin/stats/dashboard
 * @access  Private/Admin
 */
const getAdminDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now);
  monthStart.setMonth(monthStart.getMonth() - 1);

  // Parallel aggregation for performance
  const [
    totalUsers,
    totalPGs,
    totalBookings,
    totalRevenueAgg,
    totalReviews,
    pendingReviews,
    pendingPGs,
    newUsersToday,
    newBookingsToday,
    newPGsThisWeek,
    revenueThisMonthAgg,
    bookingStatusAgg,
    userRoleAgg,
    pgTypeAgg,
    topCitiesAgg
  ] = await Promise.all([
    User.countDocuments(),
    PGListing.countDocuments(),
    Booking.countDocuments(),
    Booking.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Review.countDocuments(),
    Review.countDocuments({ status: 'pending' }),
    PGListing.countDocuments({ verified: false }),
    User.countDocuments({ createdAt: { $gte: todayStart } }),
    Booking.countDocuments({ createdAt: { $gte: todayStart } }),
    PGListing.countDocuments({ createdAt: { $gte: weekStart } }),
    Booking.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]),
    Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    PGListing.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
    PGListing.aggregate([
      { $match: { published: true } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ])
  ]);

  const totalRevenue = totalRevenueAgg[0]?.total || 0;
  const revenueThisMonth = revenueThisMonthAgg[0]?.total || 0;

  // Format aggregates into maps
  const bookingStatusMap = {};
  bookingStatusAgg.forEach((s) => { bookingStatusMap[s._id] = s.count; });

  const userRoleMap = {};
  userRoleAgg.forEach((r) => { userRoleMap[r._id] = r.count; });

  const pgTypeMap = {};
  pgTypeAgg.forEach((t) => { pgTypeMap[t._id] = t.count; });

  const activeListings = await PGListing.countDocuments({ published: true, verified: true });
  const featuredPGs = await PGListing.countDocuments({ featured: true });
  const newPGsToday = await PGListing.countDocuments({ createdAt: { $gte: todayStart } });
  const bookingsToday = await Booking.countDocuments({ createdAt: { $gte: todayStart } });
  const revenueTodayAgg = await Booking.aggregate([
    { $match: { paymentStatus: 'paid', createdAt: { $gte: todayStart } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  const revenueToday = revenueTodayAgg[0]?.total || 0;

  return successResponse(res, {
    message: 'Dashboard stats fetched successfully',
    data: {
      totalUsers,
      totalPGs,
      totalBookings,
      totalRevenue,
      totalReviews,
      pendingReviews,
      pendingPGs,
      activeListings,
      featuredPGs,
      newUsersToday,
      newPGsToday,
      bookingsToday,
      revenueToday,
      trends: {
        newPGsThisWeek,
        revenueThisMonth
      },
      breakdown: {
        bookingsByStatus: bookingStatusMap,
        usersByRole: userRoleMap,
        pgsByType: pgTypeMap,
        topCities: topCitiesAgg
      }
    }
  });
});

/**
 * @desc    Get admin analytics (extended stats)
 * @route   GET /api/admin/stats/analytics
 * @access  Private/Admin
 */
const getAdminAnalytics = asyncHandler(async (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [dailySignups, dailyBookings, dailyRevenue] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Booking.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);

  return successResponse(res, {
    message: 'Analytics fetched successfully',
    data: {
      dailySignups,
      dailyBookings,
      dailyRevenue
    }
  });
});

// ============================
// USER MANAGEMENT ADMIN
// ============================

/**
 * @desc    Get paginated users with admin filters
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
const getAdminUsers = asyncHandler(async (req, res) => {
  const {
    status,
    role,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 20
  } = req.query;

  const pageNum = Math.max(parseInt(page), 1);
  const limitNum = Math.min(Math.max(parseInt(limit), 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const sortDirection = sortOrder.toLowerCase() === 'asc' ? 1 : -1;
  const sortField = ['name', 'email', 'role', 'status', 'createdAt', 'lastLogin'].includes(sortBy) ? sortBy : 'createdAt';

  let query = {};

  // Status filter
  if (status && status !== 'all') {
    query.status = status.toLowerCase();
  }

  // Role filter
  if (role && role !== 'all') {
    query.role = role.toLowerCase();
  }

  // Search across name, email, phone
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limitNum)
      .select('-password -otp -otpExpires -resetPasswordToken -resetPasswordExpire')
      .lean(),
    User.countDocuments(query)
  ]);

  // Enrich with computed fields
  const items = users.map((user) => ({
    ...user,
    statusLabel: user.status === 'active' ? 'Active' : user.status === 'suspended' ? 'Suspended' : 'Inactive',
    roleLabel: user.role === 'admin' ? 'Admin' : user.role === 'owner' ? 'Owner' : 'User',
    isActive: user.status === 'active'
  }));

  return successResponse(res, {
    message: 'Users fetched successfully',
    data: {
      count: items.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      items
    }
  });
});

// ============================
// USER ACTIVITY & STATS
// ============================

/**
 * @desc    Get login activity history for a specific user
 * @route   GET /api/admin/users/:id/activity
 * @access  Private/Admin
 */
const getUserActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);

  const user = await User.findById(id).select('name email loginActivity').lean();
  if (!user) {
    return errorResponse(res, { statusCode: 404, message: 'User not found' });
  }

  const activities = (user.loginActivity || [])
    .slice()
    .reverse()
    .slice(0, limit)
    .map((entry) => ({
      _id: entry._id ? entry._id.toString() : `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action: entry.type || 'LOGIN',
      timestamp: entry.time,
      ipAddress: entry.ip,
      userAgent: entry.userAgent,
      status: 'success',
    }));

  return successResponse(res, {
    message: 'User activity fetched successfully',
    data: {
      user: { _id: user._id, name: user.name, email: user.email },
      activities,
    }
  });
});

/**
 * @desc    Get user stats (bookings & reviews count)
 * @route   GET /api/users/:id/stats
 * @access  Private/Admin
 */
const getUserStats = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id).select('name email').lean();
  if (!user) {
    return errorResponse(res, { statusCode: 404, message: 'User not found' });
  }

  const [bookingCount, reviewCount, bookings] = await Promise.all([
    Booking.countDocuments({ userId: id }),
    Review.countDocuments({ user: id }),
    Booking.find({ userId: id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('pgId', 'name city')
      .lean()
  ]);

  return successResponse(res, {
    message: 'User stats fetched successfully',
    data: {
      user: { _id: user._id, name: user.name, email: user.email },
      bookingCount,
      reviewCount,
      recentBookings: bookings.map((b) => ({
        _id: b._id,
        pgName: b.pgId?.name || 'Unknown',
        city: b.pgId?.city || 'Unknown',
        totalAmount: b.totalAmount,
        status: b.status,
        paymentStatus: b.paymentStatus,
        createdAt: b.createdAt,
      }))
    }
  });
});

// ============================
// ADMIN PROFILE MANAGEMENT
// ============================

/**
 * @desc    Get current admin profile
 * @route   GET /api/admin/profile
 * @access  Private/Admin
 */
const getAdminProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('-password -otp -otpExpires')
    .lean();

  if (!user) {
    return errorResponse(res, { statusCode: 404, message: 'Admin not found' });
  }

  return successResponse(res, {
    message: 'Admin profile fetched successfully',
    data: user
  });
});

/**
 * @desc    Update current admin profile
 * @route   PUT /api/admin/profile
 * @access  Private/Admin
 */
const updateAdminProfile = asyncHandler(async (req, res) => {
  const { name, email, phone, bio } = req.body;

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email.toLowerCase().trim();
  if (phone !== undefined) updateData.phone = phone;
  if (bio !== undefined) updateData.bio = bio;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateData },
    { new: true, runValidators: true }
  ).select('-password -otp -otpExpires');

  if (!user) {
    return errorResponse(res, { statusCode: 404, message: 'Admin not found' });
  }

  return successResponse(res, {
    message: 'Profile updated successfully',
    data: user
  });
});

/**
 * @desc    Update admin password
 * @route   PUT /api/admin/profile/password
 * @access  Private/Admin
 */
const updateAdminPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Current password and new password are required'
    });
  }

  if (newPassword.length < 6) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'New password must be at least 6 characters'
    });
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return errorResponse(res, { statusCode: 404, message: 'Admin not found' });
  }

  // Verify current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return errorResponse(res, {
      statusCode: 401,
      message: 'Current password is incorrect'
    });
  }

  user.password = newPassword;
  await user.save();

  return successResponse(res, {
    message: 'Password updated successfully'
  });
});

/**
 * @desc    Get activity logs for current admin
 * @route   GET /api/admin/profile/activity
 * @access  Private/Admin
 */
const getAdminOwnActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);

  const logs = await AuditLog.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return successResponse(res, {
    message: 'Admin activity logs fetched successfully',
    data: logs.map((log) => ({
      _id: log._id,
      action: log.action,
      userName: log.userName,
      userRole: log.userRole,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      details: log.details,
      status: log.status,
      timestamp: log.createdAt,
    }))
  });
});

// ============================
// ADMIN OFFER EMAIL
// ============================

/**
 * @desc    Send offer email to a specific user about a PG
 * @route   POST /api/admin/send-offer-email
 * @access  Private/Admin
 */
const sendAdminOfferEmail = asyncHandler(async (req, res) => {
  const { userId, pgId, offerMessage, discount } = req.body;

  // Validation
  if (!userId || !pgId || !offerMessage) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'userId, pgId, and offerMessage are required'
    });
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid userId format'
    });
  }

  if (!mongoose.Types.ObjectId.isValid(pgId)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid pgId format'
    });
  }

  if (typeof offerMessage !== 'string' || offerMessage.trim().length < 5) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'offerMessage must be at least 5 characters'
    });
  }

  const parsedDiscount = discount !== undefined && discount !== null
    ? parseFloat(discount)
    : null;

  if (parsedDiscount !== null && (isNaN(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'discount must be a number between 0 and 100'
    });
  }

  // Send email via service (non-blocking for response, but we await to know result)
  const sent = await sendOfferEmail(userId, pgId, offerMessage.trim(), parsedDiscount);

  if (!sent) {
    return errorResponse(res, {
      statusCode: 500,
      message: 'Failed to send offer email. Please check logs.'
    });
  }

  // Log audit
  try {
    await AuditLog.create({
      action: 'offer_sent',
      userId: req.user._id,
      userName: req.user.name || 'Admin',
      userRole: 'admin',
      targetType: 'user',
      targetId: userId,
      details: { pgId, discount: parsedDiscount, messageLength: offerMessage.length },
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || ''
    });
  } catch (auditErr) {
    console.error('Audit log error:', auditErr.message);
  }

  return successResponse(res, {
    message: 'Offer email sent successfully',
    data: { sent: true, userId, pgId }
  });
});

module.exports = {
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
  getUserActivity,
  getUserStats,
  getAdminProfile,
  updateAdminProfile,
  updateAdminPassword,
  getAdminOwnActivity,
  sendAdminOfferEmail
};

