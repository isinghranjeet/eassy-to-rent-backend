const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/database');
const { applySecurityMiddleware } = require('./config/securityMiddleware');
const { applyCors } = require('./config/corsConfig');
const { applyRateLimiters } = require('./config/rateLimiters');
const pgRoutes = require('./routes/pg');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookingRoutes');
const reviewRoutes = require('./routes/reviews');
const wishlistRoutes = require('./routes/wishlistRoutes');
const locationRoutes = require('./routes/locationRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const priceAlertRoutes = require('./routes/priceAlertRoutes');
const blogRoutes = require('./routes/blogRoutes');
const contactRoutes = require('./routes/contactRoutes');

// NEW ROUTES
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const statsRoutes = require('./routes/statsRoutes');
const userRoutes = require('./routes/userRoutes');
const profileRoutes = require('./routes/profileRoutes');
const { registerApiRoutes } = require('./routes/registerApiRoutes');
const { registerWebhookRoutes } = require('./routes/registerWebhookRoutes');

// Skip advanced payment routes to prevent crashes
let advancedPaymentRoutes = null;

const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const cacheHeaders = require('./middleware/cacheHeaders');
const responseMiddleware = require('./middleware/responseMiddleware');
const { logger, addCorrelationId } = require('./utils/logger');
const { seedAllAdminData } = require('./utils/seedAdminData');

// Import cron jobs
require('./jobs/wishlistReminderJob');
const { startBlogScheduler } = require('./jobs/blogSchedulerJob');

const app = express();
let server = null;

// ======================
// TRUST PROXY (for Render/Heroku)
// ======================
app.set('trust proxy', 1);

// ======================
// DATABASE CONNECTION
// ======================
connectDB();

// Seed admin data once DB is connected
mongoose.connection.once('open', () => {
  logger.info('✅ MongoDB connection established, seeding admin data...');
  seedAllAdminData().catch(err => {
    logger.error('❌ Error seeding admin data:', err);
  });
});

// Handle MongoDB connection errors after initial connection
mongoose.connection.on('error', (err) => {
  logger.error('❌ MongoDB connection error after init:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ MongoDB disconnected');
});

// ======================
// CENTRALIZED MIDDLEWARE
// ======================
// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Compression
app.use(compression());

// CORS
applyCors(app);

// Body parsing with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
  whitelist: ['price', 'rating', 'page', 'limit', 'sort']
}));

// Custom middleware
app.use(cacheHeaders);
app.use(responseMiddleware);
app.use(addCorrelationId);

// ======================
// LOGGING MIDDLEWARE
// ======================
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.http(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    correlationId: req.correlationId
  });
  
  // Log response time
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (duration > 1000) { // Log slow requests (>1s)
      logger.warn(`Slow request: ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });
  
  next();
});

// Apply rate limiters
applyRateLimiters(app);

// ======================
// HEALTH CHECK ROUTES
// ======================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    memory: process.memoryUsage(),
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ======================
// ROOT ROUTE
// ======================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 PG Finder Backend Running',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    features: {
      bookings: true,
      reviews: true,
      payments: true,
      recommendations: true,
      wishlist: true,
      priceAlerts: true,
      blogs: true,
      stats: true,
      notifications: true
    },
    paymentGateways: {
      razorpay: true,
      stripe: false,
    }
  });
});

// ======================
// DEBUG ROUTES (only in development)
// ======================
if (process.env.NODE_ENV === 'development') {
  app.get('/api/debug/routes', (req, res) => {
    const routes = [];
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        routes.push({
          path: middleware.route.path,
          methods: Object.keys(middleware.route.methods).map(m => m.toUpperCase())
        });
      } else if (middleware.name === 'router') {
        middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            routes.push({
              path: handler.route.path,
              methods: Object.keys(handler.route.methods).map(m => m.toUpperCase())
            });
          }
        });
      }
    });
    res.json({ 
      count: routes.length, 
      routes: routes.sort((a, b) => a.path.localeCompare(b.path))
    });
  });
}

// ======================
// API ROUTES REGISTRATION
// ======================
registerApiRoutes(app, {
  pgRoutes,
  authRoutes,
  bookingRoutes,
  reviewRoutes,
  wishlistRoutes,
  locationRoutes,
  notificationRoutes,
  priceAlertRoutes,
  blogRoutes,
  contactRoutes,
  paymentRoutes,
  recommendationRoutes,
  statsRoutes,
  userRoutes,
  adminRoutes,
  profileRoutes,
});

registerWebhookRoutes(app, express);

// ======================
// ERROR HANDLING MIDDLEWARE
// ======================
app.use(notFound);
app.use(errorHandler);

// ======================
// EXPORT APP AND START FUNCTION
// ======================
const startServer = (port) => {
  server = app.listen(port, () => {
    logger.info(`🚀 Server running on port ${port}`);
    logger.info(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`💾 MongoDB Status: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
  });
  
  server.timeout = 120000; // 2 minutes timeout
  server.keepAliveTimeout = 65000; // 65 seconds keep-alive
  
  return server;
};

const closeServer = async () => {
  if (server) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
    logger.info('🛑 HTTP server closed');
  }
};

module.exports = { app, startServer, closeServer };