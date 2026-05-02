/**
 * Async error handler wrapper
 * Eliminates need for try-catch in every controller
 * @param {Function} fn - Async route handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Async handler with specific error handling
 * @param {Function} fn - Async route handler
 * @param {Function} errorHandler - Custom error handler
 */
const asyncHandlerWithError = (fn, errorHandler) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    if (errorHandler) {
      errorHandler(err, req, res, next);
    } else {
      next(err);
    }
  });
};

module.exports = { asyncHandler, asyncHandlerWithError };
