const { logger } = require('../utils/logger');  // ✅ FIXED - Destructuring
const ErrorLog = require('../models/ErrorLog');
const { errorResponse } = require('../utils/response');

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Centralized error handler
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;

  // ✅ FIXED - Convert to string format (single argument)
  const errorMessage = `${err.message || 'Unhandled error'} | Path: ${req.originalUrl} | Method: ${req.method}`;
  logger.error(errorMessage);
  
  // Optional: Log stack trace separately in development
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    logger.debug(`Stack trace: ${err.stack}`);
  }

  // Save to database (don't await - let it run in background)
  ErrorLog.create({
    message: err.message || 'Unhandled error',
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    statusCode,
    details: err.details || null,
  }).catch((saveError) => {
    // ✅ FIXED - Simple error logging
    logger.error(`Failed to persist error log: ${saveError.message}`);
  });

  return errorResponse(res, {
    message: statusCode >= 500 ? 'Internal Server Error' : (err.message || 'Request failed'),
    statusCode,
    errors: err.details || null,
  });
};

module.exports = { notFound, errorHandler };