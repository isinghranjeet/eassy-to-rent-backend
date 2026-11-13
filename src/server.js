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
      bufferCommands: true, // ✅ FIX: Allows commands to buffer until connection is fully established (prevents cold start 500 crashes)
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
  if (isShuttingDown) {
    logger.warn(`⚠️ ${signal} received but shutdown already in progress`);
    return;
  }
  
  isShuttingDown = true;
  logger.info(`📥 ${signal} received - Starting graceful shutdown...`);
  
  const forceShutdownTimeout = setTimeout(() => {
    logger.error('❌ Force shutdown timeout reached - exiting immediately');
    process.exit(1);
  }, 30000);
  
  try {
    logger.info('🛑 Closing HTTP server...');
    await closeServer();
    logger.info('✅ HTTP server closed successfully');
    
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      logger.info('🛑 Closing MongoDB connection...');
      await mongoose.connection.close();
      logger.info('✅ MongoDB connection closed successfully');
    } else {
      logger.info('No active MongoDB connection to close');
    }
    
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
  await gracefulShutdown(type);
};

process.on('uncaughtException', (error) => {
  handleUnexpectedError(error, 'UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (error) => {
  handleUnexpectedError(error, 'UNHANDLED_REJECTION');
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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
  
  const dbConnected = await connectDB();
  
  if (!dbConnected) {
    logger.error('❌ Failed to connect to database - exiting...');
    process.exit(1);
  }
  
  try {
    const server = startServer(PORT);
    
    server.on('error', (err) => {
      logger.error('❌ Server error:', err);
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
      }
    });
    
    logger.info('🚀 Server startup complete');
    logger.info(`📡 API available at: http://localhost:${PORT}`);
    
    startBlogScheduler();
    
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
// HEALTH MONITORING
// ======================
if (NODE_ENV === 'production') {
  setInterval(() => {
    const memoryUsage = process.memoryUsage();
    if (memoryUsage.heapUsed > 500 * 1024 * 1024) {
      logger.warn('⚠️ High memory usage detected', {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
      });
    }
  }, 60000);
}