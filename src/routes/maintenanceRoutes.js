const express = require('express');
const router = express.Router();
const MaintenanceTicket = require('../models/MaintenanceTicket');

// ✅ Import Advanced Cache Middleware and Invalidation Helper
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');

// @desc    Get all maintenance tickets -> ⚡ Cached for 120 seconds
// @route   GET /api/maintenance-tickets
// @access  Public/Protected based on setup
router.get('/', cacheMiddleware(120), async (req, res, next) => {
  try {
    const tickets = await MaintenanceTicket.find({}).sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      message: 'Maintenance tickets fetched successfully',
      data: tickets
    });
  } catch (error) {
    return next(error);
  }
});

// @desc    Create new maintenance ticket
// @route   POST /api/maintenance-tickets
// @access  Public/Protected
router.post('/', async (req, res, next) => {
  try {
    const { tenantId, pgId, issueType, description, priority } = req.body;
    const ticket = await MaintenanceTicket.create({
      tenantId,
      pgId,
      issueType,
      description,
      priority: priority || 'Medium'
    });

    // 🧹 Invalidate Cache on New Ticket Creation
    await invalidateCache('etr_cache:*');

    return res.status(201).json({
      success: true,
      message: 'Maintenance ticket created successfully',
      data: ticket
    });
  } catch (error) {
    return next(error);
  }
});

// ✅ CRITICAL: Must export router function
module.exports = router;