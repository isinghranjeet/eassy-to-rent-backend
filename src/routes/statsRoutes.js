const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Booking = require('../models/Booking');
const PGListing = require('../models/PGListing');
const Review = require('../models/Review');
const { successResponse, errorResponse } = require('../utils/response');

// ──────────────────────────────────────────────
// DASHBOARD STATS
// ──────────────────────────────────────────────
router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now);
    monthStart.setMonth(monthStart.getMonth() - 1);

    const [
      totalUsers,
      totalPGs,
      totalBookings,
      totalRevenueAgg,
      totalReviews,
      newUsersToday,
      newPGsToday,
      bookingsToday,
      revenueTodayAgg,
      pendingPGs,
      featuredPGs,
      suspendedUsers,
      bookingStatusAgg,
      userRoleAgg,
      pgTypeAgg,
      topCitiesAgg,
      weeklyBookingsCount,
      monthlyBookingsCount,
    ] = await Promise.all([
      User.countDocuments(),
      PGListing.countDocuments(),
      Booking.countDocuments(),
      Booking.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Review.countDocuments(),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      PGListing.countDocuments({ createdAt: { $gte: weekStart } }),
      Booking.countDocuments({ createdAt: { $gte: todayStart } }),
      Booking.aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      PGListing.countDocuments({ verified: false }),
      PGListing.countDocuments({ featured: true }),
      User.countDocuments({ status: 'suspended' }),
      Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      PGListing.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
      PGListing.aggregate([
        { $match: { published: true } },
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      Booking.countDocuments({ createdAt: { $gte: weekStart } }),
      Booking.countDocuments({ createdAt: { $gte: monthStart } }),
    ]);

    const totalRevenue = totalRevenueAgg[0]?.total || 0;
    const revenueToday = revenueTodayAgg[0]?.total || 0;

    return successResponse(res, {
      data: {
        totalUsers,
        totalPGs,
        totalBookings,
        totalRevenue,
        totalReviews,
        pendingApprovals: pendingPGs,
        featuredPGs,
        activeListings: await PGListing.countDocuments({ published: true, verified: true }),
        newUsersToday,
        newPGsToday,
        bookingsToday,
        revenueToday,
        suspendedUsers,
        trends: {
          newPGsThisWeek: newPGsToday,
          weeklyBookings: weeklyBookingsCount,
          monthlyBookings: monthlyBookingsCount,
          revenueThisMonth: totalRevenue,
        },
        breakdown: {
          bookingsByStatus: Object.fromEntries(bookingStatusAgg.map((s) => [s._id, s.count])),
          usersByRole: Object.fromEntries(userRoleAgg.map((r) => [r._id, r.count])),
          pgsByType: Object.fromEntries(pgTypeAgg.map((t) => [t._id, t.count])),
          topCities: topCitiesAgg,
        },
      },
    });
  } catch (error) {
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

// ──────────────────────────────────────────────
// FULL ANALYTICS with chart-ready data
// ──────────────────────────────────────────────
router.get('/analytics', protect, adminOnly, async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // ── Monthly Revenue (last 6 months) ──
    const monthlyRevenue = await Booking.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          month: '$_id',
          revenue: 1,
          bookings: 1,
        },
      },
    ]);

    // ── Daily Booking Trends (last 30 days) ──
    const bookingTrends = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1,
        },
      },
    ]);

    // ── Daily User Signups (last 30 days) ──
    const dailySignups = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1,
        },
      },
    ]);

    // ── City Distribution with percentage ──
    const totalPGCount = await PGListing.countDocuments({ published: true });
    const cityDistributionRaw = await PGListing.aggregate([
      { $match: { published: true } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    const cityDistribution = cityDistributionRaw.map((c) => ({
      city: c._id || 'Unknown',
      count: c.count,
      percentage: totalPGCount > 0 ? parseFloat(((c.count / totalPGCount) * 100).toFixed(1)) : 0,
    }));

    // ── Most Viewed PGs (top 10) ──
    const mostViewedPGs = await PGListing.find({ published: true })
      .sort({ views: -1 })
      .limit(10)
      .select('name city views weeklyBookings monthlyBookings price rating')
      .lean();

    // Get booking counts for each of the top viewed PGs
    const topPgIds = mostViewedPGs.map((pg) => pg._id);
    const bookingCounts = await Booking.aggregate([
      { $match: { pgId: { $in: topPgIds }, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$pgId', count: { $sum: 1 } } },
    ]);
    const bookingCountMap = Object.fromEntries(bookingCounts.map((b) => [b._id.toString(), b.count]));

    const mostViewed = mostViewedPGs.map((pg) => ({
      pgId: pg._id.toString(),
      name: pg.name,
      city: pg.city,
      views: pg.views || 0,
      bookings: bookingCountMap[pg._id.toString()] || 0,
      conversionRate:
        pg.views > 0
          ? parseFloat((((bookingCountMap[pg._id.toString()] || 0) / pg.views) * 100).toFixed(2))
          : 0,
    }));

    // ── Totals ──
    const totalViewsResult = await PGListing.aggregate([
      { $group: { _id: null, total: { $sum: '$views' } } },
    ]);
    const totalViews = totalViewsResult[0]?.total || 0;
    const totalBookings = await Booking.countDocuments({ status: { $ne: 'cancelled' } });
    const conversionRate = totalViews > 0 ? parseFloat(((totalBookings / totalViews) * 100).toFixed(2)) : 0;

    return successResponse(res, {
      data: {
        monthlyRevenue,
        bookingTrends,
        dailySignups,
        cityDistribution,
        mostViewedPGs: mostViewed,
        conversionRate,
        totalViews,
        totalBookings,
      },
    });
  } catch (error) {
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

module.exports = router;
