const Booking = require('../models/Booking');

const hasOverlappingBooking = async ({ pgId, checkInDate, checkOutDate, session = null }) =>
  Booking.findOne({
    pgId,
    status: { $in: ['pending', 'confirmed'] },
    checkInDate: { $lt: checkOutDate },
    checkOutDate: { $gt: checkInDate },
  }).session(session);

const calculateBookingAmount = ({ monthlyPrice, durationMonths }) => {
  const safeMonthlyPrice = Number(monthlyPrice);
  const safeDuration = Number(durationMonths);

  if (!Number.isFinite(safeMonthlyPrice) || safeMonthlyPrice <= 0) {
    throw new Error('Invalid PG monthly price');
  }
  if (!Number.isFinite(safeDuration) || safeDuration <= 0) {
    throw new Error('Invalid booking duration');
  }

  return Math.round(safeMonthlyPrice * safeDuration);
};

module.exports = {
  hasOverlappingBooking,
  calculateBookingAmount,
};
