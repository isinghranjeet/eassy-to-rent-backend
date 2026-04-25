const cors = require('cors');
const logger = require('../utils/logger');

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:10000',
  'https://eassy-to-rent-backend.onrender.com',
  'https://www.easytorent.in',
  'https://eassytorent.in',
  'https://eassy-to-rent-startup.vercel.app',
];

function applyCors(app) {
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
          return callback(null, true);
        }

        logger.warn(`❌ CORS blocked: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Payment-Token'],
      exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    })
  );

  app.options('*', cors());
}

module.exports = { applyCors };
