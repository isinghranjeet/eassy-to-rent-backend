// backend/src/controllers/bookingController.js
const Booking = require('../models/Booking');
const PGListing = require('../models/PGListing');
const Review = require('../models/Review');
const { successResponse, errorResponse } = require('../utils/response');

// Create a new booking
const createBooking = async (req, res) => {
  try {
    const {
      pgId,
      roomType,
      checkInDate,
      checkOutDate,
      durationMonths,
      totalAmount,
      guestDetails,
      specialRequests
    } = req.body;

    const userId = req.user.id;

    // Check if PG exists
    const pg = await PGListing.findById(pgId);
    if (!pg) {
      return res.status(404).json({ success: false, message: 'PG not found' });
    }

    // Check for overlapping bookings
    const existingBooking = await Booking.findOne({
      userId,
      pgId,
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        { checkInDate: { $lt: checkOutDate, $gte: checkInDate } },
        { checkOutDate: { $gt: checkInDate, $lte: checkOutDate } }
      ]
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'Selected dates are not available'
      });
    }

    const booking = new Booking({
      userId,
      pgId,
      roomType,
      checkInDate: new Date(checkInDate),
      checkOutDate: new Date(checkOutDate),
      durationMonths,
      totalAmount,
      guestDetails,
      specialRequests,
      status: 'confirmed',
      paymentStatus: 'paid',
      reviewed: false
    });

    await booking.save();

    // Update PG booking counts
    pg.weeklyBookings = (pg.weeklyBookings || 0) + 1;
    pg.monthlyBookings = (pg.monthlyBookings || 0) + 1;
    await pg.save();

    res.json({
      success: true,
      message: 'Booking confirmed successfully',
      bookingId: booking._id,
      data: booking
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ success: false, message: 'Failed to create booking' });
  }
};

// Get user bookings
const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const bookings = await Booking.find({ userId })
      .populate('pgId', 'name images address price type city rating')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
};

// Get single booking by ID
const getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const booking = await Booking.findOne({
      _id: bookingId,
      $or: [{ userId }, isAdmin ? {} : { _id: null }]
    }).populate('pgId', 'name images address price type city rating');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({
      success: true,
      booking
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch booking' });
  }
};

// Cancel booking
const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    const booking = await Booking.findOne({ _id: bookingId, userId });
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: 'Booking cannot be cancelled' });
    }

    // Check if within cancellation period (e.g., 7 days before check-in)
    const daysUntilCheckIn = Math.ceil(
      (new Date(booking.checkInDate) - new Date()) / (1000 * 60 * 60 * 24)
    );

    let refundAmount = 0;
    if (daysUntilCheckIn >= 7) {
      refundAmount = booking.totalAmount; // Full refund
    } else if (daysUntilCheckIn >= 3) {
      refundAmount = booking.totalAmount * 0.5; // 50% refund
    } else {
      refundAmount = 0; // No refund
    }

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason || 'User cancelled';
    await booking.save();

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      refundAmount,
      booking
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel booking' });
  }
};

// ✅ CHECK IF USER CAN REVIEW (CRITICAL FIXED)
const canReview = async (req, res) => {
  try {
    const { pgId } = req.params;
    const userId = req.user.id;

    // For admin, always allow review (for testing purposes)
    if (req.user.role === 'admin') {
      return res.json({
        success: true,
        canReview: true,
        message: 'Admin can review any property'
      });
    }

    // Check if user has a completed/confirmed booking for this PG
    const booking = await Booking.findOne({
      userId,
      pgId,
      status: { $in: ['completed', 'confirmed'] }
    });

    // Check if user has already reviewed this PG
    const existingReview = await Review.findOne({
      user: userId,
      pgListing: pgId
    });

    const canReviewFlag = !!(booking && !existingReview);

    res.json({
      success: true,
      canReview: canReviewFlag,
      bookingId: booking?._id || null,
      message: canReviewFlag 
        ? 'You can review this property' 
        : existingReview 
          ? 'You have already reviewed this property'
          : 'You need to complete a booking before reviewing'
    });
  } catch (error) {
    console.error('Error checking review eligibility:', error);
    res.status(500).json({ success: false, message: 'Server error', canReview: false });
  }
};

// ✅ Mark booking as reviewed (call after user submits review)
const markBookingAsReviewed = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findOne({ _id: bookingId, userId });
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    booking.reviewed = true;
    await booking.save();

    res.json({
      success: true,
      message: 'Booking marked as reviewed'
    });
  } catch (error) {
    console.error('Error marking booking as reviewed:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ Get all bookings (Admin only)
const getAllBookings = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { page = 1, limit = 20, status } = req.query;
    const query = {};
    
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('userId', 'name email phone')
      .populate('pgId', 'name city price images')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      count: bookings.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      bookings
    });
  } catch (error) {
    console.error('Error fetching all bookings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
};

// ✅ Update booking status (Admin only)
const updateBookingStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { bookingId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // If status is completed, user can now review
    if (status === 'completed') {
      booking.reviewed = false;
      await booking.save();
    }

    res.json({
      success: true,
      message: 'Booking status updated',
      booking
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ success: false, message: 'Failed to update booking' });
  }
};

// ✅ Get booking statistics (Admin only)
const getBookingStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const totalBookings = await Booking.countDocuments();
    const confirmedBookings = await Booking.countDocuments({ status: 'confirmed' });
    const completedBookings = await Booking.countDocuments({ status: 'completed' });
    const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });
    
    // Last 7 days bookings
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    
    const recentBookings = await Booking.countDocuments({
      createdAt: { $gte: last7Days }
    });

    // Total revenue (from completed and confirmed bookings)
    const revenueResult = await Booking.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      success: true,
      stats: {
        total: totalBookings,
        confirmed: confirmedBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
        recent7Days: recentBookings,
        totalRevenue: revenueResult[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Error fetching booking stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

module.exports = {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
  canReview,
  markBookingAsReviewed,
  getAllBookings,
  updateBookingStatus,
  getBookingStats
};