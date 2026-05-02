// ✅ OPTIMIZED: In-memory cache service for 10k+ users
const NodeCache = require('node-cache');
const logger = require('../utils/logger');

// Cache configuration
const CACHE_CONFIG = {
  stdTTL: 300,           // 5 minutes default
  checkperiod: 60,      // Cleanup every 60s
  maxKeys: 10000,       // Max keys in memory
  useClones: false,     // Disable clones for performance
};

// Cache TTL presets
const CACHE_TTL = {
  pg_listing: 900,       // 15 minutes for PG listings
  pg_detail: 1800,      // 30 minutes for PG detail
  search_results: 600,   // 10 minutes for search
  user_profile: 1800,    // 30 minutes for user profile
  analytics: 300,       // 5 minutes for analytics
  stats: 300,           // 5 minutes for stats
  featured_pgs: 600,   // 10 minutes for featured
  locations: 3600,      // 1 hour for locations
};

// Create cache instance
const cache = new NodeCache(CACHE_CONFIG);

// Cache statistics
let cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0,
};

// Get wrapper with statistics
const get = (key) => {
  try {
    const value = cache.get(key);
    if (value !== undefined) {
      cacheStats.hits++;
      return value;
    }
    cacheStats.misses++;
    return null;
  } catch (error) {
    cacheStats.errors++;
    logger.error('Cache get error:', error.message);
    return null;
  }
};

// Set wrapper with TTL preset
const set = (key, value, ttlPreset = null) => {
  try {
    const ttl = ttlPreset ? CACHE_TTL[ttlPreset] : CACHE_CONFIG.stdTTL;
    const success = cache.set(key, value, ttl);
    if (success) cacheStats.sets++;
    return success;
  } catch (error) {
    cacheStats.errors++;
    logger.error('Cache set error:', error.message);
    return false;
  }
};

// Delete wrapper
const del = (key) => {
  try {
    const count = cache.del(key);
    if (count > 0) cacheStats.deletes++;
    return count;
  } catch (error) {
    cacheStats.errors++;
    logger.error('Cache delete error:', error.message);
    return 0;
  }
};

// Check if key exists
const has = (key) => {
  try {
    return cache.has(key);
  } catch (error) {
    return false;
  }
};

// Get multiple keys at once
const mget = (keys) => {
  try {
    return cache.mget(keys);
  } catch (error) {
    cacheStats.errors++;
    return {};
  }
};

// Delete by pattern
const deletePattern = (pattern) => {
  try {
    const keys = cache.keys();
    const matchedKeys = keys.filter(key => key.match(pattern));
    let deletedCount = 0;
    for (const key of matchedKeys) {
      deletedCount += cache.del(key);
    }
    return deletedCount;
  } catch (error) {
    logger.error('Cache delete pattern error:', error.message);
    return 0;
  }
};

// Invalidate cache for a specific PG
const invalidatePG = (pgId) => {
  const patterns = [
    new RegExp(`^pg_(${pgId}|list|featured|popular)`),
    new RegExp(`^search_`),
    new RegExp(`^location_`),
  ];
  
  let deletedCount = 0;
  for (const pattern of patterns) {
    deletedCount += deletePattern(pattern);
  }
  
  return deletedCount;
};

// Invalidate all PG-related cache
const invalidateAllPG = () => {
  const patterns = [
    /^pg_/,
    /^search_/,
    /^location_/,
    /^featured_/,
    /^popular_/,
  ];
  
  let deletedCount = 0;
  for (const pattern of patterns) {
    deletedCount += deletePattern(pattern);
  }
  
  return deletedCount;
};

// Get cache statistics
const getStats = () => {
  const keys = cache.keys();
  return {
    ...cacheStats,
    keys: keys.length,
    hitsPerMinute: cacheStats.hits / 5,
    hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0,
  };
};

// Reset statistics
const resetStats = () => {
  cacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };
};

// Middleware for Express to add caching headers
const cacheMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const cacheControl = req.method === 'GET' && res.statusCode === 200
      ? 'public, max-age=300'
      : 'no-store, no-cache';
    res.set('Cache-Control', cacheControl);
    res.set('X-Response-Time', `${duration}ms`);
  });
  
  next();
};

// Health check
const healthCheck = () => {
  const keys = cache.keys();
  return {
    status: 'healthy',
    keys: keys.length,
    maxKeys: CACHE_CONFIG.maxKeys,
    hitRate: getStats().hitRate,
  };
};

// Initialize
logger.info('✅ In-memory cache service initialized');
logger.info(`   Max keys: ${CACHE_CONFIG.maxKeys}, TTL: ${CACHE_CONFIG.stdTTL}s`);

module.exports = {
  cache,
  CACHE_TTL,
  get,
  set,
  del,
  has,
  mget,
  deletePattern,
  invalidatePG,
  invalidateAllPG,
  getStats,
  resetStats,
  cacheMiddleware,
  healthCheck,
};
