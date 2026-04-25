const logger = require('../utils/logger');
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

  logger.error(err.message || 'Unhandled error', {
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    details: err.details || null,
  });

  ErrorLog.create({
    message: err.message || 'Unhandled error',
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    statusCode,
    details: err.details || null,
  }).catch((saveError) => {
    logger.error('Failed to persist error log', {
      message: saveError.message,
      stack: saveError.stack,
    });
  });

  return errorResponse(res, {
    message: statusCode >= 500 ? 'Internal Server Error' : (err.message || 'Request failed'),
    statusCode,
    errors: err.details || null,
  });
};

module.exports = { notFound, errorHandler };
