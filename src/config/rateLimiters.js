const rateLimit = require('express-rate-limit');

function applyRateLimiters(app) {
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests, please try again later.',
    },
  });
  app.use(globalLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many attempts, try again later',
    },
    skipSuccessfulRequests: true,
  });
  app.use('/api/auth', authLimiter);

  const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many payment attempts, please try again later',
    },
  });
  app.use('/api/payments', paymentLimiter);
  app.use('/api/paymentgateway', paymentLimiter);

  const apiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', apiLimiter);
}

module.exports = { applyRateLimiters };
