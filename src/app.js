const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/database');
const pgRoutes = require('./routes/pg');

const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const reviewRoutes = require('./routes/reviews');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');

const app = express();

// 🔥 Trust proxy (IMPORTANT for Render)
app.set('trust proxy', 1);

// Database
connectDB();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// ✅ CORS FIXED CONFIG
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'https://eassy-to-rent-backend.onrender.com',
  'https://www.easytorent.in' // ✅ FIXED
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (
      allowedOrigins.includes(origin) ||
      process.env.NODE_ENV === 'development'
    ) {
      callback(null, true);
    } else {
      logger.warn(`❌ CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.originalUrl}`, {
    origin: req.headers.origin,
    ip: req.ip,
  });
  next();
});

// ✅ GLOBAL LIMITER (OK)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(globalLimiter);

// ✅ AUTH LIMITER (FIXED 🔥)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 🔥 increased
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts, try again later'
  },
  skipSuccessfulRequests: true,
});

app.use('/api/auth', authLimiter);

// ✅ OPTIONAL OTP LIMITER (BEST PRACTICE)
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: 'Wait 60 seconds before next OTP'
  }
});

// Apply only on login (OTP route)
app.use('/api/auth/login', otpLimiter);

// Health routes
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'OK',
    uptime: process.uptime(),
  });
});
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'OK',
    uptime: process.uptime(),
  });
});

// Routes
app.use('/api/pg', pgRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);

// 404
app.use(notFound);

// Error handler
app.use(errorHandler);

// Handle crashes
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
});

module.exports = app;







// const express = require("express");
// const cors = require("cors");
// const helmet = require("helmet");
// const rateLimit = require("express-rate-limit");

// const connectDB = require("./config/database");
// const pgRoutes = require("./routes/pg");
// const authRoutes = require("./routes/auth");
// const bookingRoutes = require("./routes/bookings");
// const reviewRoutes = require("./routes/reviews");
// const { notFound, errorHandler } = require("./middleware/errorMiddleware");
// const logger = require("./utils/logger");

// const app = express();

// // connect DB
// connectDB();


// // security
// app.use(
//   helmet({
//     crossOriginResourcePolicy: { policy: "cross-origin" },
//     crossOriginEmbedderPolicy: false,
//   })
// );


// // allowed domains
// const allowedOrigins = [
//   "https://www.easytorent.in",
//   "https://easytorent.in",
//   "https://eassy-to-rent-startup.vercel.app",
//   "http://localhost:5173",
//   "http://localhost:3000",
// ];


// // CORS middleware
// app.use(
//   cors({
//     origin: function (origin, callback) {

//       if (!origin) return callback(null, true);

//       if (allowedOrigins.includes(origin)) {
//         return callback(null, true);
//       }

//       return callback(new Error("CORS not allowed"));
//     },

//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );


// // IMPORTANT: handle preflight requests
// app.options("*", cors());


// // body parser
// app.use(express.json({ limit: "10mb" }));
// app.use(express.urlencoded({ extended: true, limit: "10mb" }));


// // logger
// app.use((req, res, next) => {
//   console.log(`📡 ${req.method} ${req.url}`);
//   next();
// });


// // rate limiter
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
// });

// app.use(limiter);


// // routes
// app.use("/api/pg", pgRoutes);
// app.use("/api/auth", authRoutes);
// app.use("/api/bookings", bookingRoutes);
// app.use("/api/reviews", reviewRoutes);


// // root
// app.get("/", (req, res) => {
//   res.json({
//     success: true,
//     message: "PG Finder API Running",
//   });
// });


// // health
// app.get("/health", (req, res) => {
//   res.json({
//     success: true,
//     message: "Server OK",
//   });
// });


// // 404
// app.use(notFound);


// // error handler
// app.use(errorHandler);


// module.exports = app;