const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

// Mongoose Global Settings
mongoose.set('strictQuery', false);

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error('MONGO_URI is missing in environment variables');
    }

    const conn = await mongoose.connect(mongoURI, {
      // ----------------------------
      // Connection Pool
      // ----------------------------
      maxPoolSize: 100,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,

      // ----------------------------
      // Timeouts
      // ----------------------------
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 10000,

      // ----------------------------
      // Performance
      // ----------------------------
      bufferCommands: false,
      autoIndex: process.env.NODE_ENV !== 'production',

      // ----------------------------
      // Reliability
      // ----------------------------
      retryWrites: true,
      retryReads: true,
      w: 'majority',

      // ----------------------------
      // IMPORTANT
      // Transactions require PRIMARY
      // ----------------------------
      readPreference: 'primary'
    });

    logger.info('========================================');
    logger.info('MongoDB Connected Successfully');
    logger.info(`Host     : ${conn.connection.host}`);
    logger.info(`Database : ${conn.connection.name}`);
    logger.info('========================================');

    mongoose.connection.on('connected', () => {
      logger.info('MongoDB Connection Established');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB Reconnected');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB Disconnected');
    });

    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB Error: ${err.message}`);
    });

    return conn;
  } catch (err) {
    logger.error('========================================');
    logger.error('MongoDB Connection Failed');
    logger.error(err.message);
    logger.error('========================================');
    process.exit(1);
  }
};

// Graceful Shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Closing MongoDB connection...`);

  try {
    await mongoose.connection.close(false);
    logger.info('MongoDB connection closed successfully.');
    process.exit(0);
  } catch (err) {
    logger.error(`Error while closing MongoDB: ${err.message}`);
    process.exit(1);
  }
};

process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = connectDB;