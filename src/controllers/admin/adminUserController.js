const User = require('../../models/User');
const Booking = require('../../models/Booking');
const Review = require('../../models/Review');
const { successResponse, errorResponse } = require('../../utils/response');
const { asyncHandler } = require('../../middleware/asyncHandler');
const mongoose = require('mongoose');

const getAdminUsers = asyncHandler(async (req, res) => {
  const {
    status,
    role,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 20
  } = req.query;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const sortDirection = sortOrder.toLowerCase() === 'asc' ? 1 : -1;
  const sortField = ['name', 'email', 'role', 'status', 'createdAt', 'lastLogin'].includes(sortBy) ? sortBy : 'createdAt';

  let query = {};
  if (status && status !== 'all') query.status = status.toLowerCase();
  if (role && role !== 'all') query.role = role.toLowerCase();
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limitNum)
      .select('-password -otp -otpExpires -resetPasswordToken -resetPasswordExpire')
      .lean(),
    User.countDocuments(query)
  ]);

  const items = users.map((user) => ({
    ...user,
    statusLabel: user.status === 'active' ? 'Active' : user.status === 'suspended' ? 'Suspended' : 'Inactive',
    roleLabel: user.role === 'admin' ? 'Admin' : user.role === 'owner' ? 'Owner' : 'User',
    isActive: user.status === 'active'
  }));

  return successResponse(res, {
    message: 'Users fetched successfully',
    data: { count: items.length, total, page: pageNum, pages: Math.ceil(total / limitNum), items }
  });
});

const getAdminKycSubmissions = asyncHandler(async (req, res) => {
  const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;
  
  const query = {
    role: { $in: ['owner', 'user'] },
    'kyc.status': { $ne: 'verified' },
  };

  const [items, total] = await Promise.all([
    User.find(query).select('_id name email role phone status createdAt kyc').sort({ updatedAt: -1 }).skip(skip).limit(limitNum).lean(),
    User.countDocuments(query),
  ]);

  return successResponse(res, { message: 'KYC submissions fetched successfully', data: { items, total, page: pageNum, pages: Math.ceil(total / limitNum) } });
});

const reviewUserKyc = asyncHandler(async (req, res) => {
  const { status, rejectionReason = '' } = req.body;
  if (!['verified', 'rejected'].includes(status)) {
    return errorResponse(res, { statusCode: 400, message: 'KYC status must be verified or rejected' });
  }

  const user = await User.findById(req.params.id);
  if (!user) return errorResponse(res, { statusCode: 404, message: 'User not found' });

  user.set('kyc.status', status);
  user.set('kyc.rejectionReason', status === 'rejected' ? rejectionReason.trim() : '');
  user.set('kyc.reviewedAt', new Date());
  await user.save();

  return successResponse(res, { message: `KYC ${status}`, data: user });
});

const getUserActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id).select('name email loginActivity').lean();
  if (!user) return errorResponse(res, { statusCode: 404, message: 'User not found' });

  return successResponse(res, { message: 'User activity fetched', data: { user, activities: user.loginActivity || [] } });
});

const getUserStats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id).select('name email').lean();
  if (!user) return errorResponse(res, { statusCode: 404, message: 'User not found' });

  const [bookingCount, reviewCount] = await Promise.all([
    Booking.countDocuments({ userId: id }),
    Review.countDocuments({ user: id })
  ]);

  return successResponse(res, { message: 'User stats fetched', data: { user, bookingCount, reviewCount } });
});

const getUserBookings = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const bookings = await Booking.find({ userId: id }).populate('pgId', 'name city slug price images').lean();
  return successResponse(res, { message: 'User bookings fetched', data: bookings });
});

module.exports = { getAdminUsers, getAdminKycSubmissions, reviewUserKyc, getUserActivity, getUserStats, getUserBookings };