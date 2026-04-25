const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

function applySecurityMiddleware(app) {
  app.use(compression());

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://checkout.razorpay.com', 'https://js.stripe.com'],
          frameSrc: ["'self'", 'https://checkout.razorpay.com', 'https://hooks.stripe.com'],
          connectSrc: ["'self'", 'https://api.razorpay.com', 'https://api.stripe.com'],
          imgSrc: ["'self'", 'data:', 'https://*.razorpay.com'],
        },
      },
    })
  );

  app.use(mongoSanitize());
  app.use(xss());
  app.use(hpp());
}

module.exports = { applySecurityMiddleware };
