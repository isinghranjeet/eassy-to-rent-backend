const express = require('express');
const mongoose = require('mongoose');

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

// 🆕 NEW ROUTES
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const statsRoutes = require('./routes/statsRoutes');
const userRoutes = require('./routes/userRoutes');
const { registerApiRoutes } = require('./routes/registerApiRoutes');
const { registerWebhookRoutes } = require('./routes/registerWebhookRoutes');

// ✅ Advanced payment routes with error handling
let advancedPaymentRoutes;
try {
  advancedPaymentRoutes = require('./routes/advancedPaymentRoutes');
  console.log('✅ Advanced payment routes loaded');
} catch (error) {
  console.warn('⚠️ Advanced payment routes not available:', error.message);
  advancedPaymentRoutes = null;
}

const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const cacheHeaders = require('./middleware/cacheHeaders');
const responseMiddleware = require('./middleware/responseMiddleware');
const logger = require('./utils/logger');
const { seedAllAdminData } = require('./utils/seedAdminData');

// Import cron jobs
require('./jobs/wishlistReminderJob');

const app = express();

// ======================
// TRUST PROXY
// ======================
app.set('trust proxy', 1);

// ======================
// DATABASE
// ======================
connectDB();

// Seed admin data once DB is connected
mongoose.connection.once('open', () => {
  seedAllAdminData();
});

// Centralized middleware setup
applySecurityMiddleware(app);
applyCors(app);

// ======================
// BODY PARSER with enhanced limits
// ======================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cacheHeaders);
app.use(responseMiddleware);

// ======================
// LOGGER
// ======================
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.originalUrl}`);
  next();
});

applyRateLimiters(app);

// ======================
// HEALTH ROUTES
// ======================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
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
// ROOT
// ======================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 PG Finder Backend Running',
    version: '2.0.0',
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
  paymentRoutes,
  advancedPaymentRoutes,
  recommendationRoutes,
  statsRoutes,
  userRoutes,
  adminRoutes,
});

registerWebhookRoutes(app, express);

// ======================
// ERROR HANDLING
// ======================
app.use(notFound);
app.use(errorHandler);

// ======================
// GRACEFUL SHUTDOWN
// ======================
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  const server = app.listen();
  server.close(() => {
    logger.info('HTTP server closed');
    if (mongoose.connection) {
      mongoose.connection.close(false, () => {
        logger.info('MongoDB connection closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

// ======================
// CRASH HANDLERS
// ======================
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app;