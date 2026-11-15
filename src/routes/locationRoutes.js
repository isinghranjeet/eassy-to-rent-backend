// backend/src/routes/locationRoutes.js
const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ✅ Import Advanced Cache Middleware and Invalidation Helper
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');

// Public routes -> ⚡ Cached for lightning-fast search and browsing
router.get('/', cacheMiddleware(1800), locationController.getLocations);
router.get('/top', cacheMiddleware(1800), locationController.getTopLocations);
router.get('/popular', cacheMiddleware(1800), locationController.getPopularLocations);
router.get('/search', cacheMiddleware(600), locationController.searchLocations);
router.get('/sitemap-slugs', cacheMiddleware(3600), locationController.getSitemapSlugs);
router.get('/city/:city', cacheMiddleware(600), locationController.getPGsByCity);
router.post('/filter-pgs', locationController.filterPGsByLocation);
router.post('/distance', locationController.calculateDistance);
router.get('/:slug', cacheMiddleware(1800), locationController.getLocationBySlug);

// Location records and cached metadata are managed by administrators.
router.post('/', protect, adminOnly, async (req, res, next) => {
  await locationController.createLocation(req, res, next);
  if (res.statusCode === 201 || res.statusCode === 200) {
    await invalidateCache('etr_cache:*');
  }
});

router.put('/:id', protect, adminOnly, async (req, res, next) => {
  await locationController.updateLocationCounts(req, res, next);
  if (res.statusCode === 200) {
    await invalidateCache('etr_cache:*');
  }
});

module.exports = router;