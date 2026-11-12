// backend/src/routes/locationRoutes.js
const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Public routes
router.get('/', locationController.getLocations);
router.get('/top', locationController.getTopLocations);
router.get('/popular', locationController.getPopularLocations);
router.get('/search', locationController.searchLocations);
router.get('/sitemap-slugs', locationController.getSitemapSlugs);
router.get('/city/:city', locationController.getPGsByCity);
router.post('/filter-pgs', locationController.filterPGsByLocation);
router.post('/distance', locationController.calculateDistance);
router.get('/:slug', locationController.getLocationBySlug);

// Location records and cached metadata are managed by administrators.
router.post('/', protect, adminOnly, locationController.createLocation);
router.put('/:id', protect, adminOnly, locationController.updateLocationCounts);

module.exports = router;