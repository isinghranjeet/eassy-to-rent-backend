const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const PGListing = require('../models/PGListing');
const { logger } = require('../utils/logger');

const expirePendingBookings = async () => {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const candidates = await Booking.find({
    status: 'pending',
    paymentStatus: 'pending',
    createdAt: { $lte: cutoff },
  }).select('_id pgId roomType').lean();

  for (const candidate of candidates) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const booking = await Booking.findOne({
          _id: candidate._id,
          status: 'pending',
          paymentStatus: 'pending',
        }).session(session);
        if (!booking) return;

        const roomType = booking.roomType || 'Single Occupancy';
        await PGListing.updateOne(
          { _id: booking.pgId },
          {
            $inc: {
              weeklyBookings: -1,
              monthlyBookings: -1,
              [`roomInventory.${roomType}.available`]: 1,
            },
          },
          { session }
        );
        await Booking.deleteOne({ _id: booking._id }).session(session);
      });
    } catch (error) {
      logger.error('Pending booking expiry failed', { bookingId: candidate._id, error: error.message });
    } finally {
      await session.endSession();
    }
  }
};

const startBookingExpiryJob = () => {
  const run = () => expirePendingBookings().catch((error) => {
    logger.error('Pending booking expiry job failed', { error: error.message });
  });
  run();
  const timer = setInterval(run, 5 * 60 * 1000);
  timer.unref?.();
  return timer;
};

module.exports = { startBookingExpiryJob, expirePendingBookings };
