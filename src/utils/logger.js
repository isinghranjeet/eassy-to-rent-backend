const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'pg-finder-backend' },
  transports: [
    new transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? format.combine(format.timestamp(), format.json())
          : format.combine(
              format.colorize(),
              format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
              format.printf(({ level, message, timestamp, ...meta }) => {
                const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                return `${timestamp} [${level}] ${message}${extra}`;
              })
            ),
    }),
  ],
});

module.exports = logger;

