const Booking = require('../models/Booking');
const PGListing = require('../models/PGListing');
const Review = require('../models/Review');
const Activity = require('../models/Activity');
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { successResponse } = require('../utils/response');
const { hasOverlappingBooking, calculateBookingAmount } = require('../services/bookingService');

const createBooking = asyncHandler(async (req, res) => {
  const {
    pgId,
    roomType,
    checkInDate,
    checkOutDate,
    durationMonths,
    guestDetails,
    specialRequests,
  } = req.body;
  const userId = req.user._id;

  const session = await mongoose.startSession();
  let booking;

  try {
    await session.withTransaction(async () => {
      const pg = await PGListing.findById(pgId).session(session);
      if (!pg) throw new AppError('PG not found', 404);

      const parsedCheckInDate = new Date(checkInDate);
      const parsedCheckOutDate = new Date(checkOutDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (parsedCheckInDate < today) {
        throw new AppError('Check-in date cannot be in the past', 400);
      }
      if (parsedCheckOutDate <= parsedCheckInDate) {
        throw new AppError('Check-out date must be after check-in date', 400);
      }

      const existingBooking = await hasOverlappingBooking({
        pgId,
        checkInDate: parsedCheckInDate,
        checkOutDate: parsedCheckOutDate,
        session,
      });

      if (existingBooking) {
        throw new AppError('Selected dates are already booked for this PG', 409);
      }

      const calculatedTotalAmount = calculateBookingAmount({
        monthlyPrice: pg.price,
        durationMonths,
      });

      const createdBookings = await Booking.create(
        [{
          userId,
          pgId,
          roomType: roomType || 'Single Occupancy',
          checkInDate: parsedCheckInDate,
          checkOutDate: parsedCheckOutDate,
          durationMonths: Number(durationMonths),
          totalAmount: calculatedTotalAmount,
          guestDetails: guestDetails || {},
          specialRequests: specialRequests || '',
          status: 'pending',
          paymentStatus: 'pending',
          reviewed: false,
        }],
        { session }
      );

      booking = createdBookings[0];

      await PGListing.updateOne(
        { _id: pgId },
        { $inc: { weeklyBookings: 1, monthlyBookings: 1 } },
        { session }
      );
    });
  } finally {
    session.endSession();
  }

  logger.info('Booking created', { bookingId: booking._id, userId, pgId, status: booking.status });

  // Log activity
  try {
    const pg = await PGListing.findById(pgId).select('name city').lean();
    await Activity.create({
      type: 'BOOKING_CREATED',
      message: `New booking of ₹${booking.totalAmount} received`,
      userId,
      targetId: booking._id.toString(),
      targetName: pg?.name || 'Unknown PG',
      metadata: { amount: booking.totalAmount, city: pg?.city, status: booking.status },
    });
  } catch (activityErr) {
    console.error('Activity log error:', activityErr.message);
  }

  return successResponse(res, {
    statusCode: 201,
    message: 'Booking created successfully',
    data: booking,
  });
});

const getUserBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ userId: req.user._id })
    .populate('pgId', 'name images address price type city rating')
    .sort({ createdAt: -1 });
  return successResponse(res, { message: 'Bookings fetched', data: { count: bookings.length, bookings } });
});

const getBookingById = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('pgId', 'name address city price images')
    .populate('userId', 'name email phone');

  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.userId._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new AppError('Not authorized', 403);
  }

  return successResponse(res, { message: 'Booking fetched', data: booking });
});

const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.userId.toString() !== req.user._id.toString()) throw new AppError('Not authorized', 403);
  if (booking.status === 'cancelled') throw new AppError('Booking is already cancelled', 400);
  if (booking.status === 'completed') throw new AppError('Completed bookings cannot be cancelled', 400);

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  await booking.save();

  return successResponse(res, { message: 'Booking cancelled successfully', data: booking });
});

const canReview = asyncHandler(async (req, res) => {
  const { pgId } = req.params;
  const userId = req.user._id;

  if (req.user.role === 'admin') {
    return successResponse(res, {
      message: 'Admin can review any property',
      data: { canReview: true, hasBooking: true, alreadyReviewed: false },
    });
  }

  const booking = await Booking.findOne({
    userId,
    pgId,
    status: { $in: ['completed', 'confirmed'] },
  });

  const existingReview = await Review.findOne({ user: userId, pgListing: pgId });
  const canReviewFlag = Boolean(booking && !existingReview);

  return successResponse(res, {
    message: canReviewFlag ? 'You can review this property' : existingReview ? 'You have already reviewed this property' : 'You need to complete a booking before reviewing',
    data: {
      canReview: canReviewFlag,
      hasBooking: Boolean(booking),
      alreadyReviewed: Boolean(existingReview),
    },
  });
});

const getAllBookings = asyncHandler(async (req, res) => {
  const {
    status,
    search,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const pageNum = Math.max(parseInt(page), 1);
  const limitNum = Math.min(Math.max(parseInt(limit), 1), 100);
  const skip = (pageNum - 1) * limitNum;
  const sortDirection = sortOrder.toLowerCase() === 'asc' ? 1 : -1;
  const allowedSortFields = ['createdAt', 'status', 'paymentStatus', 'totalAmount'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

  const query = {};

  if (status && status !== 'all') {
    query.status = status;
  }

  if (search) {
    query.$or = [
      { 'guestDetails.name': { $regex: search, $options: 'i' } },
      { 'guestDetails.email': { $regex: search, $options: 'i' } },
      { 'guestDetails.phone': { $regex: search, $options: 'i' } }
    ];

    if (mongoose.Types.ObjectId.isValid(search)) {
      query.$or.push({ _id: mongoose.Types.ObjectId(search) });
    }
  }

  let baseQuery = Booking.find(query)
    .populate('pgId', 'name address city price images')
    .populate('userId', 'name email phone')
    .sort({ [sortField]: sortDirection })
    .skip(skip)
    .limit(limitNum);

  if (req.user.role === 'admin') {
    // no extra restrictions
  } else if (req.user.role === 'owner') {
    const ownerPgs = await PGListing.find({ owner: req.user._id });
    const pgIds = ownerPgs.map((pg) => pg._id);
    baseQuery = Booking.find({ ...query, pgId: { $in: pgIds } })
      .populate('pgId', 'name address city price images')
      .populate('userId', 'name email phone')
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limitNum);
  } else {
    throw new AppError('Not authorized', 403);
  }

  const [bookings, total] = await Promise.all([
    baseQuery,
    Booking.countDocuments(req.user.role === 'owner' ? { ...query, pgId: { $in: (await PGListing.find({ owner: req.user._id })).map((pg) => pg._id) } } : query)
  ]);

  return successResponse(res, {
    message: 'Bookings fetched',
    data: {
      items: bookings,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum)
    }
  });
});

const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);

  if (req.user.role === 'owner') {
    const pg = await PGListing.findById(booking.pgId);
    if (!pg || pg.owner.toString() !== req.user._id.toString()) throw new AppError('Not authorized', 403);
  } else if (req.user.role !== 'admin') {
    throw new AppError('Not authorized', 403);
  }

  const allowedTransitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['cancelled'],
    cancelled: [],
  };

  const currentStatus = booking.status;
  if (!allowedTransitions[currentStatus] || !allowedTransitions[currentStatus].includes(status)) {
    throw new AppError(`Invalid status transition from ${currentStatus} to ${status}`, 400);
  }

  booking.status = status;
  booking.updatedAt = new Date();
  await booking.save();

  return successResponse(res, { message: 'Booking status updated successfully', data: booking });
});

const getBookingStats = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new AppError('Not authorized', 403);

  const totalBookings = await Booking.countDocuments();
  const confirmedBookings = await Booking.countDocuments({ status: 'confirmed' });
  const completedBookings = await Booking.countDocuments({ status: 'completed' });
  const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  const recentBookings = await Booking.countDocuments({ createdAt: { $gte: last7Days } });
  const revenueResult = await Booking.aggregate([
    { $match: { status: { $in: ['confirmed', 'completed'] } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);

  return successResponse(res, {
    message: 'Booking stats fetched',
    data: {
      total: totalBookings,
      confirmed: confirmedBookings,
      completed: completedBookings,
      cancelled: cancelledBookings,
      recent7Days: recentBookings,
      totalRevenue: revenueResult[0]?.total || 0,
    },
  });
});

module.exports = {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
  canReview,
  getAllBookings,
  updateBookingStatus,
  getBookingStats
};