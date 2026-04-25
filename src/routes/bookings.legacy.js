const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const PGListing = require('../models/PGListing');
const { protect } = require('../middleware/authMiddleware');

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { pgId, roomType, startDate, duration, specialRequests } = req.body;

    const pg = await PGListing.findById(pgId);
    if (!pg) {
      return res.status(404).json({ error: 'PG not found' });
    }

    // Check if PG is available
    if (pg.availability === 'full') {
      return res.status(400).json({ error: 'PG is currently full' });
    }

    // Calculate total amount
    const totalAmount = pg.price * duration;
    const deposit = pg.deposit || Math.floor(totalAmount * 0.2); // 20% deposit

    const booking = new Booking({
      user: req.user._id,
      pgListing: pgId,
      roomType,
      startDate,
      duration,
      totalAmount,
      deposit,
      specialRequests,
      status: 'pending'
    });

    const createdBooking = await booking.save();
    res.status(201).json(createdBooking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Get user's bookings
// @route   GET /api/bookings/mybookings
// @access  Private
router.get('/mybookings', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('pgListing', 'name address images price type')
      .sort({ createdAt: -1 });
    
    res.json(bookings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Get booking by ID
// @route   GET /api/bookings/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('pgListing')
      .populate('user', 'name email phone');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if user is authorized to view this booking
    if (booking.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(booking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if user is authorized
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if booking can be cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ error: 'Completed bookings cannot be cancelled' });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
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
        .populate('pgListing')
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'owner') {
      // Owner can see bookings for their PGs
      const ownerPgs = await PGListing.find({ owner: req.user._id });
      const pgIds = ownerPgs.map(pg => pg._id);
      
      bookings = await Booking.find({ pgListing: { $in: pgIds } })
        .populate('pgListing')
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 });
    } else {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(bookings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Update booking status (Admin/Owner)
// @route   PUT /api/bookings/:id/status
// @access  Private/Admin/Owner
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check authorization
    if (req.user.role === 'owner') {
      const pg = await PGListing.findById(booking.pgListing);
      if (pg.owner.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    booking.status = status;
    await booking.save();

    res.json({ message: 'Booking status updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;