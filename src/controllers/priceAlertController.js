const PriceAlert = require('../models/PriceAlert');
const PGListing = require('../models/PGListing');
const { sendPriceDropAlert } = require('../utils/sendEmail');
const { successResponse, errorResponse } = require('../utils/response');

// @desc    Create price alert
// @route   POST /api/price-alerts
// @access  Private
const createPriceAlert = async (req, res) => {
  try {
    const { pgId, desiredPrice } = req.body;
    
    if (!pgId || !desiredPrice) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'PG ID and desired price are required'
      });
    }
    
    const pg = await PGListing.findById(pgId);
    if (!pg) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'PG not found'
      });
    }
    
    // Check if alert already exists
    const existingAlert = await PriceAlert.findOne({
      user: req.user._id,
      pg: pgId,
      isActive: true
    });
    
    if (existingAlert) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'You already have an active price alert for this PG'
      });
    }
    
    const alert = await PriceAlert.create({
      user: req.user._id,
      pg: pgId,
      desiredPrice: desiredPrice,
      currentPrice: pg.price
    });
    
    successResponse(res, {
      statusCode: 201,
      message: 'Price alert created successfully',
      data: {
        _id: alert._id,
        pg: {
          _id: pg._id,
          name: pg.name,
          price: pg.price
        },
        desiredPrice: alert.desiredPrice,
        isActive: alert.isActive
      }
    });
  } catch (error) {
    console.error('Create price alert error:', error);
    errorResponse(res, {
      statusCode: 500,
      message: error.message
    });
  }
};

// @desc    Get user's price alerts
// @route   GET /api/price-alerts
// @access  Private
const getUserAlerts = async (req, res) => {
  try {
    const alerts = await PriceAlert.find({ 
      user: req.user._id, 
      isActive: true 
    }).populate('pg', 'name price images address slug');
    
    successResponse(res, {
      message: 'Price alerts fetched successfully',
      data: alerts
    });
  } catch (error) {
    console.error('Get user alerts error:', error);
    errorResponse(res, {
      statusCode: 500,
      message: error.message
    });
  }
};

// @desc    Delete price alert
// @route   DELETE /api/price-alerts/:id
// @access  Private
const deleteAlert = async (req, res) => {
  try {
    const alert = await PriceAlert.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!alert) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'Alert not found'
      });
    }
    
    successResponse(res, {
      message: 'Price alert deleted successfully'
    });
  } catch (error) {
    console.error('Delete alert error:', error);
    errorResponse(res, {
      statusCode: 500,
      message: error.message
    });
  }
};

// @desc    Check price drops (called when PG price is updated)
// @route   Internal function
const checkPriceDrops = async (pgId, newPrice) => {
  try {
    const alerts = await PriceAlert.find({
      pg: pgId,
      isActive: true,
      notified: false,
      desiredPrice: { $gte: newPrice }
    }).populate('user').populate('pg');
    
    let notifiedCount = 0;
    
    for (const alert of alerts) {
      const sent = await sendPriceDropAlert(alert.user, alert.pg, alert.currentPrice, newPrice);
      if (sent) {
        alert.notified = true;
        alert.isActive = false;
        await alert.save();
        notifiedCount++;
      }
    }
    
    console.log(`✅ Price drop notifications sent to ${notifiedCount} users for PG ${pgId}`);
    return notifiedCount;
  } catch (error) {
    console.error('Check price drops error:', error);
    return 0;
  }
};

module.exports = {
  createPriceAlert,
  getUserAlerts,
  deleteAlert,
  checkPriceDrops
};