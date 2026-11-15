const Redis = require('ioredis');

// Initialize Redis client using environment variables (Upstash Cloud Redis)
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_USE_TLS === 'true' ? {} : undefined,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    console.log(`] ⚠️ Redis: Reconnection attempt #${times} in ${delay}ms...`, { service: 'pg-finder-backend' });
    return delay;
  },
});

redis.on('connect', () => {
  console.log(`] ✅ Redis: In-Memory Client Connected Successfully`, { 
    service: 'pg-finder-backend', 
    host: process.env.REDIS_HOST, 
    port: process.env.REDIS_PORT 
  });
});

redis.on('ready', () => {
  console.log(`] 🚀 Redis: Client is ready to accept commands`, { service: 'pg-finder-backend' });
});

redis.on('error', (err) => {
  console.error(`] ❌ Redis Client Error: ${err.message}`, { service: 'pg-finder-backend', stack: err.stack });
});

// 1. Cache Middleware for GET requests
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `etr_cache:${req.originalUrl || req.url}`;

    try {
      const cachedData = await redis.get(key);
      if (cachedData) {
        console.log(`] ⚡ [Cache Hit] Serving from Redis: ${key}`, { service: 'pg-finder-backend' });
        return res.json(JSON.parse(cachedData));
      }

      console.log(`] 🐢 [Cache Miss] Fetching from MongoDB: ${key}`, { service: 'pg-finder-backend' });

      const originalJson = res.json.bind(res);
      res.json = async (body) => {
        try {
          if (res.statusCode === 200) {
            await redis.setex(key, duration, JSON.stringify(body));
          }
        } catch (cacheErr) {
          console.error('Redis Cache Write Error:', cacheErr.message);
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.error('Redis Middleware Error:', err.message);
      next();
    }
  };
};

// 2. Helper to invalidate cache when data is modified (POST, PUT, DELETE, PATCH)
const invalidateCache = async (pattern = 'etr_cache:*') => {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
      console.log(`] 🧹 [Cache Cleared] Deleted ${keys.length} cached keys matching pattern: ${pattern}`, { service: 'pg-finder-backend' });
    }
  } catch (err) {
    console.error('Redis Invalidation Error:', err.message);
  }
};

module.exports = {
  redis,
  cacheMiddleware,
  invalidateCache,
};