// const os = require('os');
// const mongoose = require('mongoose');
// const AuditLog = require('../models/AuditLog');
// const AdminNotification = require('../models/AdminNotification');
// const User = require('../models/User');
// const PGListing = require('../models/PGListing');
// const Booking = require('../models/Booking');
// const Review = require('../models/Review');
// const PaymentLog = require('../models/PaymentLog');
// const ErrorLog = require('../models/ErrorLog');
// const Activity = require('../models/Activity');
// const { successResponse, errorResponse } = require('../utils/response');
// const { asyncHandler } = require('../middleware/asyncHandler');
// const { sendOfferEmail } = require('../services/notificationService');
// const { fillMissingPGSeo } = require('../utils/pgSeo');

// // ============================
// // ACTIVITY SYSTEM
// // ============================

// /**
//  * @desc    Get recent admin activity feed
//  * @route   GET /api/admin/activity
//  * @access  Private/Admin
//  */
// const getAdminActivity = asyncHandler(async (req, res) => {
//   const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

//   const activities = await Activity.find()
//     .sort({ createdAt: -1 })
//     .limit(limit)
//     .lean();

//   const mapped = activities.map((item) => ({
//     id: item._id.toString(),
//     type: mapActivityType(item.type),
//     message: item.message,
//     userId: item.userId?.toString(),
//     userName: item.userName,
//     targetId: item.targetId,
//     targetName: item.targetName,
//     metadata: item.metadata || {},
//     timestamp: item.createdAt.toISOString(),
//     read: false,
//   }));

//   return successResponse(res, {
//     message: 'Recent activity fetched successfully',
//     data: mapped,
//   });
// });

// function mapActivityType(type) {
//   const typeMap = {
//     USER_LOGIN: 'user_login',
//     USER_REGISTERED: 'user_signup',
//     USER_SUSPENDED: 'user_suspended',
//     USER_ACTIVATED: 'user_activated',
//     PG_CREATED: 'pg_created',
//     PG_UPDATED: 'pg_updated',
//     PG_DELETED: 'pg_deleted',
//     PG_VERIFIED: 'pg_verified',
//     PG_FEATURED: 'pg_featured',
//     BOOKING_CREATED: 'booking_created',
//     BOOKING_CANCELLED: 'booking_cancelled',
//     BOOKING_CONFIRMED: 'booking_confirmed',
//     PAYMENT_SUCCESS: 'payment_success',
//     PAYMENT_FAILED: 'payment_failure',
//     REVIEW_SUBMITTED: 'review_submitted',
//     REVIEW_APPROVED: 'review_approved',
//     REVIEW_REJECTED: 'review_rejected',
//     WISHLIST_ADDED: 'wishlist_added',
//     ADMIN_LOGIN: 'admin_login',
//     ADMIN_ACTION: 'admin_action',
//   };
//   return typeMap[type] || type;
// }

// // ============================
// // BOOKINGS MANAGEMENT ADMIN (UPDATED WITH UTR & PAID AMOUNT)
// // ============================

// /**
//  * @desc    Get paginated bookings with full PG and User population for Admin
//  * @route   GET /api/admin/bookings
//  * @access  Private/Admin
//  */
// const getAdminBookings = asyncHandler(async (req, res) => {
//   const {
//     status,
//     paymentStatus,
//     search,
//     sort = '-createdAt',
//     page = 1,
//     limit = 20
//   } = req.query;

//   const pageNum = Math.max(parseInt(page, 10) || 1, 1);
//   const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
//   const skip = (pageNum - 1) * limitNum;

//   let query = {};

//   if (status && status !== 'all') {
//     query.status = status.toLowerCase();
//   }

//   if (paymentStatus && paymentStatus !== 'all') {
//     query.paymentStatus = paymentStatus.toLowerCase();
//   }

//   if (search) {
//     const isMongoId = mongoose.Types.ObjectId.isValid(search);
//     query.$or = [
//       ...(isMongoId ? [{ _id: search }] : []),
//       { roomType: { $regex: search, $options: 'i' } }
//     ];
//   }

//   const [bookings, total] = await Promise.all([
//     Booking.find(query)
//       .populate('userId', 'name email phone')
//       .populate('pgId', 'name city address contactPhone')
//       .sort(sort)
//       .skip(skip)
//       .limit(limitNum)
//       .lean(),
//     Booking.countDocuments(query)
//   ]);

//   const items = bookings.map((b) => ({
//     ...b,
//     pgName: b.pgId?.name || 'Deleted Property',
//     pgCity: b.pgId?.city || '—',
//     userName: b.userId?.name || b.guestDetails?.name || 'Guest User',
//     userEmail: b.userId?.email || b.guestDetails?.email || '—',
//     userPhone: b.userId?.phone || b.guestDetails?.phone || '—',
//     // ✅ UTR & Actual Paid Amount Mapping
//     paidAmount: b.paidAmount || b.advancePaid || b.amountPaid || (b.paymentStatus === 'paid' ? b.totalAmount : 1),
//     utrNumber: b.utrNumber || b.paymentDetails?.utr || b.transactionId || 'Not Submitted'
//   }));

//   return successResponse(res, {
//     message: 'Admin bookings fetched successfully',
//     data: {
//       count: items.length,
//       total,
//       page: pageNum,
//       pages: Math.ceil(total / limitNum),
//       items
//     }
//   });
// });

// // ============================
// // NOTIFICATIONS SYSTEM
// // ============================

// const getAdminNotifications = asyncHandler(async (req, res) => {
//   const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

//   const storedNotifications = await AdminNotification.find()
//     .sort({ createdAt: -1 })
//     .limit(limit)
//     .lean();

//   const dynamicAlerts = await generateDynamicAlerts();

//   const allItems = [
//     ...dynamicAlerts.map((a) => ({ ...a, isDynamic: true })),
//     ...storedNotifications.map((n) => ({ ...n, isDynamic: false }))
//   ];

//   allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

//   const notifications = allItems.slice(0, limit).map((item) => ({
//     ...item,
//     id: item._id || item.id,
//     acknowledged: !!item.read,
//     severity: item.severity || item.type || 'info',
//     category: item.category || 'system_error'
//   }));

//   return successResponse(res, {
//     message: 'Notifications fetched successfully',
//     data: notifications
//   });
// });

// async function generateDynamicAlerts() {
//   const alerts = [];
//   const now = new Date();

//   const pendingReviewsCount = await Review.countDocuments({ status: 'pending' });
//   if (pendingReviewsCount > 0) {
//     alerts.push({
//       _id: 'dynamic_pending_reviews',
//       title: 'Reviews Pending Approval',
//       message: `${pendingReviewsCount} review${pendingReviewsCount > 1 ? 's are' : ' is'} waiting for approval.`,
//       type: 'warning',
//       read: false,
//       link: '/admin/reviews',
//       icon: 'MessageSquare',
//       createdAt: now,
//       metadata: { count: pendingReviewsCount }
//     });
//   }

//   const unverifiedPGsCount = await PGListing.countDocuments({ verified: false });
//   if (unverifiedPGsCount > 0) {
//     alerts.push({
//       _id: 'dynamic_unverified_pgs',
//       title: 'Unverified PG Listings',
//       message: `${unverifiedPGsCount} PG listing${unverifiedPGsCount > 1 ? 's' : ''} pending verification.`,
//       type: 'warning',
//       read: false,
//       link: '/admin/pgs',
//       icon: 'Building',
//       createdAt: now,
//       metadata: { count: unverifiedPGsCount }
//     });
//   }

//   const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//   const todayBookings = await Booking.countDocuments({ createdAt: { $gte: todayStart } });
//   if (todayBookings > 0) {
//     alerts.push({
//       _id: 'dynamic_today_bookings',
//       title: 'New Bookings Today',
//       message: `${todayBookings} new booking${todayBookings > 1 ? 's' : ''} received today.`,
//       type: 'info',
//       read: false,
//       link: '/admin/bookings',
//       icon: 'Calendar',
//       createdAt: now,
//       metadata: { count: todayBookings }
//     });
//   }

//   const suspendedUsers = await User.countDocuments({ status: 'suspended' });
//   if (suspendedUsers > 0) {
//     alerts.push({
//       _id: 'dynamic_suspended_users',
//       title: 'Suspended Users',
//       message: `${suspendedUsers} user account${suspendedUsers > 1 ? 's are' : ' is'} currently suspended.`,
//       type: 'alert',
//       read: false,
//       link: '/admin/users',
//       icon: 'ShieldAlert',
//       createdAt: now,
//       metadata: { count: suspendedUsers }
//     });
//   }

//   const failedPayments = await PaymentLog.countDocuments({
//     status: 'failed',
//     createdAt: { $gte: todayStart }
//   });
//   if (failedPayments > 0) {
//     alerts.push({
//       _id: 'dynamic_failed_payments',
//       title: 'Failed Payments Today',
//       message: `${failedPayments} payment${failedPayments > 1 ? 's' : ''} failed today.`,
//       type: 'error',
//       read: false,
//       link: '/admin/payments',
//       icon: 'CreditCard',
//       createdAt: now,
//       metadata: { count: failedPayments }
//     });
//   }

//   return alerts;
// }

// const markNotificationRead = asyncHandler(async (req, res) => {
//   const { id } = req.params;

//   if (id.startsWith('dynamic_')) {
//     return successResponse(res, {
//       message: 'Dynamic alert dismissed',
//       data: { dismissed: true }
//     });
//   }

//   const notification = await AdminNotification.findByIdAndUpdate(
//     id,
//     { read: true },
//     { new: true }
//   );

//   if (!notification) {
//     return errorResponse(res, { statusCode: 404, message: 'Notification not found' });
//   }

//   return successResponse(res, {
//     message: 'Notification marked as read',
//     data: notification
//   });
// });

// const markAllNotificationsRead = asyncHandler(async (req, res) => {
//   await AdminNotification.updateMany({ read: false }, { read: true });

//   return successResponse(res, {
//     message: 'All notifications marked as read',
//     data: { updated: true }
//   });
// });

// // ============================
// // AUDIT LOGS + SYSTEM HEALTH
// // ============================

// const getAuditLogs = asyncHandler(async (req, res) => {
//   const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
//   const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
//   const sortBy = ['createdAt', 'action', 'status'].includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
//   const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
//   const skip = (page - 1) * limit;

//   const query = {};
//   if (req.query.action && req.query.action !== 'all') {
//     query.action = req.query.action;
//   }

//   const [logs, total] = await Promise.all([
//     AuditLog.find(query)
//       .sort({ [sortBy]: sortOrder })
//       .skip(skip)
//       .limit(limit)
//       .lean(),
//     AuditLog.countDocuments(query)
//   ]);

//   return successResponse(res, {
//     message: 'Audit logs fetched successfully',
//     data: {
//       items: logs,
//       total,
//       page,
//       pages: Math.ceil(total / limit)
//     }
//   });
// });

// const getSystemHealth = asyncHandler(async (req, res) => {
//   const now = new Date();
//   const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
//   const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

//   const [recentErrorCount] = await Promise.all([
//     ErrorLog.countDocuments({ createdAt: { $gte: lastHour } })
//   ]);

//   const uptimePercentage = Number(Math.min(100, (process.uptime() / 86400) * 100).toFixed(1));
//   const apiSections = [
//     { label: '/api/health', status: 'healthy', responseTime: 32 },
//     { label: '/api/auth/login', status: 'healthy', responseTime: 110 },
//     { label: '/api/admin/activity', status: 'healthy', responseTime: 140 },
//     { label: '/api/admin/bookings', status: 'healthy', responseTime: 58 },
//     { label: '/api/admin/pgs', status: 'healthy', responseTime: 92 }
//   ];

//   return successResponse(res, {
//     message: 'System health fetched successfully',
//     data: {
//       overall: recentErrorCount > 5 ? 'degraded' : 'healthy',
//       uptime: uptimePercentage,
//       errorRate: Number(((recentErrorCount / 20) * 100).toFixed(1)),
//       apiHealth: apiSections,
//       slowEndpoints: apiSections.filter((item) => item.responseTime > 120),
//       serverLoad: {
//         cpu: Number((os.loadavg()[0] || 0).toFixed(1)),
//         memory: Number(((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100).toFixed(1)),
//         disk: 0
//       },
//       cacheHitRatio: 0
//     }
//   });
// });

// const getSystemErrors = asyncHandler(async (req, res) => {
//   const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
//   const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
//   const sortBy = ['createdAt', 'level', 'source'].includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
//   const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
//   const skip = (page - 1) * limit;

//   const logs = await ErrorLog.find()
//     .sort({ [sortBy]: sortOrder })
//     .skip(skip)
//     .limit(limit)
//     .lean();

//   return successResponse(res, {
//     message: 'System error logs fetched successfully',
//     data: logs
//   });
// });

// // ============================
// // PG MANAGEMENT ADMIN
// // ============================

// const getAdminPGs = asyncHandler(async (req, res) => {
//   const {
//     status,
//     city,
//     type,
//     search,
//     verified,
//     featured,
//     published,
//     minPrice,
//     maxPrice,
//     sort = '-createdAt',
//     page = 1,
//     limit = 20
//   } = req.query;

//   const pageNum = Math.max(parseInt(page, 10) || 1, 1);
//   const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
//   const skip = (pageNum - 1) * limitNum;

//   let query = {};

//   if (status) {
//     switch (status.toLowerCase()) {
//       case 'published': query.published = true; break;
//       case 'unpublished': query.published = false; break;
//       case 'verified': query.verified = true; break;
//       case 'pending': query.verified = false; query.published = true; break;
//       case 'unverified': query.verified = false; break;
//       case 'featured': query.featured = true; break;
//       case 'draft': query.published = false; break;
//       default: break;
//     }
//   }

//   if (verified !== undefined) query.verified = verified === 'true';
//   if (featured !== undefined) query.featured = featured === 'true';
//   if (published !== undefined) query.published = published === 'true';

//   if (city && city !== 'all') {
//     query.city = { $regex: city, $options: 'i' };
//   }

//   if (type && type !== 'all') {
//     query.type = type.toLowerCase();
//   }

//   if (minPrice !== undefined) {
//     query.price = { ...query.price, $gte: parseFloat(minPrice) };
//   }

//   if (maxPrice !== undefined) {
//     query.price = { ...query.price, $lte: parseFloat(maxPrice) };
//   }

//   if (search) {
//     query.$or = [
//       { name: { $regex: search, $options: 'i' } },
//       { address: { $regex: search, $options: 'i' } },
//       { city: { $regex: search, $options: 'i' } },
//       { ownerName: { $regex: search, $options: 'i' } },
//       { ownerEmail: { $regex: search, $options: 'i' } }
//     ];
//   }

//   const [pgs, total] = await Promise.all([
//     PGListing.find(query)
//       .sort(sort)
//       .skip(skip)
//       .limit(limitNum)
//       .lean(),
//     PGListing.countDocuments(query)
//   ]);

//   const items = pgs.map((pg) => ({
//     ...pg,
//     hasVirtualTour: !!(pg.videoUrl || pg.virtualTour),
//     statusLabel: pg.published ? (pg.verified ? 'Live' : 'Pending') : 'Draft'
//   }));

//   return successResponse(res, {
//     message: 'PG listings fetched successfully',
//     data: {
//       count: items.length,
//       total,
//       page: pageNum,
//       pages: Math.ceil(total / limitNum),
//       items
//     }
//   });
// });

// const updatePGStatus = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   const { field, value } = req.body;

//   const validFields = ['published', 'featured', 'verified', 'adminRecommended'];
//   if (!field || !validFields.includes(field)) {
//     return errorResponse(res, {
//       statusCode: 400,
//       message: `Invalid field. Must be one of: ${validFields.join(', ')}`
//     });
//   }

//   const pg = await PGListing.findById(id);

//   if (!pg) {
//     return errorResponse(res, { statusCode: 404, message: 'PG listing not found' });
//   }

//   pg[field] = value;
//   if (
//     (field === 'verified' && value === true) ||
//     (field === 'published' && value === true && pg.verified)
//   ) {
//     fillMissingPGSeo(pg);
//   }
//   pg.updatedAt = Date.now();
//   await pg.save();

//   return successResponse(res, {
//     message: `PG ${field} updated successfully`,
//     data: pg
//   });
// });

// // ============================
// // ADMIN STATS / DASHBOARD
// // ============================

// const getAdminDashboardStats = asyncHandler(async (req, res) => {
//   const now = new Date();
//   const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//   const weekStart = new Date(now);
//   weekStart.setDate(weekStart.getDate() - 7);
//   const monthStart = new Date(now);
//   monthStart.setMonth(monthStart.getMonth() - 1);

//   const [
//     totalUsers,
//     totalPGs,
//     totalBookings,
//     totalRevenueAgg,
//     totalReviews,
//     pendingReviews,
//     pendingPGs,
//     newUsersToday,
//     newBookingsToday,
//     newPGsThisWeek,
//     revenueThisMonthAgg,
//     bookingStatusAgg,
//     userRoleAgg,
//     pgTypeAgg,
//     topCitiesAgg
//   ] = await Promise.all([
//     User.countDocuments(),
//     PGListing.countDocuments(),
//     Booking.countDocuments(),
//     Booking.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
//     Review.countDocuments(),
//     Review.countDocuments({ status: 'pending' }),
//     PGListing.countDocuments({ verified: false }),
//     User.countDocuments({ createdAt: { $gte: todayStart } }),
//     Booking.countDocuments({ createdAt: { $gte: todayStart } }),
//     PGListing.countDocuments({ createdAt: { $gte: weekStart } }),
//     Booking.aggregate([
//       { $match: { paymentStatus: 'paid', createdAt: { $gte: monthStart } } },
//       { $group: { _id: null, total: { $sum: '$totalAmount' } } }
//     ]),
//     Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
//     User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
//     PGListing.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
//     PGListing.aggregate([
//       { $match: { published: true } },
//       { $group: { _id: '$city', count: { $sum: 1 } } },
//       { $sort: { count: -1 } },
//       { $limit: 5 }
//     ])
//   ]);

//   const totalRevenue = totalRevenueAgg[0]?.total || 0;
//   const revenueThisMonth = revenueThisMonthAgg[0]?.total || 0;

//   const bookingStatusMap = {};
//   bookingStatusAgg.forEach((s) => { bookingStatusMap[s._id] = s.count; });

//   const userRoleMap = {};
//   userRoleAgg.forEach((r) => { userRoleMap[r._id] = r.count; });

//   const pgTypeMap = {};
//   pgTypeAgg.forEach((t) => { pgTypeMap[t._id] = t.count; });

//   const activeListings = await PGListing.countDocuments({ published: true, verified: true });
//   const featuredPGs = await PGListing.countDocuments({ featured: true });
//   const newPGsToday = await PGListing.countDocuments({ createdAt: { $gte: todayStart } });
//   const bookingsToday = await Booking.countDocuments({ createdAt: { $gte: todayStart } });
//   const revenueTodayAgg = await Booking.aggregate([
//     { $match: { paymentStatus: 'paid', createdAt: { $gte: todayStart } } },
//     { $group: { _id: null, total: { $sum: '$totalAmount' } } }
//   ]);

//   const revenueToday = revenueTodayAgg[0]?.total || 0;

//   return successResponse(res, {
//     message: 'Dashboard stats fetched successfully',
//     data: {
//       totalUsers,
//       totalPGs,
//       totalBookings,
//       totalRevenue,
//       totalReviews,
//       pendingReviews,
//       pendingPGs,
//       activeListings,
//       featuredPGs,
//       newUsersToday,
//       newPGsToday,
//       bookingsToday,
//       revenueToday,
//       trends: {
//         newPGsThisWeek,
//         revenueThisMonth
//       },
//       breakdown: {
//         bookingsByStatus: bookingStatusMap,
//         usersByRole: userRoleMap,
//         pgsByType: pgTypeMap,
//         topCities: topCitiesAgg
//       }
//     }
//   });
// });

// const getAdminAnalytics = asyncHandler(async (req, res) => {
//   const now = new Date();
//   const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

//   const [dailySignups, dailyBookings, dailyRevenue] = await Promise.all([
//     User.aggregate([
//       { $match: { createdAt: { $gte: thirtyDaysAgo } } },
//       { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
//       { $sort: { _id: 1 } }
//     ]),
//     Booking.aggregate([
//       { $match: { createdAt: { $gte: thirtyDaysAgo } } },
//       { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
//       { $sort: { _id: 1 } }
//     ]),
//     Booking.aggregate([
//       { $match: { paymentStatus: 'paid', createdAt: { $gte: thirtyDaysAgo } } },
//       {
//         $group: {
//           _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
//           total: { $sum: '$totalAmount' }
//         }
//       },
//       { $sort: { _id: 1 } }
//     ])
//   ]);

//   return successResponse(res, {
//     message: 'Analytics fetched successfully',
//     data: { dailySignups, dailyBookings, dailyRevenue }
//   });
// });

// // ============================
// // USER MANAGEMENT ADMIN
// // ============================

// const getAdminUsers = asyncHandler(async (req, res) => {
//   const {
//     status,
//     role,
//     search,
//     sortBy = 'createdAt',
//     sortOrder = 'desc',
//     page = 1,
//     limit = 20
//   } = req.query;

//   const pageNum = Math.max(parseInt(page, 10) || 1, 1);
//   const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
//   const skip = (pageNum - 1) * limitNum;

//   const sortDirection = sortOrder.toLowerCase() === 'asc' ? 1 : -1;
//   const sortField = ['name', 'email', 'role', 'status', 'createdAt', 'lastLogin'].includes(sortBy) ? sortBy : 'createdAt';

//   let query = {};

//   if (status && status !== 'all') {
//     query.status = status.toLowerCase();
//   }

//   if (role && role !== 'all') {
//     query.role = role.toLowerCase();
//   }

//   if (search) {
//     query.$or = [
//       { name: { $regex: search, $options: 'i' } },
//       { email: { $regex: search, $options: 'i' } },
//       { phone: { $regex: search, $options: 'i' } }
//     ];
//   }

//   const [users, total] = await Promise.all([
//     User.find(query)
//       .sort({ [sortField]: sortDirection })
//       .skip(skip)
//       .limit(limitNum)
//       .select('-password -otp -otpExpires -resetPasswordToken -resetPasswordExpire -kyc.frontDocument -kyc.backDocument -kycDetails.frontDocumentUrl -kycDetails.backDocumentUrl')
//       .lean(),
//     User.countDocuments(query)
//   ]);

//   const items = users.map((user) => ({
//     ...user,
//     statusLabel: user.status === 'active' ? 'Active' : user.status === 'suspended' ? 'Suspended' : 'Inactive',
//     roleLabel: user.role === 'admin' ? 'Admin' : user.role === 'owner' ? 'Owner' : 'User',
//     isActive: user.status === 'active'
//   }));

//   return successResponse(res, {
//     message: 'Users fetched successfully',
//     data: {
//       count: items.length,
//       total,
//       page: pageNum,
//       pages: Math.ceil(total / limitNum),
//       items
//     }
//   });
// });

// const getAdminKycSubmissions = asyncHandler(async (req, res) => {
//   const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
//   const limitNum = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
//   const skip = (pageNum - 1) * limitNum;
//   const query = {
//     role: { $in: ['owner', 'user'] },
//     'kyc.status': { $ne: 'verified' },
//     $and: [
//       {
//         $or: [
//           { 'kyc.frontDocument': { $exists: true, $ne: '' } },
//           { 'kycDetails.frontDocumentUrl': { $exists: true, $ne: '' } },
//         ],
//       },
//       {
//         $or: [
//           { 'kyc.backDocument': { $exists: true, $ne: '' } },
//           { 'kycDetails.backDocumentUrl': { $exists: true, $ne: '' } },
//         ],
//       },
//     ],
//   };

//   const [items, total] = await Promise.all([
//     User.find(query)
//       .select('_id name email role phone status createdAt kyc.idType kyc.idNumber kyc.status kyc.rejectionReason kyc.submittedAt kycDetails.idType')
//       .sort({ 'kyc.submittedAt': -1, updatedAt: -1 })
//       .skip(skip)
//       .limit(limitNum)
//       .lean(),
//     User.countDocuments(query),
//   ]);

//   return successResponse(res, {
//     message: 'KYC submissions fetched successfully',
//     data: { items, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
//   });
// });

// const reviewUserKyc = asyncHandler(async (req, res) => {
//   const { status, rejectionReason = '' } = req.body;
//   if (!['verified', 'rejected'].includes(status)) {
//     return errorResponse(res, { statusCode: 400, message: 'KYC review status must be verified or rejected' });
//   }

//   const user = await User.findById(req.params.id);
//   if (!user) {
//     return errorResponse(res, { statusCode: 404, message: 'User not found' });
//   }

//   user.set('kyc.status', status);
//   user.set('kyc.rejectionReason', status === 'rejected' ? rejectionReason.trim() : '');
//   user.set('kyc.reviewedAt', new Date());
//   await user.save();

//   return successResponse(res, {
//     message: `${user.role === 'owner' ? 'Owner' : 'Tenant'} KYC ${status}`,
//     data: user,
//   });
// });

// const getUserActivity = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

//   const user = await User.findById(id).select('name email loginActivity').lean();
//   if (!user) {
//     return errorResponse(res, { statusCode: 404, message: 'User not found' });
//   }

//   const activities = (user.loginActivity || [])
//     .slice()
//     .reverse()
//     .slice(0, limit)
//     .map((entry) => ({
//       _id: entry._id ? entry._id.toString() : `login_${Date.now()}`,
//       action: entry.type || 'LOGIN',
//       timestamp: entry.time,
//       ipAddress: entry.ip,
//       userAgent: entry.userAgent,
//       status: 'success',
//     }));

//   return successResponse(res, {
//     message: 'User activity fetched successfully',
//     data: { user: { _id: user._id, name: user.name, email: user.email }, activities }
//   });
// });

// const getUserStats = asyncHandler(async (req, res) => {
//   const { id } = req.params;

//   const user = await User.findById(id).select('name email').lean();
//   if (!user) {
//     return errorResponse(res, { statusCode: 404, message: 'User not found' });
//   }

//   const [bookingCount, reviewCount, bookings] = await Promise.all([
//     Booking.countDocuments({ userId: id }),
//     Review.countDocuments({ user: id }),
//     Booking.find({ userId: id })
//       .sort({ createdAt: -1 })
//       .limit(5)
//       .populate('pgId', 'name city')
//       .lean()
//   ]);

//   return successResponse(res, {
//     message: 'User stats fetched successfully',
//     data: {
//       user: { _id: user._id, name: user.name, email: user.email },
//       bookingCount,
//       reviewCount,
//       recentBookings: bookings.map((b) => ({
//         _id: b._id,
//         pgName: b.pgId?.name || 'Unknown',
//         city: b.pgId?.city || 'Unknown',
//         totalAmount: b.totalAmount,
//         status: b.status,
//         paymentStatus: b.paymentStatus,
//         createdAt: b.createdAt,
//       }))
//     }
//   });
// });

// const getUserBookings = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   if (!mongoose.Types.ObjectId.isValid(id)) {
//     return errorResponse(res, { statusCode: 400, message: 'Invalid user ID' });
//   }

//   const bookings = await Booking.find({ userId: id })
//     .populate('pgId', 'name city slug price images')
//     .sort({ createdAt: -1 })
//     .lean();

//   return successResponse(res, {
//     message: 'User bookings fetched successfully',
//     data: bookings,
//   });
// });

// const getAdminProfile = asyncHandler(async (req, res) => {
//   const user = await User.findById(req.user._id).select('-password -otp -otpExpires').lean();
//   if (!user) {
//     return errorResponse(res, { statusCode: 404, message: 'Admin not found' });
//   }
//   return successResponse(res, { message: 'Admin profile fetched successfully', data: user });
// });

// const updateAdminProfile = asyncHandler(async (req, res) => {
//   const { name, email, phone, bio } = req.body;
//   const updateData = {};
//   if (name !== undefined) updateData.name = name;
//   if (email !== undefined) updateData.email = email.toLowerCase().trim();
//   if (phone !== undefined) updateData.phone = phone;
//   if (bio !== undefined) updateData.bio = bio;

//   const user = await User.findByIdAndUpdate(
//     req.user._id,
//     { $set: updateData },
//     { new: true, runValidators: true }
//   ).select('-password -otp -otpExpires');

//   return successResponse(res, { message: 'Profile updated successfully', data: user });
// });

// const updateAdminPassword = asyncHandler(async (req, res) => {
//   const { currentPassword, newPassword } = req.body;
//   if (!currentPassword || !newPassword || newPassword.length < 6) {
//     return errorResponse(res, { statusCode: 400, message: 'Valid current password and new password (min 6 chars) are required' });
//   }

//   const user = await User.findById(req.user._id);
//   const isMatch = await user.comparePassword(currentPassword);
//   if (!isMatch) {
//     return errorResponse(res, { statusCode: 401, message: 'Current password is incorrect' });
//   }

//   user.password = newPassword;
//   await user.save();

//   return successResponse(res, { message: 'Password updated successfully' });
// });

// const getAdminOwnActivity = asyncHandler(async (req, res) => {
//   const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
//   const logs = await AuditLog.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(limit).lean();
//   return successResponse(res, { message: 'Admin activity logs fetched successfully', data: logs });
// });

// const sendAdminOfferEmail = asyncHandler(async (req, res) => {
//   const { userId, pgId, offerMessage, discount } = req.body;
//   if (!userId || !pgId || !offerMessage) {
//     return errorResponse(res, { statusCode: 400, message: 'userId, pgId, and offerMessage are required' });
//   }

//   const sent = await sendOfferEmail(userId, pgId, offerMessage.trim(), discount ? parseFloat(discount) : null);
//   if (!sent) {
//     return errorResponse(res, { statusCode: 500, message: 'Failed to send offer email.' });
//   }

//   return successResponse(res, { message: 'Offer email sent successfully', data: { sent: true } });
// });

// module.exports = {
//   getAdminActivity,
//   getAdminBookings, // 👈 Added here to fix booking table population & amount/UTR issues
//   getAdminNotifications,
//   markNotificationRead,
//   markAllNotificationsRead,
//   getAdminPGs,
//   updatePGStatus,
//   getAdminDashboardStats,
//   getAdminAnalytics,
//   getAdminUsers,
//   getAdminKycSubmissions,
//   reviewUserKyc,
//   getAuditLogs,
//   getSystemHealth,
//   getSystemErrors,
//   getUserActivity,
//   getUserStats,
//   getUserBookings,
//   getAdminProfile,
//   updateAdminProfile,
//   updateAdminPassword,
//   getAdminOwnActivity,
//   sendAdminOfferEmail
// };