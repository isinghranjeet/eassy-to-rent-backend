const User = require('../../models/User');
const PGListing = require('../../models/PGListing');
const Booking = require('../../models/Booking');
const Review = require('../../models/Review');
const { successResponse } = require('../../utils/response');
const { asyncHandler } = require('../../middleware/asyncHandler');

const getAdminDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalUsers,
    totalPGs,
    totalBookings,
    totalRevenueAgg,
    totalReviews,
    pendingReviews,
    pendingPGs,
    newUsersToday,
    bookingsToday
  ] = await Promise.all([
    User.countDocuments(),
    PGListing.countDocuments(),
    Booking.countDocuments(),
    Booking.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Review.countDocuments(),
    Review.countDocuments({ status: 'pending' }),
    PGListing.countDocuments({ verified: false }),
    User.countDocuments({ createdAt: { $gte: todayStart } }),
    Booking.countDocuments({ createdAt: { $gte: todayStart } })
  ]);

  const totalRevenue = totalRevenueAgg[0]?.total || 0;

  return successResponse(res, {
    message: 'Dashboard stats fetched successfully',
    data: { totalUsers, totalPGs, totalBookings, totalRevenue, totalReviews, pendingReviews, pendingPGs, newUsersToday, bookingsToday }
  });
});

const getAdminAnalytics = asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dailyBookings = await Booking.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  return successResponse(res, { message: 'Analytics fetched successfully', data: { dailyBookings } });
});

module.exports = { getAdminDashboardStats, getAdminAnalytics };