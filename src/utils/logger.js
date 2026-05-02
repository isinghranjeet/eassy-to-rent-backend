const { createLogger, format, transports } = require('winston');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate correlation ID for request tracking
 */
const getCorrelationId = (req) => {
  return req.headers['x-correlation-id'] || uuidv4();
};

/**
 * Add correlation ID middleware
 */
const addCorrelationId = (req, res, next) => {
  req.correlationId = getCorrelationId(req);
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
};

/**
 * Create child logger with correlation ID
 */
const createChildLogger = (parentLogger, correlationId) => {
  return {
    error: (message, meta = {}) =>
      parentLogger.error(message, { correlationId, ...meta }),

    warn: (message, meta = {}) =>
      parentLogger.warn(message, { correlationId, ...meta }),

    info: (message, meta = {}) =>
      parentLogger.info(message, { correlationId, ...meta }),

    debug: (message, meta = {}) =>
      parentLogger.debug(message, { correlationId, ...meta }),

    http: (message, meta = {}) =>
      parentLogger.http(message, { correlationId, ...meta }),
  };
};

/**
 * Winston Logger Setup
 */
const logger = createLogger({
  level:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),

  defaultMeta: {
    service: 'pg-finder-backend',
  },

  transports: [
    new transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? format.combine(format.timestamp(), format.json())
          : format.combine(
              format.colorize(),
              format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
              format.printf(({ level, message, timestamp, correlationId, ...meta }) => {
                const corr = correlationId
                  ? `[${correlationId.slice(0, 8)}] `
                  : '';

                const extra =
                  Object.keys(meta).length && level !== 'http'
                    ? ` ${JSON.stringify(meta)}`
                    : '';

                return `${timestamp} ${corr}[${level.toUpperCase()}] ${message}${extra}`;
              })
            ),
    }),
  ],
});

module.exports = {
  logger,
  createChildLogger,
  getCorrelationId,
  addCorrelationId,
};