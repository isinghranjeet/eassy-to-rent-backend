const PGListing = require('../models/PGListing');
const User = require('../models/User');
const Booking = require('../models/Booking');

exports.globalSearch = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === '') {
      return res.status(200).json({ success: true, data: { pgs: [], users: [], bookings: [] } });
    }

    const regex = new RegExp(q, 'i');

    const [pgs, users, bookings] = await Promise.all([
      PGListing.find({ $or: [{ name: regex }, { city: regex }, { locality: regex }] }).limit(5).lean(),
      User.find({ $or: [{ name: regex }, { email: regex }] }).limit(5).lean(),
      Booking.find({ bookingId: regex }).limit(5).lean()
    ]);

    return res.status(200).json({
      success: true,
      message: 'Global search results fetched',
      data: { pgs, users, bookings }
    });
  } catch (error) {
    return next(error);
  }
};