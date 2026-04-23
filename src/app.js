const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const mongoose = require('mongoose');

const connectDB = require('./config/database');
const pgRoutes = require('./routes/pg');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const reviewRoutes = require('./routes/reviews');
const wishlistRoutes = require('./routes/wishlistRoutes');
const locationRoutes = require('./routes/locationRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const priceAlertRoutes = require('./routes/priceAlertRoutes');
const blogRoutes = require('./routes/blogRoutes');

// 🆕 NEW ROUTES
const paymentRoutes = require('./routes/paymentRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const statsRoutes = require('./routes/statsRoutes');
const userRoutes = require('./routes/userRoutes');

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
const logger = require('./utils/logger');

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

// ======================
// SECURITY MIDDLEWARE
// ======================

// Compression
app.use(compression());

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://checkout.razorpay.com', 'https://js.stripe.com'],
        frameSrc: ["'self'", 'https://checkout.razorpay.com', 'https://hooks.stripe.com'],
        connectSrc: ["'self'", 'https://api.razorpay.com', 'https://api.stripe.com'],
        imgSrc: ["'self'", 'data:', 'https://*.razorpay.com'],
      },
    },
  })
);

// Data Sanitization against NoSQL injection
app.use(mongoSanitize());

// Data Sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp());

// ======================
// CORS CONFIGURATION
// ======================
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:10000',
  'https://eassy-to-rent-backend.onrender.com',
  'https://www.easytorent.in',
  'https://eassytorent.in',
  'https://eassy-to-rent-startup.vercel.app',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV === 'development'
      ) {
        return callback(null, true);
      }

      logger.warn(`❌ CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Payment-Token'],
    exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  })
);

app.options('*', cors());

// ======================
// BODY PARSER with enhanced limits
// ======================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ======================
// LOGGER
// ======================
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.originalUrl}`);
  next();
});

// ======================
// RATE LIMITERS
// ======================

// Global limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});
app.use(globalLimiter);

// Auth limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts, try again later',
  },
  skipSuccessfulRequests: true,
});
app.use('/api/auth', authLimiter);

// ✅ Payment limiter (stricter)
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many payment attempts, please try again later',
  },
});
app.use('/api/payments', paymentLimiter);

// ✅ API limiter for sensitive endpoints
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

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

// ======================
// API ROUTES
// ======================
app.use('/api/pg', pgRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/price-alerts', priceAlertRoutes);
app.use('/api/blogs', blogRoutes);

// 🆕 PAYMENT ROUTES
app.use('/api/payments', paymentRoutes);

// ✅ Advanced payment routes (only if loaded successfully)
if (advancedPaymentRoutes) {
  app.use('/api/payments/advanced', advancedPaymentRoutes);
  console.log('✅ Advanced payment routes enabled');
} else {
  console.log('⚠️ Advanced payment routes disabled');
}

// 🆕 OTHER ROUTES
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', userRoutes);

// ✅ FIX: Also add routes without /api prefix for compatibility
app.use('/locations', locationRoutes);

// ======================
// WEBHOOK ROUTES (No body parser for raw body)
// ======================
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  // Handle webhook from payment gateway
  const signature = req.headers['x-razorpay-signature'];
  // Process webhook (implement in controller)
  console.log('Webhook received:', req.body);
  res.json({ success: true });
});

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