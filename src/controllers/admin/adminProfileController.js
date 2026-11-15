const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const { successResponse, errorResponse } = require('../../utils/response');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { sendOfferEmail } = require('../../services/notificationService');

const getAdminProfile = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized: User ID missing from token' });
  }

  const user = await User.findById(userId).select('-password -otp -otpExpires').lean();
  if (!user) return errorResponse(res, { statusCode: 404, message: 'Admin not found' });
  
  return successResponse(res, { message: 'Profile fetched', data: user });
});

const updateAdminProfile = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized: User ID missing from token' });
  }

  const { name, email, phone, bio } = req.body;
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email.toLowerCase().trim();
  if (phone !== undefined) updateData.phone = phone;
  if (bio !== undefined) updateData.bio = bio;

  const user = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true }).select('-password').lean();
  if (!user) return errorResponse(res, { statusCode: 404, message: 'Admin not found for update' });

  return successResponse(res, { message: 'Profile updated', data: user });
});

const updateAdminPassword = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized: User ID missing from token' });
  }

  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(userId);
  if (!user) return errorResponse(res, { statusCode: 404, message: 'Admin not found' });

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) return errorResponse(res, { statusCode: 401, message: 'Current password incorrect' });

  user.password = newPassword;
  await user.save();
  return successResponse(res, { message: 'Password updated successfully' });
});

const getAdminOwnActivity = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized: User ID missing from token' });
  }

  const limitVal = req.query.limit ? parseInt(req.query.limit, 10) : 50;
  const logs = await AuditLog.find({ userId }).sort({ createdAt: -1 }).limit(limitVal).lean();
  
  return successResponse(res, { message: 'Activity fetched', data: logs || [] });
});

const sendAdminOfferEmail = asyncHandler(async (req, res) => {
  const { userId, pgId, offerMessage, discount } = req.body;
  if (!userId || !pgId || !offerMessage) {
    return errorResponse(res, { statusCode: 400, message: 'Missing required fields for offer email' });
  }

  const sent = await sendOfferEmail(userId, pgId, offerMessage.trim(), discount ? parseFloat(discount) : null);
  if (!sent) return errorResponse(res, { statusCode: 500, message: 'Failed to send offer email.' });
  
  return successResponse(res, { message: 'Offer email sent successfully', data: { sent: true } });
});

module.exports = { 
  getAdminProfile, 
  updateAdminProfile, 
  updateAdminPassword, 
  getAdminOwnActivity, 
  sendAdminOfferEmail 
};