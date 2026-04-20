require('dotenv').config();

const app = require('./app');
const mongoose = require('mongoose');
const logger = require('./utils/logger');

// ======================
// PORT
// ======================
const PORT = process.env.PORT || 10000;

// ======================
// DB CONNECTION
// ======================
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      logger.error('❌ MONGO_URI is missing');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);

    logger.info('✅ MongoDB connected');
    return true;
  } catch (err) {
    logger.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

// ======================
// START SERVER
// ======================
const startServer = () => {
  console.log("🚀 START SERVER FUNCTION CALLED");

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    logger.info(`🚀 Server running on port ${PORT}`);
  });

  // ======================
  // GRACEFUL SHUTDOWN (FIXED)
  // ======================
  const shutdown = async (signal) => {
    logger.info(`📥 ${signal} received`);

    server.close(() => {
      logger.info('🛑 HTTP server closed');
    });

    // FIXED: Use async/await instead of callback
    try {
      await mongoose.connection.close(false);
      logger.info('🛑 MongoDB connection closed');
    } catch (err) {
      logger.error('❌ Error closing MongoDB connection:', err.message);
    }

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('uncaughtException', async (err) => {
    logger.error('❌ Uncaught Exception:', err.message);
    await shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', async (err) => {
    logger.error('❌ Unhandled Rejection:', err.message);
    await shutdown('UNHANDLED_REJECTION');
  });
};

// ======================
// INIT FLOW (FIXED)
// ======================
(async () => {
  console.log("🔥 INIT SERVER STARTING...");

  const dbConnected = await connectDB();

  if (dbConnected) {
    console.log("🔥 DB CONNECTED → STARTING SERVER...");
    startServer();
  } else {
    console.log("❌ DB NOT CONNECTED");
  }
})();

module.exports = app;