const { errorResponse } = require('../utils/response');

const validate = (schema, target = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[target], {
    abortEarly: false,
    convert: true,
    stripUnknown: true,
  });

  if (error) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Validation failed',
      errors: error.details.map((d) => d.message),
    });
  }

  req[target] = value;
  return next();
};

module.exports = validate;
