/**
 * Central API Constants
 * Single source of truth for all API limits, configs, and settings
 */

module.exports = {
  // ======================
  // PAGINATION LIMITS
  // ======================
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
    MIN_LIMIT: 1,
  },

  // ======================
  // RATE LIMITS
  // ======================
  RATE_LIMITS: {
    // Auth endpoints (strict - prevent brute force)
    AUTH_LOGIN: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 attempts per 15 min
    AUTH_OTP: { windowMs: 15 * 60 * 1000, max: 3 }, // 3 OTP requests per 15 min
    FORGOT_PASSWORD: { windowMs: 15 * 60 * 1000, max: 3 },
    
    // API endpoints (standard)
    API_DEFAULT: { windowMs: 60 * 1000, max: 100 }, // 100 req/min
    API_SEARCH: { windowMs: 60 * 1000, max: 30 },
    
    // Write operations (more restrictive)
    API_WRITE: { windowMs: 60 * 1000, max: 20 },
  },

  // ======================
  // CACHE DURATIONS (seconds)
  // ======================
  CACHE: {
    // Static data - long cache
    LOCATIONS: 3600, // 1 hour
    POPULAR_PGS: 1800, // 30 min
    REVIEWS: 900, // 15 min
    
    // User-specific - short/no cache
    USER_DATA: 0, // No cache
    WISHLIST: 0, // No cache
    
    // Public PG data - medium cache
    PG_LIST: 300, // 5 min
    PG_DETAIL: 600, // 10 min
  },

  // ======================
  // VALIDATION
  // ======================
  VALIDATION: {
    PASSWORD_MIN_LENGTH: 8,
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 100,
    EMAIL_MAX_LENGTH: 255,
    OTP_EXPIRY_MINUTES: 5,
    REFRESH_TOKEN_EXPIRY_DAYS: 7,
    ACCESS_TOKEN_EXPIRY_HOURS: 24,
  },

  // ======================
  // FILE SIZES (bytes)
  // ======================
  FILE_SIZES: {
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_DOCUMENT_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_VIDEO_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },

  // ======================
  // API KEYS (for advanced security)
  // ======================
  API_KEYS: {
    HEADER_NAME: 'x-api-key',
    // Set via environment: API_KEY_ADMIN, API_KEY_PARTNER
  },

  // ======================
  // RESPONSE CONFIG
  // ======================
  RESPONSE: {
    INCLUDE_CORRELATION_ID: true,
    INCLUDE_TIMESTAMP: true,
    INCLUDE_PAGINATION: true,
  },

  // ======================
  // ERROR MESSAGES
  // ======================
  ERROR_MESSAGES: {
    NOT_FOUND: 'Resource not found',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access forbidden',
    VALIDATION_FAILED: 'Validation failed',
    SERVER_ERROR: 'Internal server error',
    RATE_LIMITED: 'Too many requests',
  },
};
