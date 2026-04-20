// backend/src/controllers/bookingController.js
import Booking from '../models/Booking.js';
import PGListing from '../models/PGListing.js';
import Review from '../models/Review.js';
import mongoose from 'mongoose';

// Create a new booking
export const createBooking = async (req, res) => {
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
      paymentStatus: 'paid' // For now, you can integrate Razorpay
    });

    await booking.save();

    res.json({
      success: true,
      message: 'Booking confirmed successfully',
      bookingId: booking._id
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ success: false, message: 'Failed to create booking' });
  }
};

// Get user bookings
export const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const bookings = await Booking.find({ userId })
      .populate('pgId', 'name images address price')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      bookings
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
};

// Cancel booking
export const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

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
    booking.cancellationReason = req.body.reason || 'User cancelled';
    await booking.save();

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      refundAmount
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel booking' });
  }
};

// Check if user can review (only if they've completed a booking)
export const canReview = async (req, res) => {
  try {
    const { pgId } = req.params;
    const userId = req.user.id;

    const hasCompletedBooking = await Booking.findOne({
      userId,
      pgId,
      status: 'completed',
      reviewed: false
    });

    res.json({
      success: true,
      canReview: !!hasCompletedBooking,
      bookingId: hasCompletedBooking?._id
    });
  } catch (error) {
    console.error('Error checking review eligibility:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};