const Booking = require('../../models/Booking');
const { successResponse } = require('../../utils/response');
const { asyncHandler } = require('../../middleware/asyncHandler');
const mongoose = require('mongoose');

/**
 * @desc    Get paginated bookings with full PG and User population for Admin
 * @route   GET /api/admin/bookings
 * @access  Private/Admin
 */
const getAdminBookings = asyncHandler(async (req, res) => {
  const {
    status,
    paymentStatus,
    search,
    sort = '-createdAt',
    page = 1,
    limit = 20
  } = req.query;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  let query = {};

  if (status && status !== 'all') {
    query.status = status.toLowerCase();
  }

  if (paymentStatus && paymentStatus !== 'all') {
    query.paymentStatus = paymentStatus.toLowerCase();
  }

  if (search) {
    const isMongoId = mongoose.Types.ObjectId.isValid(search);
    query.$or = [
      ...(isMongoId ? [{ _id: search }] : []),
      { roomType: { $regex: search, $options: 'i' } }
    ];
  }

  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('userId', 'name email phone')
      .populate('pgId', 'name city address contactPhone')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Booking.countDocuments(query)
  ]);

  const items = bookings.map((b) => ({
    ...b,
    pgName: b.pgId?.name || 'Deleted Property',
    pgCity: b.pgId?.city || '—',
    userName: b.userId?.name || b.guestDetails?.name || 'Guest User',
    userEmail: b.userId?.email || b.guestDetails?.email || '—',
    userPhone: b.userId?.phone || b.guestDetails?.phone || '—',
    paidAmount: b.paidAmount || b.advancePaid || b.amountPaid || (b.paymentStatus === 'paid' ? b.totalAmount : 1),
    utrNumber: b.utrNumber || b.paymentDetails?.utr || b.transactionId || 'Not Submitted'
  }));

  return successResponse(res, {
    message: 'Admin bookings fetched successfully',
    data: {
      count: items.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      items
    }
  });
});

module.exports = {
  getAdminBookings
};