require('dotenv').config();

const { startServer, closeServer } = require('./app');
const mongoose = require('mongoose');
const { logger } = require('./utils/logger');
const { startBlogScheduler } = require('./jobs/blogSchedulerJob');

// ======================
// CONFIGURATION
// ======================
const PORT = parseInt(process.env.PORT, 10) || 10000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGO_URI = process.env.MONGO_URI;

// ======================
// VALIDATE ENVIRONMENT
// ======================
if (!MONGO_URI) {
  logger.error('❌ CRITICAL: MONGO_URI environment variable is missing');
  process.exit(1);
}

// ======================
// DATABASE CONNECTION
// ======================
const connectDB = async () => {
  try {
    const connOptions = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true,
      retryReads: true,
      maxPoolSize: 10,
      minPoolSize: 2,
    };

    await mongoose.connect(MONGO_URI, connOptions);
    
    logger.info('✅ MongoDB connected successfully', {
      host: mongoose.connection.host,
      database: mongoose.connection.name,
      poolSize: mongoose.connection.pool?.size
    });
    
    return true;
  } catch (err) {
    logger.error('❌ MongoDB Connection Error:', {
      message: err.message,
      code: err.code,
      name: err.name
    });
    return false;
  }
};

// ======================
// GRACEFUL SHUTDOWN (PRODUCTION READY)
// ======================
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    logger.warn(`⚠️ ${signal} received but shutdown already in progress`);
    return;
  }
  
  isShuttingDown = true;
  logger.info(`📥 ${signal} received - Starting graceful shutdown...`);
  
  // Set timeout for force shutdown
  const forceShutdownTimeout = setTimeout(() => {
    logger.error('❌ Force shutdown timeout reached - exiting immediately');
    process.exit(1);
  }, 30000); // 30 seconds max
  
  try {
    // Close HTTP server first
    logger.info('🛑 Closing HTTP server...');
    await closeServer();
    logger.info('✅ HTTP server closed successfully');
    
    // Close MongoDB connection
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      logger.info('🛑 Closing MongoDB connection...');
      await mongoose.connection.close();
      logger.info('✅ MongoDB connection closed successfully');
    } else {
      logger.info('No active MongoDB connection to close');
    }
    
    // Clear force shutdown timeout
    clearTimeout(forceShutdownTimeout);
    
    logger.info('✅ Graceful shutdown completed successfully');
    process.exit(0);
    
  } catch (err) {
    logger.error('❌ Error during graceful shutdown:', {
      message: err.message,
      stack: err.stack
    });
    
    clearTimeout(forceShutdownTimeout);
    process.exit(1);
  }
};

// ======================
// ERROR HANDLERS
// ======================
const handleUnexpectedError = async (error, type) => {
  logger.error(`❌ ${type}:`, {
    message: error.message,
    stack: error.stack,
    name: error.name
  });
  
  // Attempt graceful shutdown
  await gracefulShutdown(type);
};

// Global error handlers
process.on('uncaughtException', (error) => {
  handleUnexpectedError(error, 'UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (error) => {
  handleUnexpectedError(error, 'UNHANDLED_REJECTION');
});

// Process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle cleanup on exit
process.on('exit', (code) => {
  logger.info(`Process exiting with code: ${code}`);
});

// ======================
// APPLICATION BOOTSTRAP
// ======================
const bootstrap = async () => {
  logger.info('🔥 Initializing PG Finder Backend...');
  logger.info(`📦 Node Version: ${process.version}`);
  logger.info(`🔧 Environment: ${NODE_ENV}`);
  logger.info(`🌍 Port: ${PORT}`);
  
  // Connect to Database
  const dbConnected = await connectDB();
  
  if (!dbConnected) {
    logger.error('❌ Failed to connect to database - exiting...');
    process.exit(1);
  }
  
  // Start HTTP Server
  try {
    const server = startServer(PORT);
    
    // Handle server errors
    server.on('error', (err) => {
      logger.error('❌ Server error:', err);
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
      }
    });
    
    logger.info('🚀 Server startup complete');
    logger.info(`📡 API available at: http://localhost:${PORT}`);
    
    // Start background jobs
    startBlogScheduler();
    
    // Log startup success with timestamp
    logger.info(`✅ Application started successfully at ${new Date().toISOString()}`);
    
  } catch (err) {
    logger.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

// ======================
// START THE APPLICATION
// ======================
bootstrap().catch((err) => {
  logger.error('❌ Bootstrap failed:', err);
  process.exit(1);
});

// ======================
// HEALTH MONITORING (Optional)
// ======================
if (NODE_ENV === 'production') {
  // Monitor memory usage
  setInterval(() => {
    const memoryUsage = process.memoryUsage();
    if (memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
      logger.warn('⚠️ High memory usage detected', {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
      });
    }
  }, 60000); // Check every minute
}