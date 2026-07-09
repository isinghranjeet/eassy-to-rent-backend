// const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

mongoose.set('strictQuery', false);

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error('MONGO_URI is missing in environment variables');
    }

    const options = {
      // Connection Pool
      maxPoolSize: 100,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,

      // Timeouts
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 10000,

      // Performance
      bufferCommands: false,
      autoIndex: process.env.NODE_ENV !== 'production',

      // Reliability
      retryWrites: true,
      retryReads: true,
      w: 'majority',

      // IMPORTANT:
      // Transactions require PRIMARY
      // Never use primaryPreferred here
      readPreference: 'primary'
    };

    const conn = await mongoose.connect(mongoURI, options);

    const db = mongoose.connection;

    db.once('open', () => {
      logger.info(`✅ MongoDB Connected`);
      logger.info(`Host : ${db.host}`);
      logger.info(`Database : ${db.name}`);
    });

    db.on('reconnected', () => {
      logger.info('🔄 MongoDB Reconnected');
    });

    db.on('disconnected', () => {
      logger.warn('⚠ MongoDB Disconnected');
    });

    db.on('error', (err) => {
      logger.error(`MongoDB Error: ${err.message}`);
    });

    return conn;
  } catch (err) {
    logger.error(`MongoDB Connection Failed: ${err.message}`);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  logger.info(`${signal} received. Closing MongoDB connection...`);

  try {
    await mongoose.connection.close(false);
    logger.info('MongoDB connection closed successfully.');
    process.exit(0);
  } catch (err) {
    logger.error(`Error closing MongoDB: ${err.message}`);
    process.exit(1);
  }
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

module.exports = connectDB;