require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');

// ======================
// CONFIGURATION & UTILS
// ======================
const PORT = parseInt(process.env.PORT, 10) || 10000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ CRITICAL: MONGO_URI environment variable is missing');
  process.exit(1);
}

const { applyCors } = require('./config/corsConfig');
const { applyRateLimiters } = require('./config/rateLimiters');
const { logger, addCorrelationId } = require('./utils/logger');
const { seedAllAdminData } = require('./utils/seedAdminData');

// ✅ Initialize Redis In-Memory Client Connection on Boot
require('./config/redis');

// ======================
// ROUTE IMPORTS
// ======================
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
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const statsRoutes = require('./routes/statsRoutes');
const userRoutes = require('./routes/userRoutes');
const profileRoutes = require('./routes/profileRoutes');
const kycRoutes = require('./routes/kycRoutes'); 

// ✅ SaaS Feature Route Imports
const searchRoutes = require('./routes/searchRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const payoutRoutes = require('./routes/payoutRoutes');

const registerApiRoutes = require('./routes/registerApiRoutes');
const { registerWebhookRoutes } = require('./routes/registerWebhookRoutes');

const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const cacheHeaders = require('./middleware/cacheHeaders');
const responseMiddleware = require('./middleware/responseMiddleware');

// ======================
// CRON JOBS & WORKERS
// ======================
require('./jobs/wishlistReminderJob');
const { startBlogScheduler } = require('./jobs/blogSchedulerJob');
const { startBookingExpiryJob } = require('./jobs/bookingExpiryJob');
const { startDailyEngagementJob } = require('./jobs/dailyEngagementJob');

const app = express();
let server = null;

// ======================
// TRUST PROXY (for Render/Heroku)
// ======================
app.set('trust proxy', 1);

// ======================
// DATABASE CONNECTION
// ======================
const connectDB = async () => {
  try {
    const connOptions = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      retryWrites: true,
      retryReads: true,
      maxPoolSize: 10,
      minPoolSize: 2,
      bufferCommands: true,
    };

    await mongoose.connect(MONGO_URI, connOptions);
    
    logger.info('✅ MongoDB connected successfully', {
      host: mongoose.connection.host,
      database: mongoose.connection.name,
    });
    
    return true;
  } catch (err) {
    logger.error('❌ MongoDB Connection Error:', { message: err.message });
    return false;
  }
};

mongoose.connection.once('open', () => {
  logger.info('✅ MongoDB connection established, seeding admin data...');
  startBookingExpiryJob();
  startDailyEngagementJob();
  
  seedAllAdminData().catch(err => {
    logger.error('❌ Error seeding admin data:', err);
  });
});

// ======================
// SECURITY & CENTRALIZED MIDDLEWARE
// ======================
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

app.use(compression());
applyCors(app);

app.use(express.json({
  limit: '15mb',
  verify: (req, res, buffer) => {
    if (req.originalUrl === '/api/payments/webhook' || req.originalUrl === '/api/paymentgateway/webhook') {
      req.rawBody = Buffer.from(buffer);
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use(mongoSanitize());
app.use(xss());
app.use(hpp({ whitelist: ['price', 'rating', 'page', 'limit', 'sort'] }));

app.use(cacheHeaders);
app.use(responseMiddleware);
app.use(addCorrelationId);

// ======================
// LOGGING MIDDLEWARE
// ======================
app.use((req, res, next) => {
  const startTime = Date.now();
  logger.http(`${req.method} ${req.originalUrl}`, { ip: req.ip });
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      logger.warn(`Slow request: ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });
  next();
});

applyRateLimiters(app);

// ======================
// HEALTH CHECK & ROOT ROUTES
// ======================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: 'connected'
  });
});

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'OK', uptime: process.uptime() });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 EasyToRent Enterprise Backend Running with Redis',
    version: '2.1.0',
    features: {
      bookings: true,
      reviews: true,
      payments: true,
      recommendations: true,
      wishlist: true,
      priceAlerts: true,
      blogs: true,
      stats: true,
      notifications: true,
      kyc: true,
      search: true,
      maintenance: true,
      payouts: true,
      redisCaching: true
    }
  });
});

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
  searchRoutes,
  maintenanceRoutes,
  payoutRoutes,
});

app.use('/api/payments', paymentRoutes);
app.use('/api/admin/kyc', kycRoutes); 

registerWebhookRoutes(app, express);

// ======================
// ERROR HANDLING
// ======================
app.use(notFound);
app.use(errorHandler);

// ======================
// SERVER BOOTSTRAP & SHUTDOWN
// ======================
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`📥 ${signal} received - Starting graceful shutdown...`);
  
  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      logger.info('🛑 HTTP server closed');
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logger.info('🛑 MongoDB connection closed');
    }
    process.exit(0);
  } catch (err) {
    logger.error('❌ Shutdown error:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const bootstrap = async () => {
  logger.info('🔥 Initializing EasyToRent Enterprise Backend...');
  const dbConnected = await connectDB();
  
  if (!dbConnected) {
    logger.error('❌ Failed to connect to database - exiting...');
    process.exit(1);
  }
  
  server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    startBlogScheduler();
    startDailyEngagementJob();
  });

  server.timeout = 120000;
  server.keepAliveTimeout = 65000;
};

bootstrap().catch((err) => {
  logger.error('❌ Bootstrap failed:', err);
  process.exit(1);
});