// backend/src/routes/locationRoutes.js
const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

// Public routes
router.get('/', locationController.getLocations);
router.get('/top', locationController.getTopLocations);
router.get('/popular', locationController.getPopularLocations);
router.get('/search', locationController.searchLocations);
router.get('/city/:city', locationController.getPGsByCity);
router.get('/:slug', locationController.getLocationBySlug);

// Placeholder/admin routes
router.post('/', locationController.createLocation);
router.put('/:id', locationController.updateLocationCounts);
router.post('/distance', locationController.calculateDistance);

module.exports = router;