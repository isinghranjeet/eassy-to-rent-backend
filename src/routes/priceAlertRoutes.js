const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createPriceAlert,
  getUserAlerts,
  deleteAlert
} = require('../controllers/priceAlertController');

// All routes require authentication
router.use(protect);

// Create price alert
router.post('/', createPriceAlert);

// Get user's price alerts
router.get('/', getUserAlerts);

// Delete price alert
router.delete('/:id', deleteAlert);

module.exports = router;