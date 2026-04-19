const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/database');
const pgRoutes = require('./routes/pg');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const reviewRoutes = require('./routes/reviews');
const wishlistRoutes = require('./routes/wishlistRoutes');
const locationRoutes = require('./routes/locationRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const priceAlertRoutes = require('./routes/priceAlertRoutes');
const blogRoutes = require('./routes/blogRoutes'); // ✅ ADD BLOG ROUTES

const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');

// ✅ Import cron jobs
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
// SECURITY
// ======================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ======================
// CORS
// ======================
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'https://eassy-to-rent-backend.onrender.com',
  'https://www.easytorent.in',
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
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.options('*', cors());

// ======================
// BODY PARSER
// ======================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

// ======================
// HEALTH ROUTES
// ======================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'OK',
    uptime: process.uptime(),
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'OK',
    uptime: process.uptime(),
  });
});

// ======================
// ROOT
// ======================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 PG Finder Backend Running',
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
app.use('/api/blogs', blogRoutes); // ✅ ADD BLOG ROUTES

// ======================
// ERROR HANDLING
// ======================
app.use(notFound);
app.use(errorHandler);

// ======================
// CRASH HANDLERS
// ======================
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
});

module.exports = app;