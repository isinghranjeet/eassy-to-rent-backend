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

// Database
connectDB();

// Core middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resource sharing
}));

// CORS configuration - FIXED VERSION
const allowedOrigins = [
  'http://localhost:5173',  // Vite default
  'http://localhost:3000',  // React default
  'http://localhost:5000',  // Backend itself
  'https://eassy-to-rent-backend.onrender.com', // Backend on Render
  // Add your frontend domains when deployed
  // 'https://your-frontend-domain.com',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if the origin is allowed
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Important: Allow cookies/sessions to be sent
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600, // Cache preflight requests for 10 minutes
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests for all routes
app.options('*', cors(corsOptions));

// Additional headers for security and CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic request logger
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.originalUrl}`, {
    origin: req.headers.origin,
    ip: req.ip,
  });
  next();
});

// Rate limiting - more strict for auth routes, lighter for others
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  skip: (req) => req.path.startsWith('/health') || req.path === '/', // Skip rate limiting for health checks
});

app.use(globalLimiter);

// Stricter rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 auth attempts per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts, please try again after 15 minutes', data: {} },
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Apply auth limiter to auth routes
app.use('/api/auth', authLimiter);

// Health / root endpoints (public, no rate limiting)
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'PG Finder API',
    data: {
      env: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      cors: {
        enabled: true,
        allowedOrigins: allowedOrigins,
      },
    },
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'OK',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: 'connected',
      cors: 'enabled',
    },
  });
});

// Routes
app.use('/api/pg', pgRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);

// 404 handler
app.use(notFound);

// Error handler (should be last)
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  // Don't crash the server, just log
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  // Don't crash the server, just log
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