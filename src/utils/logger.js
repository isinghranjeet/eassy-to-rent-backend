const { createLogger, format, transports } = require('winston');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate Correlation ID
 */
const getCorrelationId = (req) => {
  return req.headers['x-correlation-id'] || uuidv4();
};

/**
 * Middleware
 */
const addCorrelationId = (req, res, next) => {
  req.correlationId = getCorrelationId(req);
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
};

/**
 * Winston Logger
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
              format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss',
              }),
              format.printf(
                ({ timestamp, level, message, correlationId, ...meta }) => {
                  const corr = correlationId
                    ? `[${correlationId.substring(0, 8)}] `
                    : '';

                  const extra =
                    Object.keys(meta).length > 0
                      ? ` ${JSON.stringify(meta)}`
                      : '';

                  return `${timestamp} ${corr}[${level.toUpperCase()}] ${message}${extra}`;
                }
              )
            ),
    }),
  ],
});

/**
 * Child Logger
 */
const createChildLogger = (correlationId) => ({
  error: (message, meta = {}) =>
    logger.error(message, { correlationId, ...meta }),

  warn: (message, meta = {}) =>
    logger.warn(message, { correlationId, ...meta }),

  info: (message, meta = {}) =>
    logger.info(message, { correlationId, ...meta }),

  debug: (message, meta = {}) =>
    logger.debug(message, { correlationId, ...meta }),

  http: (message, meta = {}) =>
    logger.http(message, { correlationId, ...meta }),
});

module.exports = {
  logger,
  createChildLogger,
  addCorrelationId,
  getCorrelationId,
};