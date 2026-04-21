const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Booking = require('../models/Booking');
const PGListing = require('../models/PGListing');
const Wishlist = require('../models/Wishlist');
const { successResponse, errorResponse } = require('../utils/response');

// Get dashboard stats
router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
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
    
    return successResponse(res, {
      data: {
        totalUsers,
        totalPGs,
        totalBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
        newUsersToday,
        newBookingsToday
      }
    });
  } catch (error) {
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

// Get full analytics
router.get('/analytics', protect, adminOnly, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now);
    monthStart.setMonth(monthStart.getMonth() - 1);
    
    // User stats
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const suspendedUsers = await User.countDocuments({ status: 'suspended' });
    const newUsersToday = await User.countDocuments({ createdAt: { $gte: todayStart } });
    const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: weekStart } });
    const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: monthStart } });
    
    // Booking stats
    const totalBookings = await Booking.countDocuments();
    const bookingsToday = await Booking.countDocuments({ createdAt: { $gte: todayStart } });
    const bookingsThisWeek = await Booking.countDocuments({ createdAt: { $gte: weekStart } });
    const bookingsThisMonth = await Booking.countDocuments({ createdAt: { $gte: monthStart } });
    
    // Revenue stats
    const revenueResult = await Booking.aggregate([
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;
    
    // Popular cities
    const popularCities = await PGListing.aggregate([
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    // PG stats
    const totalPGs = await PGListing.countDocuments();
    const verifiedPGs = await PGListing.countDocuments({ verified: true });
    const pendingPGs = await PGListing.countDocuments({ verified: false });
    
    // Wishlist stats
    const usersWithWishlist = await Wishlist.countDocuments({ 'items.0': { $exists: true } });
    
    return successResponse(res, {
      data: {
        users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers, newToday: newUsersToday, newThisWeek: newUsersThisWeek, newThisMonth: newUsersThisMonth },
        bookings: { total: totalBookings, today: bookingsToday, thisWeek: bookingsThisWeek, thisMonth: bookingsThisMonth },
        revenue: { total: totalRevenue },
        pgs: { total: totalPGs, verified: verifiedPGs, pending: pendingPGs, popularCities },
        wishlist: { usersWithWishlist }
      }
    });
  } catch (error) {
    return errorResponse(res, { statusCode: 500, message: error.message });
  }
});

module.exports = router;