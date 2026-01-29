


require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const PGListing = require('./models/PGListing');

const app = express();

// ================ CONFIGURATION ================
const config = {
  port: process.env.PORT || 10000,
  mongoURI: process.env.MONGO_URI,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpire: process.env.JWT_EXPIRE || '30d',
  apiKey: process.env.API_KEY,
  logLevel: process.env.LOG_LEVEL || 'info',
  allowedOrigins: process.env.CORS_ORIGINS ? 
    process.env.CORS_ORIGINS.split(',') : 
    [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'https://eassy-to-rent-startup.vercel.app',
      'https://easy-to-rent-startup.vercel.app',
      'https://pg-finder-frontend.vercel.app',
    ]
};

// Validate required environment variables
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'API_KEY'];
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`❌ ERROR: ${envVar} is required in .env file`);
    if (envVar === 'MONGO_URI') {
      console.error('Please set MONGO_URI in your .env file');
      process.exit(1);
    }
  }
});

console.log('🔧 Configuration Loaded:');
console.log(`   Port: ${config.port}`);
console.log(`   Environment: ${config.nodeEnv}`);
console.log(`   CORS Origins: ${config.allowedOrigins.length} origins configured`);

// ================ SECURITY MIDDLEWARE ================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // Default 15 minutes
  max: process.env.RATE_LIMIT_MAX || 100, // Default 100 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// ================ CORS CONFIGURATION ================
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    if (config.allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚫 CORS Blocked Origin:', origin);
      console.log('✅ Allowed Origins:', config.allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-api-key'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.options('*', cors());

// ================ SWAGGER DOCUMENTATION ================
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PG Finder API',
      version: '1.0.0',
      description: 'PG/Hostel listing management API',
      contact: {
        name: 'API Support',
        email: 'support@pgfinder.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server'
      },
      {
        url: 'https://pg-finder-backend.onrender.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key'
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{
      ApiKeyAuth: []
    }]
  },
  apis: ['./server.js']
};

const swaggerSpec = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ================ MIDDLEWARE ================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Key middleware (optional for certain routes)
const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  // Skip API key check for public routes
  const publicRoutes = [
    '/', 
    '/health', 
    '/api/test', 
    '/api/pg', 
    '/api/pg/:id', 
    '/api/search', 
    '/api/stats',
    '/api/db-test'
  ];
  
  const isPublicRoute = publicRoutes.some(route => {
    if (route.includes(':')) {
      const routeRegex = new RegExp('^' + route.replace(/:\w+/g, '\\w+') + '$');
      return routeRegex.test(req.path);
    }
    return req.path === route;
  });
  
  if (isPublicRoute) {
    return next();
  }
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key is required'
    });
  }
  
  if (apiKey !== config.apiKey) {
    return res.status(403).json({
      success: false,
      message: 'Invalid API key'
    });
  }
  
  next();
};

// Apply API key middleware
app.use(apiKeyMiddleware);

// Enhanced request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Date.now() + Math.random().toString(36).substr(2, 9);
  
  // Log based on log level
  if (['debug', 'info'].includes(config.logLevel)) {
    console.log(`\n[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.url}`);
    console.log(`  Origin: ${req.headers.origin || 'No Origin'}`);
    console.log(`  IP: ${req.ip}`);
    
    // Log query parameters for debug level
    if (config.logLevel === 'debug' && Object.keys(req.query).length > 0) {
      console.log(`  Query: ${JSON.stringify(req.query)}`);
    }
  }
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logMessage = `[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
    
    if (res.statusCode >= 500) {
      console.error(`❌ ${logMessage}`);
    } else if (res.statusCode >= 400) {
      console.warn(`⚠️ ${logMessage}`);
    } else {
      console.log(`✅ ${logMessage}`);
    }
  });
  
  next();
});

// ================ MONGODB ATLAS CONNECTION ================
let isMongoDBConnected = false;

const mongooseOptions = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 30000,
  maxPoolSize: 10,
  retryWrites: true,
  w: 'majority'
};

// Connection event listeners
mongoose.connection.on('connecting', () => {
  console.log('🔄 Connecting to MongoDB...');
  isMongoDBConnected = false;
});

mongoose.connection.on('connected', () => {
  console.log('✅ Successfully connected to MongoDB');
  console.log(`📊 Database: ${mongoose.connection.name}`);
  console.log(`🌐 Host: ${mongoose.connection.host}`);
  isMongoDBConnected = true;
});

mongoose.connection.on('open', () => {
  console.log('🚀 Connection is open and ready to use');
  isMongoDBConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
  isMongoDBConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Disconnected from MongoDB');
  isMongoDBConnected = false;
});

mongoose.connection.on('reconnected', () => {
  console.log('🔁 Reconnected to MongoDB');
  isMongoDBConnected = true;
});

// ================ DELAYED SERVER START ================
const startServer = () => {
  const server = app.listen(config.port, () => {
    console.log(`\n🚀 Server running on http://localhost:${config.port}`);
    console.log(`📊 MongoDB Status: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`📊 MongoDB Connected: ${isMongoDBConnected ? '✅ Yes' : '❌ No'}`);
    console.log(`📄 API Documentation: http://localhost:${config.port}/api-docs`);
    
    console.log('\n📋 Available Endpoints:');
    console.log(`  🏠 Home:      http://localhost:${config.port}/`);
    console.log(`  ❤️  Health:    http://localhost:${config.port}/health`);
    console.log(`  📄 API Docs:  http://localhost:${config.port}/api-docs`);
    console.log(`  🧪 Test:      http://localhost:${config.port}/api/test`);
    console.log(`  🔍 DB Test:   http://localhost:${config.port}/api/db-test`);
    console.log(`  🏢 PG List:   http://localhost:${config.port}/api/pg`);
    console.log(`  ➕ Add Sample: http://localhost:${config.port}/api/pg/sample-data (POST)`);
    console.log(`  🔍 Search:    http://localhost:${config.port}/api/search?city=Chandigarh&type=boys`);
    console.log(`  📊 Stats:     http://localhost:${config.port}/api/stats`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down gracefully...');
    server.close(() => {
      console.log('✅ HTTP server closed');
    });
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });

  return server;
};

// ================ ROUTES ================

/**
 * @swagger
 * /:
 *   get:
 *     summary: Get API information
 *     description: Returns basic information about the API
 *     tags: [General]
 *     responses:
 *       200:
 *         description: API information
 */
app.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Disconnected ❌';
  
  res.json({
    message: '🏠 PG Finder Backend API',
    version: '1.0.0',
    status: 'running 🚀',
    environment: config.nodeEnv,
    database: dbStatus,
    mongodbConnected: isMongoDBConnected,
    timestamp: new Date().toISOString(),
    documentation: `http://${req.headers.host}/api-docs`,
    endpoints: {
      createPG: 'POST /api/pg',
      getPGs: 'GET /api/pg',
      getSinglePG: 'GET /api/pg/:id',
      updatePG: 'PUT /api/pg/:id',
      deletePG: 'DELETE /api/pg/:id',
      publishPG: 'PATCH /api/pg/:id/publish',
      featurePG: 'PATCH /api/pg/:id/feature',
      verifyPG: 'PATCH /api/pg/:id/verify',
      health: 'GET /health',
      test: 'GET /api/test',
      stats: 'GET /api/stats',
      dbTest: 'GET /api/db-test',
      addSample: 'POST /api/pg/sample-data',
      search: 'GET /api/search',
      apiDocs: 'GET /api-docs'
    }
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check the health status of the API and database
 *     tags: [General]
 *     responses:
 *       200:
 *         description: API is healthy
 *       503:
 *         description: API is unhealthy
 */
app.get('/health', async (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      ping: 'pending'
    },
    memory: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`
    },
    nodeVersion: process.version,
    platform: process.platform,
    environment: config.nodeEnv
  };

  try {
    // Test database with a simple query
    await mongoose.connection.db.admin().ping();
    healthCheck.database.ping = 'success';
  } catch (error) {
    healthCheck.database.ping = 'failed';
    healthCheck.database.error = error.message;
  }

  const isHealthy = mongoose.connection.readyState === 1;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    ...healthCheck
  });
});

/**
 * @swagger
 * /api/test:
 *   get:
 *     summary: Test endpoint
 *     description: Simple test endpoint to verify API is working
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: API test successful
 */
app.get('/api/test', (req, res) => {
  return res.json({
    success: true,
    message: '✅ API is working!',
    data: { 
      serverTime: new Date().toISOString(),
      environment: config.nodeEnv,
      version: '1.0.0'
    }
  });
});

/**
 * @swagger
 * /api/db-test:
 *   get:
 *     summary: Database test endpoint
 *     description: Test database connection and get basic stats
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Database test results
 *       500:
 *         description: Database error
 */
app.get('/api/db-test', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState;
    let pgCount = 0;
    let samplePG = null;
    
    if (dbStatus === 1 && isMongoDBConnected) {
      pgCount = await PGListing.countDocuments({});
      
      // Get one sample PG if exists
      const pgs = await PGListing.find({}).limit(1);
      if (pgs.length > 0) {
        samplePG = {
          id: pgs[0]._id,
          name: pgs[0].name,
          price: pgs[0].price,
          city: pgs[0].city,
          slug: pgs[0].slug,
          type: pgs[0].type
        };
      }
    }
    
    return res.json({
      success: true,
      database: {
        status: dbStatus === 1 ? 'connected ✅' : 'disconnected ❌',
        readyState: dbStatus,
        mongodbConnected: isMongoDBConnected,
        totalPGs: pgCount,
        samplePG: samplePG
      }
    });
    
  } catch (error) {
    console.error('❌ DB test error:', error);
    return res.status(500).json({
      success: false,
      message: 'Database test failed',
      error: error.message
    });
  }
});

// ================ PG LISTING CRUD ENDPOINTS ================

/**
 * @swagger
 * /api/pg/{id}:
 *   get:
 *     summary: Get a single PG listing by ID or slug
 *     description: Retrieve a specific PG listing using its ID, slug, or name
 *     tags: [PG Listings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: PG listing ID, slug, or name
 *     responses:
 *       200:
 *         description: PG listing retrieved successfully
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: PG listing not found
 *       500:
 *         description: Server error
 */
app.get('/api/pg/:id', async (req, res) => {
  try {
    console.log('🔍 GET /api/pg/:id', req.params.id);
    
    // Validate ID
    if (!req.params.id || req.params.id === 'undefined' || req.params.id === 'null') {
      return res.status(400).json({
        success: false,
        message: 'PG ID is required',
        debug: {
          receivedId: req.params.id,
          type: typeof req.params.id
        }
      });
    }
    
    if (!isMongoDBConnected) {
      console.log('⚠️ Database not connected');
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    let listing;
    const id = req.params.id.trim();
    
    console.log('🔍 Processing ID:', id);
    
    // Strategy 1: Try to find by MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id)) {
      console.log('🔍 Strategy 1: Searching by MongoDB ObjectId');
      listing = await PGListing.findById(id);
      
      if (listing) {
        console.log('✅ Found by ObjectId:', listing.name);
        return res.json({
          success: true,
          data: listing,
          foundBy: 'ObjectId'
        });
      }
    }
    
    // Strategy 2: Try to find by slug
    console.log('🔍 Strategy 2: Searching by slug');
    listing = await PGListing.findOne({ slug: id });
    
    if (listing) {
      console.log('✅ Found by slug:', listing.name);
      return res.json({
        success: true,
        data: listing,
        foundBy: 'slug'
      });
    }
    
    // Strategy 3: Try to find by name (exact match)
    console.log('🔍 Strategy 3: Searching by exact name');
    listing = await PGListing.findOne({ 
      name: { $regex: `^${id.replace(/[-\s]/g, '[-\s]?')}$`, $options: 'i' } 
    });
    
    if (listing) {
      console.log('✅ Found by name:', listing.name);
      return res.json({
        success: true,
        data: listing,
        foundBy: 'name'
      });
    }
    
    // Strategy 4: Try to find by any matching field
    console.log('🔍 Strategy 4: Broad search');
    listing = await PGListing.findOne({
      $or: [
        { name: { $regex: id, $options: 'i' } },
        { address: { $regex: id, $options: 'i' } },
        { city: { $regex: id, $options: 'i' } },
        { locality: { $regex: id, $options: 'i' } },
        { _id: id }
      ]
    });
    
    if (listing) {
      console.log('✅ Found by broad search:', listing.name);
      return res.json({
        success: true,
        data: listing,
        foundBy: 'broad'
      });
    }
    
    // If not found after all strategies
    console.log('❌ No listing found for ID:', id);
    
    // Get all available PGs for debugging
    const allPGs = await PGListing.find({}, '_id name slug').limit(10);
    
    return res.status(404).json({
      success: false,
      message: 'PG listing not found',
      debug: {
        searchedId: id,
        availablePGs: allPGs.map(pg => ({
          id: pg._id,
          name: pg.name,
          slug: pg.slug
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Error in GET /api/pg/:id:', error);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message,
      stack: config.nodeEnv === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @swagger
 * /api/pg:
 *   get:
 *     summary: Get all PG listings with pagination and filters
 *     description: Retrieve PG listings with optional filtering, sorting, and pagination
 *     tags: [PG Listings]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [boys, girls, co-ed, family, all]
 *         description: Filter by PG type
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name, address, city, or description
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *           enum: [createdAt, price, rating, name]
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           default: desc
 *           enum: [asc, desc]
 *         description: Sort order
 *       - in: query
 *         name: admin
 *         schema:
 *           type: string
 *         description: Set to 'true' to include unpublished listings
 *     responses:
 *       200:
 *         description: List of PG listings retrieved successfully
 *       500:
 *         description: Server error
 */
app.get('/api/pg', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      city,
      search,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      admin
    } = req.query;

    console.log('📋 GET /api/pg', { page, limit, type, city, search });
    
    if (!isMongoDBConnected) {
      console.log('⚠️ Database not connected');
      return res.status(500).json({
        success: false,
        message: 'Database not connected',
        data: []
      });
    }
    
    const query = {};
    
    // Add filters
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (city) {
      query.city = { $regex: city, $options: 'i' };
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    
    if (admin !== 'true') {
      query.published = true;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await PGListing.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const listings = await PGListing.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    console.log(`✅ Found ${listings.length} listings from MongoDB (Total: ${total})`);
    
    return res.json({
      success: true,
      data: listings,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching listings:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/pg:
 *   post:
 *     summary: Create a new PG listing
 *     description: Create a new PG listing with the provided data
 *     tags: [PG Listings]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the PG
 *               price:
 *                 type: number
 *                 description: Monthly rent price
 *               description:
 *                 type: string
 *                 description: PG description
 *               city:
 *                 type: string
 *                 description: City where PG is located
 *               type:
 *                 type: string
 *                 enum: [boys, girls, co-ed, family]
 *                 description: Type of PG
 *     responses:
 *       201:
 *         description: PG listing created successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */
app.post('/api/pg', async (req, res) => {
  try {
    console.log('➕ POST /api/pg');
    
    if (!isMongoDBConnected) {
      console.log('❌ MongoDB not connected');
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    // Validate required fields
    if (!req.body.name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }
    
    if (!req.body.price) {
      return res.status(400).json({
        success: false,
        message: 'Price is required'
      });
    }
    
    // Generate slug from name
    const slug = req.body.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
    
    console.log('📝 Generated slug:', slug);
    
    const listingData = {
      name: req.body.name,
      slug: slug,
      description: req.body.description || '',
      city: req.body.city || 'Chandigarh',
      locality: req.body.locality || '',
      address: req.body.address || '',
      price: Number(req.body.price),
      type: req.body.type || 'boys',
      images: req.body.images || [],
      gallery: req.body.gallery || [],
      googleMapLink: req.body.googleMapLink || '',
      amenities: req.body.amenities || [],
      roomTypes: req.body.roomTypes || ['Single', 'Double'],
      distance: req.body.distance || '',
      availability: req.body.availability || 'available',
      location: req.body.location || { type: 'Point', coordinates: [0, 0] },
      published: req.body.published !== undefined ? req.body.published : true,
      verified: req.body.verified || false,
      featured: req.body.featured || false,
      rating: req.body.rating || 0,
      reviewCount: req.body.reviewCount || 0,
      ownerName: req.body.ownerName || '',
      ownerPhone: req.body.ownerPhone || '9315058665',
      ownerEmail: req.body.ownerEmail || '',
      ownerId: req.body.ownerId || '',
      contactEmail: req.body.contactEmail || '',
      contactPhone: req.body.contactPhone || '9315058665'
    };
    
    console.log('📦 Creating listing:', listingData.name);
    
    const newListing = new PGListing(listingData);
    const savedListing = await newListing.save();
    
    console.log('✅ Listing saved to database!');
    console.log('ID:', savedListing._id);
    console.log('Name:', savedListing.name);
    console.log('Slug:', savedListing.slug);
    
    return res.status(201).json({
      success: true,
      message: 'PG listing created successfully',
      data: savedListing
    });
    
  } catch (error) {
    console.error('❌ Error creating listing:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create listing',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/pg/{id}:
 *   put:
 *     summary: Update a PG listing
 *     description: Update an existing PG listing by ID
 *     tags: [PG Listings]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: PG listing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: PG listing updated successfully
 *       400:
 *         description: Invalid ID or data
 *       404:
 *         description: PG listing not found
 *       500:
 *         description: Server error
 */
app.put('/api/pg/:id', async (req, res) => {
  try {
    console.log('✏️ PUT /api/pg/:id', req.params.id);
    
    if (!isMongoDBConnected) {
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    const listingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID format'
      });
    }
    
    const existingListing = await PGListing.findById(listingId);
    if (!existingListing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    const updateData = {};
    
    const fields = [
      'name', 'description', 'city', 'locality', 'address', 'price', 'type',
      'images', 'gallery', 'googleMapLink', 'amenities', 'roomTypes',
      'distance', 'availability', 'location', 'published', 'verified',
      'featured', 'rating', 'reviewCount', 'ownerName', 'ownerPhone',
      'ownerEmail', 'ownerId', 'contactEmail', 'contactPhone', 'slug'
    ];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'price' || field === 'rating' || field === 'reviewCount') {
          updateData[field] = Number(req.body[field]);
        } else if (field === 'published' || field === 'verified' || field === 'featured') {
          updateData[field] = Boolean(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
      }
    });
    
    // Auto-generate slug if name is updated
    if (updateData.name && !updateData.slug) {
      updateData.slug = updateData.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-');
    }
    
    const updatedListing = await PGListing.findByIdAndUpdate(
      listingId,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    console.log('✅ Listing updated:', updatedListing._id);
    
    return res.json({
      success: true,
      message: 'Listing updated successfully',
      data: updatedListing
    });
    
  } catch (error) {
    console.error('❌ Error updating listing:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update listing',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/pg/{id}:
 *   delete:
 *     summary: Delete a PG listing
 *     description: Delete a PG listing by ID
 *     tags: [PG Listings]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: PG listing ID
 *     responses:
 *       200:
 *         description: PG listing deleted successfully
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: PG listing not found
 *       500:
 *         description: Server error
 */
app.delete('/api/pg/:id', async (req, res) => {
  try {
    console.log('🗑️ DELETE /api/pg/:id', req.params.id);
    
    if (!isMongoDBConnected) {
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    const listingId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID format'
      });
    }
    
    const existingListing = await PGListing.findById(listingId);
    if (!existingListing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    await PGListing.findByIdAndDelete(listingId);
    
    console.log('✅ Listing deleted:', listingId);
    
    return res.json({
      success: true,
      message: 'Listing deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error deleting listing:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to delete listing',
      error: error.message
    });
  }
});

// ================ PATCH ENDPOINTS ================

/**
 * @swagger
 * /api/pg/{id}/publish:
 *   patch:
 *     summary: Publish/unpublish a PG listing
 *     description: Toggle the published status of a PG listing
 *     tags: [PG Listings]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: PG listing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - published
 *             properties:
 *               published:
 *                 type: boolean
 *                 description: Published status
 *     responses:
 *       200:
 *         description: Publish status updated successfully
 *       400:
 *         description: Invalid ID or data
 *       404:
 *         description: PG listing not found
 *       500:
 *         description: Server error
 */
app.patch('/api/pg/:id/publish', async (req, res) => {
  try {
    const listingId = req.params.id;
    const published = req.body.published;
    
    if (!isMongoDBConnected) {
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID format'
      });
    }
    
    const updatedListing = await PGListing.findByIdAndUpdate(
      listingId,
      { published: Boolean(published) },
      { new: true }
    );
    
    if (!updatedListing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    return res.json({
      success: true,
      message: `Listing ${published ? 'published' : 'unpublished'} successfully`,
      data: updatedListing
    });
    
  } catch (error) {
    console.error('Error toggling publish:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update listing',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/pg/{id}/feature:
 *   patch:
 *     summary: Feature/unfeature a PG listing
 *     description: Toggle the featured status of a PG listing
 *     tags: [PG Listings]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: PG listing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - featured
 *             properties:
 *               featured:
 *                 type: boolean
 *                 description: Featured status
 *     responses:
 *       200:
 *         description: Feature status updated successfully
 *       400:
 *         description: Invalid ID or data
 *       404:
 *         description: PG listing not found
 *       500:
 *         description: Server error
 */
app.patch('/api/pg/:id/feature', async (req, res) => {
  try {
    const listingId = req.params.id;
    const featured = req.body.featured;
    
    if (!isMongoDBConnected) {
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID format'
      });
    }
    
    const updatedListing = await PGListing.findByIdAndUpdate(
      listingId,
      { featured: Boolean(featured) },
      { new: true }
    );
    
    if (!updatedListing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    return res.json({
      success: true,
      message: `Listing ${featured ? 'featured' : 'unfeatured'} successfully`,
      data: updatedListing
    });
    
  } catch (error) {
    console.error('Error toggling feature:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update listing',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/pg/{id}/verify:
 *   patch:
 *     summary: Verify/unverify a PG listing
 *     description: Toggle the verified status of a PG listing
 *     tags: [PG Listings]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: PG listing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verified
 *             properties:
 *               verified:
 *                 type: boolean
 *                 description: Verified status
 *     responses:
 *       200:
 *         description: Verify status updated successfully
 *       400:
 *         description: Invalid ID or data
 *       404:
 *         description: PG listing not found
 *       500:
 *         description: Server error
 */
app.patch('/api/pg/:id/verify', async (req, res) => {
  try {
    const listingId = req.params.id;
    const verified = req.body.verified;
    
    if (!isMongoDBConnected) {
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID format'
      });
    }
    
    const updatedListing = await PGListing.findByIdAndUpdate(
      listingId,
      { verified: Boolean(verified) },
      { new: true }
    );
    
    if (!updatedListing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    return res.json({
      success: true,
      message: `Listing ${verified ? 'verified' : 'unverified'} successfully`,
      data: updatedListing
    });
    
  } catch (error) {
    console.error('Error toggling verify:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update listing',
      error: error.message
    });
  }
});

// ================ ADDITIONAL ENDPOINTS ================

/**
 * @swagger
 * /api/pg/sample-data:
 *   post:
 *     summary: Add sample PG listings
 *     description: Add sample PG listings to the database (only if empty)
 *     tags: [Test]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Sample data added or already exists
 *       500:
 *         description: Server error
 */
app.post('/api/pg/sample-data', async (req, res) => {
  try {
    if (!isMongoDBConnected) {
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    // Check if we already have data
    const existingCount = await PGListing.countDocuments({});
    if (existingCount > 0) {
      return res.json({
        success: true,
        message: `Database already has ${existingCount} listings. No sample data added.`,
        count: existingCount
      });
    }
    
    const sampleListings = [
      {
        name: 'Royal Boys PG',
        slug: 'royal-boys-pg',
        description: 'Luxurious boys PG with modern amenities near Chandigarh University',
        city: 'Chandigarh',
        locality: 'Gate 2 Area',
        address: 'Gate 2, CU Road, Chandigarh University',
        price: 9000,
        type: 'boys',
        images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'],
        amenities: ['WiFi', 'AC', 'Meals', 'Parking', 'Gym', 'Study Room', 'Power Backup', '24/7 Security'],
        published: true,
        verified: true,
        featured: true,
        rating: 4.7,
        reviewCount: 56,
        ownerName: 'Amit Verma',
        ownerPhone: '9315058665',
        contactPhone: '9315058665',
        contactEmail: 'royalboyspg@example.com'
      },
      {
        name: 'Sunshine Girls PG',
        slug: 'sunshine-girls-pg',
        description: 'Safe and secure girls PG with 24/7 security and CCTV',
        city: 'Chandigarh',
        locality: 'Library Road',
        address: 'Library Road, Chandigarh University',
        price: 9500,
        type: 'girls',
        images: ['https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800'],
        amenities: ['WiFi', 'AC', 'Meals', 'CCTV', '24/7 Security', 'Hot Water', 'Power Backup', 'Housekeeping'],
        published: true,
        verified: true,
        featured: true,
        rating: 4.8,
        reviewCount: 89,
        ownerName: 'Sunita Devi',
        ownerPhone: '9315058665',
        contactPhone: '9315058665',
        contactEmail: 'sunshinegirlspg@example.com'
      },
      {
        name: 'Cozy Co-ed PG',
        slug: 'cozy-co-ed-pg',
        description: 'Comfortable co-ed PG with homely environment',
        city: 'Mohali',
        locality: 'Phase 7',
        address: 'Phase 7, Mohali, Punjab',
        price: 8000,
        type: 'co-ed',
        images: ['https://images.unsplash.com/photo-1513584684374-8bab748fbf90?w=800'],
        amenities: ['WiFi', 'TV', 'Meals', 'Laundry', 'Study Room', 'Refrigerator', 'Geyser'],
        published: true,
        verified: true,
        featured: false,
        rating: 4.3,
        reviewCount: 34,
        ownerName: 'Rajesh Kumar',
        ownerPhone: '9315058665',
        contactPhone: '9315058665',
        contactEmail: 'cozycoedpg@example.com'
      },
      {
        name: 'Premium Family PG',
        slug: 'premium-family-pg',
        description: 'Premium accommodation for families and working professionals',
        city: 'Chandigarh',
        locality: 'Gate 1',
        address: 'Gate 1, Chandigarh University Road',
        price: 11000,
        type: 'family',
        images: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800'],
        amenities: ['WiFi', 'AC', 'Meals', 'Parking', 'TV', 'Refrigerator', 'Geyser', 'Cooking'],
        published: true,
        verified: true,
        featured: true,
        rating: 4.9,
        reviewCount: 45,
        ownerName: 'Vikram Singh',
        ownerPhone: '9315058665',
        contactPhone: '9315058665',
        contactEmail: 'premiumfamilypg@example.com'
      }
    ];
    
    const savedListings = [];
    
    for (const listing of sampleListings) {
      const newListing = new PGListing(listing);
      const saved = await newListing.save();
      savedListings.push(saved);
      console.log(`✅ Added: ${saved.name} (ID: ${saved._id}, Slug: ${saved.slug})`);
    }
    
    return res.json({
      success: true,
      message: 'Sample data added successfully',
      count: savedListings.length,
      data: savedListings.map(pg => ({
        id: pg._id,
        name: pg.name,
        slug: pg.slug,
        price: pg.price,
        type: pg.type
      }))
    });
    
  } catch (error) {
    console.error('❌ Error adding sample data:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to add sample data',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Search PG listings
 *     description: Search PG listings with various filters
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [boys, girls, co-ed, family, all]
 *         description: Filter by PG type
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price
 *       - in: query
 *         name: amenities
 *         schema:
 *           type: string
 *         description: Comma-separated list of amenities
 *     responses:
 *       200:
 *         description: Search results
 *       500:
 *         description: Server error
 */
app.get('/api/search', async (req, res) => {
  try {
    const { city, type, minPrice, maxPrice, amenities } = req.query;
    
    console.log('🔍 GET /api/search', { city, type, minPrice, maxPrice, amenities });
    
    if (!isMongoDBConnected) {
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    let query = { published: true };
    
    if (city && city !== 'all') query.city = { $regex: city, $options: 'i' };
    if (type && type !== 'all') query.type = type;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (amenities) {
      query.amenities = { $all: amenities.split(',') };
    }
    
    const listings = await PGListing.find(query).sort({ featured: -1, rating: -1 });
    
    console.log(`✅ Found ${listings.length} listings`);
    
    return res.json({
      success: true,
      count: listings.length,
      data: listings
    });
    
  } catch (error) {
    console.error('❌ Search error:', error);
    return res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Get PG statistics
 *     description: Get statistics about PG listings
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       500:
 *         description: Server error
 */
app.get('/api/stats', async (req, res) => {
  try {
    if (!isMongoDBConnected) {
      return res.json({
        success: true,
        data: {
          totalPGs: 0,
          boysPGs: 0,
          girlsPGs: 0,
          coedPGs: 0,
          familyPGs: 0,
          featuredPGs: 0,
          verifiedPGs: 0,
          avgPrice: 0,
          lastUpdated: new Date().toISOString(),
          message: 'Database not connected'
        }
      });
    }
    
    const totalPGs = await PGListing.countDocuments({ published: true });
    const boysPGs = await PGListing.countDocuments({ type: 'boys', published: true });
    const girlsPGs = await PGListing.countDocuments({ type: 'girls', published: true });
    const coedPGs = await PGListing.countDocuments({ type: 'co-ed', published: true });
    const familyPGs = await PGListing.countDocuments({ type: 'family', published: true });
    const featuredPGs = await PGListing.countDocuments({ featured: true, published: true });
    const verifiedPGs = await PGListing.countDocuments({ verified: true, published: true });
    
    const avgPriceResult = await PGListing.aggregate([
      { $match: { published: true } },
      { $group: { _id: null, avgPrice: { $avg: "$price" } } }
    ]);
    
    const avgPrice = avgPriceResult.length > 0 ? Math.round(avgPriceResult[0].avgPrice) : 0;
    
    return res.json({
      success: true,
      data: {
        totalPGs,
        boysPGs,
        girlsPGs,
        coedPGs,
        familyPGs,
        featuredPGs,
        verifiedPGs,
        avgPrice,
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get stats',
      error: error.message
    });
  }
});

// ================ TEST ENDPOINTS ================
app.get('/api/pg-test/list', async (req, res) => {
  try {
    if (!isMongoDBConnected) {
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    const listings = await PGListing.find({}, '_id name slug price type address').limit(20);
    
    return res.json({
      success: true,
      data: listings,
      count: listings.length,
      debugInfo: {
        note: 'Use these IDs to test individual PG endpoints',
        example: `GET /api/pg/${listings.length > 0 ? listings[0]._id : 'ID_HERE'}`
      }
    });
  } catch (error) {
    console.error('Error in pg-test/list:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/pg-test/find/:query', async (req, res) => {
  try {
    if (!isMongoDBConnected) {
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    const query = req.params.query;
    console.log('🔍 Test find query:', query);
    
    const listings = await PGListing.find({
      $or: [
        { _id: query },
        { slug: query },
        { name: { $regex: query, $options: 'i' } },
        { address: { $regex: query, $options: 'i' } }
      ]
    });
    
    return res.json({
      success: true,
      query: query,
      count: listings.length,
      data: listings,
      searchMethods: ['ObjectId', 'slug', 'name', 'address']
    });
  } catch (error) {
    console.error('Error in pg-test/find:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ================ ERROR HANDLERS ================
app.use((err, req, res, next) => {
  console.error('🚨 Global Error Handler:', err.message);
  
  return res.status(err.status || 500).json({
    success: false,
    message: 'Internal server error',
    error: config.nodeEnv === 'development' ? err.message : 'Something went wrong',
    stack: config.nodeEnv === 'development' ? err.stack : undefined
  });
});

app.all('*', (req, res) => {
  console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
  
  return res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET  /',
      'GET  /health',
      'GET  /api-docs',
      'GET  /api/test',
      'GET  /api/db-test',
      'GET  /api/pg',
      'POST /api/pg',
      'GET  /api/pg/:id',
      'PUT  /api/pg/:id',
      'DELETE /api/pg/:id',
      'PATCH /api/pg/:id/publish',
      'PATCH /api/pg/:id/feature',
      'PATCH /api/pg/:id/verify',
      'POST /api/pg/sample-data',
      'GET  /api/search',
      'GET  /api/stats'
    ]
  });
});

// ================ CONNECT TO MONGODB AND START SERVER ================
console.log('Starting application...');
console.log('Environment:', config.nodeEnv);

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoURI, mongooseOptions);
    console.log('✅ MongoDB Atlas Connected Successfully!');
    return true;
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    console.log('🔄 Retrying connection in 3 seconds...');
    
    // Retry connection after 3 seconds
    setTimeout(() => {
      connectDB();
    }, 3000);
    
    return false;
  }
};

// Start the application
const initApp = async () => {
  const dbConnected = await connectDB();
  
  if (!dbConnected) {
    console.log('⚠️ Starting server without database connection...');
  }
  
  startServer();
};

initApp();

module.exports = app;