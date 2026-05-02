const ContactLog = require('../models/ContactLog');
const PGListing = require('../models/PGListing');
const CallCredit = require('../models/CallCredit');
const { asyncHandler } = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');

// @desc    Initiate a contact (call or whatsapp) - requires auth
// @route   POST /api/contact/initiate
// @access  Private
const initiateContact = asyncHandler(async (req, res) => {
  const { pgId, type } = req.body;
  const userId = req.user._id;

  if (!pgId || !type) {
    throw new AppError('PG ID and contact type are required', 400);
  }

  if (!['call', 'whatsapp'].includes(type)) {
    throw new AppError('Invalid contact type. Must be "call" or "whatsapp"', 400);
  }

  // Get PG details
  const pg = await PGListing.findById(pgId);
  if (!pg) {
    throw new AppError('PG listing not found', 404);
  }

  const contactNumber = pg.ownerPhone || pg.contactPhone || process.env.SUPPORT_PHONE || '9315058665';

  // Check contact credits (optional - only if you want to enforce credit system)
  // For now, we'll just log the contact without requiring credits
  // Uncomment below to enforce credit-based contact
  /*
  const credit = await CallCredit.getOrCreate(userId);
  if (!credit.hasEnoughCredits(1)) {
    throw new AppError('Insufficient contact credits. Please purchase credits to contact the owner.', 403);
  }
  await credit.useCredits(1, pgId, type);
  */

  // Log the contact attempt
  await ContactLog.create({
    userId,
    pgId,
    type,
    contactNumber,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Prepare response data
  const message = type === 'whatsapp'
    ? encodeURIComponent(
        `Hello,\n\nI'm interested in "${pg.name}" on EasyTorent.\n` +
        `📍 Price: ₹${pg.price?.toLocaleString()}/month\n` +
        `📍 Location: ${pg.locality}, ${pg.city}\n` +
        `📍 Type: ${pg.type}\n\n` +
        `Could you please share more details about availability and amenities?\n\n` +
        `Thanks!`
      )
    : null;

  res.status(200).json({
    success: true,
    message: `Contact initiated successfully`,
    data: {
      allowed: true,
      contactNumber,
      type,
      pgName: pg.name,
      whatsappUrl: type === 'whatsapp'
        ? `https://wa.me/91${contactNumber.replace(/\D/g, '')}?text=${message}`
        : null,
      callUrl: type === 'call' ? `tel:${contactNumber}` : null
    }
  });
});

// @desc    Get user's contact history
// @route   GET /api/contact/history
// @access  Private
const getContactHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const history = await ContactLog.find({ userId })
    .populate('pgId', 'name city locality price images')
    .sort({ createdAt: -1 })
    .limit(50);

  res.status(200).json({
    success: true,
    data: history
  });
});

module.exports = {
  initiateContact,
  getContactHistory
};

