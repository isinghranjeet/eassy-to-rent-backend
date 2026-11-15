// backend/src/routes/registerApiRoutes.js

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
    searchRoutes,
    maintenanceRoutes,
    payoutRoutes,
  } = routes;

  // Helper function to safely extract express router if wrapped in an object
  const getRouter = (routeModule) => {
    if (!routeModule) return null;
    if (typeof routeModule === 'function') return routeModule;
    if (routeModule.router && typeof routeModule.router === 'function') return routeModule.router;
    return null;
  };

  // Core public & user modular routes
  app.use('/api/pg', getRouter(pgRoutes));
  app.use('/api/auth', getRouter(authRoutes));
  app.use('/api/bookings', getRouter(bookingRoutes));
  app.use('/api/reviews', getRouter(reviewRoutes));
  app.use('/api/wishlist', getRouter(wishlistRoutes));
  app.use('/api/locations', getRouter(locationRoutes));
  app.use('/api/notifications', getRouter(notificationRoutes));
  app.use('/api/price-alerts', getRouter(priceAlertRoutes));
  app.use('/api/blogs', getRouter(blogRoutes));
  app.use('/api/contact', getRouter(contactRoutes));

  // Payment gateways & UPI routes
  app.use('/api/payments', getRouter(paymentRoutes));
  app.use('/api/paymentgateway', getRouter(paymentRoutes));

  const advRouter = getRouter(advancedPaymentRoutes);
  if (advRouter) {
    app.use('/api/payments/advanced', advRouter);
    app.use('/api/paymentgateway/advanced', advRouter);
    console.log('✅ Advanced payment routes enabled');
  } else {
    console.log('⚠️ Advanced payment routes disabled');
  }

  // Dashboard & user management routes
  app.use('/api/recommendations', getRouter(recommendationRoutes));
  app.use('/api/stats', getRouter(statsRoutes));
  app.use('/api/users', getRouter(userRoutes));
  app.use('/api/profile', getRouter(profileRoutes));

  // ✅ Safe SaaS feature routes registration
  const searchR = getRouter(searchRoutes);
  if (searchR) {
    app.use('/api/search', searchR);
    console.log('✅ Global Search / Command Palette routes enabled');
  }

  const maintR = getRouter(maintenanceRoutes);
  if (maintR) {
    app.use('/api/maintenance', maintR);
    console.log('✅ Maintenance Ticketing routes enabled');
  }

  const payoutR = getRouter(payoutRoutes);
  if (payoutR) {
    app.use('/api/payouts', payoutR);
    console.log('✅ Payout Ledger routes enabled');
  }

  // Admin routes
  const adminR = getRouter(adminRoutes);
  if (adminR) {
    app.use('/api/admin', adminR);
    console.log('✅ Admin routes enabled');
  } else {
    console.log('⚠️ Admin routes not available');
  }

  // Compatibility route fallback
  app.use('/locations', getRouter(locationRoutes));
}

module.exports = registerApiRoutes;