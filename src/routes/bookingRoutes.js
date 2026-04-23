const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const PGListing = require('../models/PGListing');
const Review = require('../models/Review');
const { protect } = require('../middleware/authMiddleware');

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private
router.post('/', protect, async (req, res) => {
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

    console.log('=== BOOKING CREATE DEBUG ===');
    console.log('pgId:', pgId);
    console.log('roomType:', roomType);
    console.log('checkInDate:', checkInDate);
    console.log('checkOutDate:', checkOutDate);
    console.log('durationMonths:', durationMonths);
    console.log('totalAmount (raw):', totalAmount);
    console.log('totalAmount type:', typeof totalAmount);
    console.log('guestDetails:', guestDetails);
    console.log('User ID:', req.user?._id);
    console.log('User Role:', req.user?.role);
    console.log('==============================');

    // ✅ Validate required fields
    if (!pgId) {
      return res.status(400).json({ success: false, error: 'PG ID is required' });
    }
    if (!checkInDate) {
      return res.status(400).json({ success: false, error: 'Check-in date is required' });
    }
    if (!checkOutDate) {
      return res.status(400).json({ success: false, error: 'Check-out date is required' });
    }
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    // ✅ Ensure totalAmount is a valid number
    let finalTotalAmount = Number(totalAmount);
    if (isNaN(finalTotalAmount) || finalTotalAmount <= 0) {
      console.error('Invalid totalAmount:', totalAmount);
      return res.status(400).json({ 
        success: false, 
        error: `Invalid total amount: ${totalAmount}. Please provide a valid number.` 
      });
    }

    // Check if PG exists
    const pg = await PGListing.findById(pgId);
    if (!pg) {
      return res.status(404).json({ success: false, error: 'PG not found' });
    }

    // ✅ Create booking with correct field mapping
    const bookingData = {
      userId: req.user._id,
      pgId: pgId,
      roomType: roomType || 'Single Occupancy',
      checkInDate: new Date(checkInDate),
      checkOutDate: new Date(checkOutDate),
      durationMonths: durationMonths || 1,
      totalAmount: finalTotalAmount,
      discountApplied: 0,
      status: 'pending',
      paymentStatus: 'pending',
      guestDetails: {
        name: guestDetails?.name || '',
        phone: guestDetails?.phone || '',
        email: guestDetails?.email || ''
      },
      specialRequests: specialRequests || ''
    };

    console.log('Creating booking with data:', JSON.stringify(bookingData, null, 2));

    const booking = new Booking(bookingData);
    const createdBooking = await booking.save();
    
    console.log('✅ Booking created successfully:', createdBooking._id);
    
    res.status(201).json({ 
      success: true, 
      message: 'Booking created successfully',
      data: createdBooking 
    });
  } catch (error) {
    console.error('❌ Create booking error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// @desc    Get user's bookings
// @route   GET /api/bookings/mybookings
// @access  Private
router.get('/mybookings', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id })
      .populate('pgId', 'name address images price type city rating')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// @desc    Get booking by ID
// @route   GET /api/bookings/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('pgId', 'name address city price images')
      .populate('userId', 'name email phone');

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Check if user is authorized
    if (booking.userId._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    console.error('Get booking by ID error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Check if user is authorized
    if (booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Booking is already cancelled' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ success: false, error: 'Completed bookings cannot be cancelled' });
    }

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    await booking.save();

    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// @desc    Check if user can review a PG
// @route   GET /api/bookings/can-review/:pgId
// @access  Private
router.get('/can-review/:pgId', protect, async (req, res) => {
  try {
    const { pgId } = req.params;
    const userId = req.user._id;

    console.log('=== can-review API called ===');
    console.log('PG ID:', pgId);
    console.log('User ID:', userId);
    console.log('User Role:', req.user.role);

    // Admin can always review
    if (req.user.role === 'admin') {
      console.log('Admin user - allowing review');
      return res.json({ 
        success: true, 
        canReview: true, 
        message: 'Admin can review any property' 
      });
    }

    // Check if user has a completed/confirmed booking for this PG
    const booking = await Booking.findOne({
      userId: userId,
      pgId: pgId,
      status: { $in: ['completed', 'confirmed'] }
    });

    console.log('Found booking:', booking ? 'Yes' : 'No');

    // Check if user has already reviewed this PG
    const existingReview = await Review.findOne({
      user: userId,
      pgListing: pgId
    });

    console.log('Existing review:', existingReview ? 'Yes' : 'No');

    const canReviewFlag = !!(booking && !existingReview);

    res.json({
      success: true,
      canReview: canReviewFlag,
      hasBooking: !!booking,
      alreadyReviewed: !!existingReview,
      message: canReviewFlag 
        ? 'You can review this property' 
        : existingReview 
          ? 'You have already reviewed this property'
          : 'You need to complete a booking before reviewing'
    });
  } catch (error) {
    console.error('can-review API error:', error);
    res.status(500).json({ 
      success: false, 
      canReview: false,
      message: error.message 
    });
  }
});

// @desc    Get all bookings (Admin/Owner)
// @route   GET /api/bookings
// @access  Private/Admin/Owner
router.get('/', protect, async (req, res) => {
  try {
    let bookings;
    
    if (req.user.role === 'admin') {
      // Admin can see all bookings
      bookings = await Booking.find({})
        .populate('pgId', 'name address city price images')
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'owner') {
      // Owner can see bookings for their PGs
      const ownerPgs = await PGListing.find({ owner: req.user._id });
      const pgIds = ownerPgs.map(pg => pg._id);
      
      bookings = await Booking.find({ pgId: { $in: pgIds } })
        .populate('pgId', 'name address city price images')
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 });
    } else {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// @desc    Update booking status (Admin/Owner)
// @route   PUT /api/bookings/:id/status
// @access  Private/Admin/Owner
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Check authorization
    if (req.user.role === 'owner') {
      const pg = await PGListing.findById(booking.pgId);
      if (!pg || pg.owner.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Not authorized' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    booking.status = status;
    booking.updatedAt = new Date();
    await booking.save();

    // If status is completed, user can now review
    if (status === 'completed') {
      booking.reviewed = false;
      await booking.save();
    }

    res.json({ success: true, message: 'Booking status updated successfully', data: booking });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// @desc    Get booking statistics (Admin only)
// @route   GET /api/bookings/stats/all
// @access  Private/Admin
router.get('/stats/all', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized' });
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

    // Total revenue
    const revenueResult = await Booking.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      success: true,
      data: {
        total: totalBookings,
        confirmed: confirmedBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
        recent7Days: recentBookings,
        totalRevenue: revenueResult[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Get booking stats error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;