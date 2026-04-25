const buildResponse = (success, message, data = null) => ({
  success,
  message,
  data,
  timestamp: new Date().toISOString(),
});

const successResponse = (res, { message = '', data = null, statusCode = 200 }) =>
  res.status(statusCode).json(buildResponse(true, message, data ?? {}));

const errorResponse = (
  res,
  { message = 'Something went wrong', statusCode = 500, errors = null }
) =>
  res
    .status(statusCode)
    .json(buildResponse(false, message, errors ? { errors } : {}));

module.exports = {
  successResponse,
  errorResponse,
};

