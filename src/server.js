require('dotenv').config();

const app = require('./app');
const mongoose = require('mongoose');
const logger = require('./utils/logger');

// ─────────── PORT (FIXED) ───────────
const PORT = process.env.PORT || 10000;

// ─────────── MongoDB Connection (FIXED) ───────────
const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    logger.error('❌ MONGO_URI is missing');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info('✅ MongoDB connected');
  } catch (err) {
    logger.error('❌ MongoDB Error:', err.message);
    process.exit(1);
  }
};

// ─────────── START SERVER ───────────
const startServer = () => {
  const server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    logger.info(`📥 ${signal} received`);

    server.close(() => {
      logger.info('🛑 Server closed');
      mongoose.connection.close(false, () => {
        logger.info('🛑 DB closed');
        process.exit(0);
      });
    });

    setTimeout(() => {
      logger.error('⚠️ Force shutdown');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('uncaughtException', (err) => {
    logger.error(`❌ Uncaught: ${err.message}`);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (err) => {
    logger.error(`❌ Rejection: ${err.message}`);
    shutdown('UNHANDLED_REJECTION');
  });
};

// ─────────── INIT ───────────
connectDB().then(startServer);

module.exports = app;
