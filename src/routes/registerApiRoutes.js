function registerApiRoutes(app, routes) {
  const {
    pgRoutes,
    authRoutes,
    bookingRoutes,
    reviewRoutes,
    wishlistRoutes,
    locationRoutes,
    notificationRoutes,
    priceAlertRoutes,
    blogRoutes,
    paymentRoutes,
    advancedPaymentRoutes,
    recommendationRoutes,
    statsRoutes,
    userRoutes,
    adminRoutes,
    contactRoutes,
    profileRoutes,
  } = routes;

  app.use('/api/pg', pgRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/wishlist', wishlistRoutes);
  app.use('/api/locations', locationRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/price-alerts', priceAlertRoutes);
  app.use('/api/blogs', blogRoutes);
  app.use('/api/contact', contactRoutes);

  app.use('/api/payments', paymentRoutes);
  app.use('/api/paymentgateway', paymentRoutes);

  if (advancedPaymentRoutes) {
    app.use('/api/payments/advanced', advancedPaymentRoutes);
    app.use('/api/paymentgateway/advanced', advancedPaymentRoutes);
    console.log('✅ Advanced payment routes enabled');
  } else {
    console.log('⚠️ Advanced payment routes disabled');
  }

  app.use('/api/recommendations', recommendationRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/profile', profileRoutes);

  // Admin routes
  if (adminRoutes) {
    app.use('/api/admin', adminRoutes);
    console.log('✅ Admin routes enabled');
  } else {
    console.log('⚠️ Admin routes not available');
  }

  // Compatibility route
  app.use('/locations', locationRoutes);
}

module.exports = { registerApiRoutes };
