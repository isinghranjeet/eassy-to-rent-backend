const Booking = require('../models/Booking');
const PGListing = require('../models/PGListing');
const AppError = require('../utils/AppError');

const getRemainingRooms = async ({
  pgId,
  roomType,
  checkInDate,
  checkOutDate,
  session = null,
}) => {
  // Load PG + inventory for the specific room type.
  const pg = await PGListing.findById(pgId)
    .select('roomInventory')
    .session(session)
    .lean();

  if (!pg) {
    throw new AppError('PG not found', 404);
  }

  const inventory = pg.roomInventory?.[roomType];

  if (!inventory || inventory.total === undefined || inventory.available === undefined) {
    throw new AppError('Selected room type does not exist for this PG', 400);
  }

  const total = Number(inventory.total);

  if (!Number.isFinite(total) || total <= 0) {
    throw new AppError('Selected room type is not available for booking', 400);
  }

  // Count overlapping reservations for this specific roomType.
  const booked = await Booking.countDocuments({
    pgId,
    roomType,
    status: { $in: ['pending', 'confirmed'] },
    checkInDate: { $lt: checkOutDate },
    checkOutDate: { $gt: checkInDate },
  }).session(session);

  const available = total - booked;

  return {
    total,
    booked,
    available,
  };
};


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
  getRemainingRooms,
  calculateBookingAmount,
};

