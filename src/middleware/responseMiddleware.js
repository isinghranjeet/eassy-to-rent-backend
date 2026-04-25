const { successResponse, errorResponse } = require('../utils/response');

const responseMiddleware = (req, res, next) => {
  res.success = (payload = {}) => successResponse(res, payload);
  res.fail = (payload = {}) => errorResponse(res, payload);
  next();
};

module.exports = responseMiddleware;
