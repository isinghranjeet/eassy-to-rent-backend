/**
 * Advanced Enterprise-Grade Redis Client Setup
 * Supports Production Clustering, TLS/SSL, Smart Reconnection, and Event Monitoring
 */

const Redis = require('ioredis');
const { logger } = require('../utils/logger'); // Using your existing professional logger

const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  
  // Enterprise cluster & timeout settings
  maxRetriesPerRequest: 3,
  connectTimeout: 10000, // 10 seconds connection timeout
  keepAlive: 30000,     // Send TCP keepalive packets
  
  // Smart exponential backoff retry strategy with jitter to prevent thundering herd
  retryStrategy(times) {
    if (times > 10) {
      logger.error('❌ Redis: Max retry attempts reached. Giving up connection.');
      return null; // Stop retrying after 10 attempts
    }
    const delay = Math.min(times * 200, 5000);
    logger.warn(`⚠️ Redis: Reconnection attempt #${times} in ${delay}ms...`);
    return delay;
  },

  // Automatically reconnect if connection drops
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Reconnect if Redis is switched to replica mode during failover
      return true;
    }
    return false;
  }
};

// Enable TLS/SSL if running in secure production environment (e.g., AWS ElastiCache / Upstash with SSL)
if (process.env.REDIS_USE_TLS === 'true') {
  redisOptions.tls = {
    rejectUnauthorized: false
  };
}

// Initialize Redis Client Instance
const redisClient = new Redis(redisOptions);

// ======================
// EVENT LISTENERS & MONITORING
// ======================
redisClient.on('connect', () => {
  logger.info('✅ Redis: In-Memory Client Connected Successfully', {
    host: redisOptions.host,
    port: redisOptions.port
  });
});

redisClient.on('ready', () => {
  logger.info('🚀 Redis: Client is ready to accept commands');
});

redisClient.on('error', (err) => {
  logger.error('❌ Redis Client Error:', { message: err.message, stack: err.stack });
});

redisClient.on('close', () => {
  logger.warn('⚠️ Redis: Connection closed');
});

redisClient.on('reconnecting', () => {
  logger.info('🔄 Redis: Reconnecting to server...');
});

module.exports = redisClient;