// backend/src/routes/locationRoutes.js
const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  getLocations,
  getPopularLocations,
  searchLocations,
  getLocationBySlug,
  filterPGsByLocation,
  calculateDistance,
  updateLocationCounts,
  createLocation
} = require('../controllers/locationController');

// Public routes
router.get('/', getLocations);
router.get('/popular', getPopularLocations);
router.get('/search', searchLocations);
router.get('/:slug', getLocationBySlug);

// Filter and distance
router.post('/filter-pgs', filterPGsByLocation);
router.post('/distance', calculateDistance);

// Admin only routes
router.post('/', protect, adminOnly, createLocation);
router.put('/update-counts', protect, adminOnly, updateLocationCounts);

module.exports = router;