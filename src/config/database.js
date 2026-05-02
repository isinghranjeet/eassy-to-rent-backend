const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

// ✅ OPTIMIZED: Enhanced MongoDB connection with better handling for 10k+ users
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      logger.error('MONGO_URI is missing in environment variables');
      process.exit(1);
    }

    // ✅ OPTIMIZED: Connection options for 10k+ users
    const options = {
      maxPoolSize: 100, // ✅ Increased: 10 -> 100 for 10k+ users
      minPoolSize: 10, // ✅ Increased: 2 -> 10 connections
      serverSelectionTimeoutMS: 10000, // ✅ Increased: 5 -> 10 seconds
      socketTimeoutMS: 60000, // ✅ Increased: 45 -> 60 seconds
      bufferCommands: false, // Disable mongoose buffering
      retryWrites: true, // Retry failed writes
      retryReads: true, // Retry failed reads
      w: 'majority', // ✅ Write to majority for safety
      journal: true, // ✅ Enable journaling
      readPreference: 'primaryPreferred', // ✅ Read from primary
    };

    // ✅ OPTIMIZED: Set mongoose options globally
    mongoose.set('strictQuery', false);

    const conn = await mongoose.connect(mongoURI, options);

    // ✅ NEW: Connection event listeners
    mongoose.connection.on('connected', () => {
      logger.info(`MongoDB connected: ${conn.connection.host}`);
    });

    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

// ✅ NEW: Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, closing MongoDB connection...`);
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (err) {
    logger.error(`Error closing MongoDB: ${err.message}`);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = connectDB;
