// ======================
// NEW PG METRICS & DEMAND ROUTES (With Redis Caching & Invalidation)
// ======================

// @desc    Increment view count for a PG
// @route   POST /api/pg/:id/increment-view
// @access  Public
router.post('/:id/increment-view', async (req, res, next) => {
  await pgController.incrementViewCount(req, res, next);
  if (res.statusCode === 200) {
    // Invalidate cache so updated view count reflects instantly
    await invalidateCache('etr_cache:*');
  }
});

// @desc    Get demand meter stats for a PG -> ⚡ Cached for 60 seconds
// @route   GET /api/pg/:id/demand-meter
// @access  Public
router.get('/:id/demand-meter', cacheMiddleware(60), pgController.getDemandMeter);

// @desc    Get popular PGs -> ⚡ Cached for 300 seconds (5 mins)
// @route   GET /api/pg/popular
// @access  Public
router.get('/popular', cacheMiddleware(300), pgController.getPopularPGs);

// @desc    Increment booking count (Admin only)
// @route   POST /api/pg/:id/increment-booking
// @access  Private/Admin
router.post('/:id/increment-booking', protect, adminOnly, async (req, res, next) => {
  await pgController.incrementBookingCount(req, res, next);
  if (res.statusCode === 200) {
    // Invalidate cache after booking count updates
    await invalidateCache('etr_cache:*');
  }
});