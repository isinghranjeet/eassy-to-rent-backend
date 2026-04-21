const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Booking = require('../models/Booking');
const PGListing = require('../models/PGListing');
const Wishlist = require('../models/Wishlist');
const Review = require('../models/Review');

// @desc    Get real analytics data
// @route   GET /api/stats/analytics
// @access  Private/Admin
const getAnalytics = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now);
  monthStart.setMonth(monthStart.getMonth() - 1);
  const yearStart = new Date(now);
  yearStart.setFullYear(yearStart.getFullYear() - 1);
  
  // User Stats
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ status: 'active' });
  const suspendedUsers = await User.countDocuments({ status: 'suspended' });
  const newUsersToday = await User.countDocuments({ createdAt: { $gte: todayStart } });
  const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: weekStart } });
  const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: monthStart } });
  const newUsersThisYear = await User.countDocuments({ createdAt: { $gte: yearStart } });
  
  // Daily Active Users (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dailyActive = await User.aggregate([
    { $match: { lastLogin: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastLogin' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  
  // Booking Stats
  const totalBookings = await Booking.countDocuments();
  const confirmedBookings = await Booking.countDocuments({ status: 'confirmed' });
  const pendingBookings = await Booking.countDocuments({ status: 'pending' });
  const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });
  const bookingsToday = await Booking.countDocuments({ createdAt: { $gte: todayStart } });
  const bookingsThisWeek = await Booking.countDocuments({ createdAt: { $gte: weekStart } });
  const bookingsThisMonth = await Booking.countDocuments({ createdAt: { $gte: monthStart } });
  const bookingsThisYear = await Booking.countDocuments({ createdAt: { $gte: yearStart } });
  
  // Revenue Stats
  const revenueResult = await Booking.aggregate([
    { $match: { status: 'confirmed', paymentStatus: 'paid' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);
  const totalRevenue = revenueResult[0]?.total || 0;
  
  const monthlyRevenue = await Booking.aggregate([
    { $match: { status: 'confirmed', paymentStatus: 'paid' } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, total: { $sum: '$totalAmount' } } },
    { $sort: { _id: -1 } },
    { $limit: 12 }
  ]);
  
  // PG Stats
  const totalPGs = await PGListing.countDocuments();
  const verifiedPGs = await PGListing.countDocuments({ verified: true });
  const pendingPGs = await PGListing.countDocuments({ verified: false });
  const featuredPGs = await PGListing.countDocuments({ featured: true });
  const publishedPGs = await PGListing.countDocuments({ published: true });
  
  // Popular Cities
  const popularCities = await PGListing.aggregate([
    { $match: { published: true } },
    { $group: { _id: '$city', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
  
  // PG Types Distribution
  const pgTypes = await PGListing.aggregate([
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]);
  
  // Wishlist Stats
  const totalWishlistItems = await Wishlist.aggregate([
    { $unwind: '$items' },
    { $count: 'total' }
  ]);
  const usersWithWishlist = await Wishlist.countDocuments({ 'items.0': { $exists: true } });
  
  // Review Stats
  const avgRating = await Review.aggregate([
    { $group: { _id: null, avg: { $avg: '$rating' } } }
  ]);
  const totalReviews = await Review.countDocuments();
  
  // User Roles Distribution
  const userRoles = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } }
  ]);
  
  res.json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersThisWeek,
        newThisMonth: newUsersThisMonth,
        newThisYear: newUsersThisYear,
        dailyActive: dailyActive,
        roles: userRoles
      },
      bookings: {
        total: totalBookings,
        confirmed: confirmedBookings,
        pending: pendingBookings,
        cancelled: cancelledBookings,
        today: bookingsToday,
        thisWeek: bookingsThisWeek,
        thisMonth: bookingsThisMonth,
        thisYear: bookingsThisYear
      },
      revenue: {
        total: totalRevenue,
        monthly: monthlyRevenue
      },
      pgs: {
        total: totalPGs,
        verified: verifiedPGs,
        pending: pendingPGs,
        featured: featuredPGs,
        published: publishedPGs,
        popularCities: popularCities,
        types: pgTypes
      },
      wishlist: {
        totalItems: totalWishlistItems[0]?.total || 0,
        usersWithWishlist: usersWithWishlist
      },
      reviews: {
        total: totalReviews,
        avgRating: avgRating[0]?.avg || 0
      }
    }
  });
});

// @desc    Get dashboard stats
// @route   GET /api/stats/dashboard
// @access  Private/Admin
const getDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const [totalUsers, totalPGs, totalBookings, totalRevenue, newUsersToday, newBookingsToday] = await Promise.all([
    User.countDocuments(),
    PGListing.countDocuments(),
    Booking.countDocuments(),
    Booking.aggregate([{ $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    User.countDocuments({ createdAt: { $gte: todayStart } }),
    Booking.countDocuments({ createdAt: { $gte: todayStart } })
  ]);
  
  res.json({
    success: true,
    data: {
      totalUsers,
      totalPGs,
      totalBookings,
      totalRevenue: totalRevenue[0]?.total || 0,
      newUsersToday,
      newBookingsToday
    }
  });
});

module.exports = {
  getAnalytics,
  getDashboardStats
};