// Add these with other routes
router.post('/:id/increment-view', pgController.incrementViewCount);
router.get('/:id/demand-meter', pgController.getDemandMeter);
router.get('/popular', pgController.getPopularPGs);
router.post('/:id/increment-booking', protect, adminOnly, pgController.incrementBookingCount);