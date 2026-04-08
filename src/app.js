const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const pgRoutes = require('./routes/pg');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const reviewRoutes = require('./routes/reviews');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');

const app = express();

// 🔥 Trust proxy (IMPORTANT for Render)
app.set('trust proxy', 1);

// ❌ DO NOT CONNECT DB HERE
// connectDB(); ❌

// 🔐 Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ─────────── ✅ CORS CONFIG (FINAL) ───────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'https://eassy-to-rent-backend.onrender.com',
  'https://www.easytorent.in',
  'https://easytorent.in',
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (
      allowedOrigins.includes(origin) ||
      (origin && origin.includes('easytorent.in'))
    ) {
      callback(null, true);
    } else {
      logger.warn(`❌ CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ─────────── BODY PARSER ───────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─────────── LOGGER ───────────
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.originalUrl}`, {
    origin: req.headers.origin,
    ip: req.ip,
  });
  next();
});

// ─────────── RATE LIMITERS ───────────

// 🌍 Global limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(globalLimiter);

// 🔐 Auth limiter
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

// 📱 OTP limiter
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: 'Wait 60 seconds before next OTP',
  },
});
app.use('/api/auth/login', otpLimiter);

// ─────────── ✅ ROOT ROUTE (IMPORTANT FIX) ───────────
app.get('/', (req, res) => {
  res.send('🚀 Backend is running successfully');
});

// ─────────── HEALTH ROUTES ───────────
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

// ─────────── ROUTES ───────────
app.use('/api/pg', pgRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);

// ─────────── 404 HANDLER ───────────
app.use(notFound);

// ─────────── ERROR HANDLER ───────────
app.use(errorHandler);

// ─────────── GLOBAL ERROR LOGGING ───────────
process.on('unhandledRejection', (err) => {
  logger.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  logger.error('❌ Uncaught Exception:', err);
});

module.exports = app;