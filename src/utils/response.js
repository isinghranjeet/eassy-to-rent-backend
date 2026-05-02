const buildResponse = (success, message, data = null) => ({
  success,
  message,
  data,
  timestamp: new Date().toISOString(),
});

const successResponse = (res, { message = '', data = null, statusCode = 200 }) =>
  res.status(statusCode).json(buildResponse(true, message, data ?? {}));

// Paginated response helper
const paginatedResponse = (
  res,
  { message = '', data = [], total = 0, page = 1, limit = 10, statusCode = 200 }
) => {
  const totalPages = Math.ceil(total / limit);
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    timestamp: new Date().toISOString(),
  });
};

const errorResponse = (
  res,
  { message = 'Something went wrong', statusCode = 500, errors = null }
) =>
  res
    .status(statusCode)
    .json(buildResponse(false, message, errors ? { errors } : {}));

// Response with caching headers
const cacheableResponse = (res, maxAge = 300) => {
  res.set('Cache-Control', `public, max-age=${maxAge}`);
  res.set('X-Cache-Status', 'HIT');
  return res;
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  cacheableResponse,
  buildResponse,
};

