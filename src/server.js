// server.js - COMPLETE WORKING VERSION
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`\n${new Date().toISOString()} ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Request Body:', JSON.stringify(req.body).substring(0, 200));
  }
  next();
});

// ================ MONGODB CONNECTION ================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pgfinder';

console.log('🔌 Attempting MongoDB connection...');
console.log(`MongoDB URI: ${MONGODB_URI}`);

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    console.log(`Database: ${mongoose.connection.name}`);
    console.log(`Host: ${mongoose.connection.host}`);
    console.log(`Port: ${mongoose.connection.port}`);
    
    // List all collections
    mongoose.connection.db.listCollections().toArray()
      .then(collections => {
        console.log('\n📁 Available Collections:');
        collections.forEach(col => {
          console.log(`  - ${col.name}`);
        });
      })
      .catch(err => {
        console.log('⚠️ Could not list collections:', err.message);
      });
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('⚠️ Running in fallback mode - MongoDB not connected');
  });

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected from MongoDB');
});

// ================ MODELS ================

// PG Listing Schema
const pgListingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: 'Unknown'
  },
  locality: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ['boys', 'girls', 'co-ed', 'family'],
    default: 'boys'
  },
  images: [String],
  amenities: [String],
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  published: {
    type: Boolean,
    default: false
  },
  verified: {
    type: Boolean,
    default: false
  },
  featured: {
    type: Boolean,
    default: false
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  ownerName: {
    type: String,
    default: ''
  },
  ownerPhone: {
    type: String,
    default: ''
  },
  ownerEmail: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Create indexes
pgListingSchema.index({ location: '2dsphere' });
pgListingSchema.index({ name: 'text', description: 'text', city: 'text', address: 'text' });

const PGListing = mongoose.model('PGListing', pgListingSchema);
console.log('✅ PGListing model registered');

// ================ ROUTES ================

// Root endpoint
app.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusText = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };
  
  return res.json({
    message: '🏠 PG Finder Backend API',
    version: '2.0.0',
    status: 'running 🚀',
    database: statusText[dbStatus] || 'Unknown',
    timestamp: new Date().toISOString(),
    endpoints: {
      createPG: 'POST /api/pg',
      getPGs: 'GET /api/pg',
      health: 'GET /health',
      test: 'GET /api/test'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1;
  
  return res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: {
      connected: dbStatus,
      status: dbStatus ? 'connected' : 'disconnected',
      readyState: mongoose.connection.readyState
    },
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: process.platform
    }
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  return res.json({
    success: true,
    message: '✅ API is working!',
    data: {
      serverTime: new Date().toISOString(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Debug endpoint
app.post('/api/debug', (req, res) => {
  console.log('🐛 Debug Request:', req.body);
  
  return res.json({
    success: true,
    message: 'Debug endpoint',
    received: req.body,
    timestamp: new Date().toISOString(),
    databaseStatus: mongoose.connection.readyState
  });
});

// Database testing endpoint
app.get('/api/db-test', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: false,
        message: 'Database not connected',
        readyState: mongoose.connection.readyState
      });
    }
    
    // Count existing listings
    const count = await PGListing.countDocuments();
    
    // Create a test document
    const testDoc = new PGListing({
      name: 'Database Test PG',
      city: 'Test City',
      price: 9999,
      type: 'boys',
      description: 'This is a test document to verify database connection',
      amenities: ['Test', 'Database'],
      published: false
    });
    
    const savedDoc = await testDoc.save();
    
    // Count again
    const newCount = await PGListing.countDocuments();
    
    // Delete test document
    await PGListing.findByIdAndDelete(savedDoc._id);
    
    return res.json({
      success: true,
      message: 'Database test completed successfully',
      data: {
        initialCount: count,
        savedDocumentId: savedDoc._id,
        finalCount: newCount - 1,
        testDocument: savedDoc
      }
    });
    
  } catch (error) {
    console.error('❌ Database test error:', error);
    return res.status(500).json({
      success: false,
      message: 'Database test failed',
      error: error.message
    });
  }
});

// ================ PG LISTINGS ROUTES ================

// GET all PG listings
app.get('/api/pg', async (req, res) => {
  try {
    console.log('📋 GET /api/pg');
    
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ MongoDB not connected, returning empty array');
      return res.json({
        success: true,
        message: 'MongoDB not connected',
        count: 0,
        data: []
      });
    }
    
    // Build query
    const query = {};
    
    if (req.query.type && req.query.type !== 'all') {
      query.type = req.query.type;
    }
    
    if (req.query.city) {
      query.city = { $regex: req.query.city, $options: 'i' };
    }
    
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { address: { $regex: req.query.search, $options: 'i' } },
        { city: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Fetch from database
    const listings = await PGListing.find(query).sort({ createdAt: -1 });
    
    console.log(`✅ Found ${listings.length} listings from database`);
    
    return res.json({
      success: true,
      count: listings.length,
      data: listings
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

// CREATE new PG listing
app.post('/api/pg', async (req, res) => {
  try {
    console.log('➕ POST /api/pg');
    console.log('Request body:', req.body);
    
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.log('❌ MongoDB not connected');
      return res.status(500).json({
        success: false,
        message: 'Database not connected',
        readyState: mongoose.connection.readyState
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
    
    // Create listing data
    const listingData = {
      name: req.body.name,
      description: req.body.description || '',
      city: req.body.city || 'Unknown',
      locality: req.body.locality || '',
      address: req.body.address || '',
      price: Number(req.body.price),
      type: req.body.type || 'boys',
      images: req.body.images || [],
      amenities: req.body.amenities || [],
      location: req.body.location || {
        type: 'Point',
        coordinates: [0, 0]
      },
      published: req.body.published || false,
      verified: req.body.verified || false,
      featured: req.body.featured || false,
      rating: req.body.rating || 0,
      reviewCount: req.body.reviewCount || 0,
      ownerName: req.body.ownerName || '',
      ownerPhone: req.body.ownerPhone || '',
      ownerEmail: req.body.ownerEmail || ''
    };
    
    // Create and save listing
    const newListing = new PGListing(listingData);
    const savedListing = await newListing.save();
    
    console.log('✅ Listing saved to MongoDB with ID:', savedListing._id);
    console.log('📄 Saved data:', savedListing);
    
    return res.status(201).json({
      success: true,
      message: 'PG listing created successfully',
      data: savedListing
    });
    
  } catch (error) {
    console.error('❌ Error creating listing:', error);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create listing',
      error: error.message
    });
  }
});

// GET single listing by ID
app.get('/api/pg/:id', async (req, res) => {
  try {
    console.log('🔍 GET /api/pg/:id', req.params.id);
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    const listing = await PGListing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    return res.json({
      success: true,
      data: listing
    });
    
  } catch (error) {
    console.error('❌ Error fetching listing:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message
    });
  }
});

// UPDATE listing by ID
app.put('/api/pg/:id', async (req, res) => {
  try {
    console.log('✏️ PUT /api/pg/:id', req.params.id);
    console.log('Update data:', req.body);
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    const updatedListing = await PGListing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedListing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
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
      message: 'Server error',
      error: error.message
    });
  }
});

// DELETE listing by ID
app.delete('/api/pg/:id', async (req, res) => {
  try {
    console.log('🗑️ DELETE /api/pg/:id', req.params.id);
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    const deletedListing = await PGListing.findByIdAndDelete(req.params.id);
    
    if (!deletedListing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    console.log('✅ Listing deleted:', req.params.id);
    
    return res.json({
      success: true,
      message: 'Listing deleted successfully',
      data: { id: req.params.id }
    });
    
  } catch (error) {
    console.error('❌ Error deleting listing:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message
    });
  }
});

// ================ ERROR HANDLERS ================

// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Global Error Handler:', err.message);
  console.error(err.stack);
  
  return res.status(err.status || 500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler - MUST BE LAST
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
      'GET  /api/test',
      'POST /api/debug',
      'GET  /api/db-test',
      'GET  /api/pg',
      'POST /api/pg',
      'GET  /api/pg/:id',
      'PUT  /api/pg/:id',
      'DELETE /api/pg/:id'
    ]
  });
});

// ================ START SERVER ================

const PORT = process.env.PORT || 5000;

const startServer = () => {
  const server = app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 MongoDB Status: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
    
    console.log('\n📋 Available Endpoints:');
    console.log(`  🔗 API Base: http://localhost:${PORT}/api`);
    console.log(`  🏠 Home:      http://localhost:${PORT}/`);
    console.log(`  ❤️  Health:    http://localhost:${PORT}/health`);
    console.log(`  🧪 Test:      http://localhost:${PORT}/api/test`);
    console.log(`  🐛 Debug:     http://localhost:${PORT}/api/debug`);
    console.log(`  🗄️  DB Test:   http://localhost:${PORT}/api/db-test`);
    console.log(`  🏢 PG Listings:`);
    console.log(`    GET    http://localhost:${PORT}/api/pg`);
    console.log(`    POST   http://localhost:${PORT}/api/pg`);
    console.log(`    GET    http://localhost:${PORT}/api/pg/:id`);
    console.log(`    PUT    http://localhost:${PORT}/api/pg/:id`);
    console.log(`    DELETE http://localhost:${PORT}/api/pg/:id`);
    
    console.log('\n🎯 Testing Commands:');
    console.log('  # Create PG listing:');
    console.log(`    curl -X POST http://localhost:${PORT}/api/pg \\`);
    console.log(`      -H "Content-Type: application/json" \\`);
    console.log(`      -d \'{"name":"Test PG","city":"Delhi","price":5000,"type":"boys"}\'`);
    console.log('\n  # Get all listings:');
    console.log(`    curl http://localhost:${PORT}/api/pg`);
    
    console.log('\n📌 Press Ctrl+C to stop the server\n');
  });
  
  return server;
};

// Start server
const server = startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server gracefully...');
  
  server.close(() => {
    console.log('✅ HTTP server closed');
  });
  
  mongoose.connection.close(false, () => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

// Export app for testing
module.exports = app;








// // src/server.js - WORKING VERSION
// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');

// const app = express();

// // Middleware
// app.use(cors({
//   origin: ['http://localhost:3000', 'http://localhost:5173'],
//   credentials: true
// }));
// app.use(express.json());

// // Mock data for fallback
// const mockPGs = [
//   {
//     _id: '1',
//     name: 'Shanti PG for Boys',
//     description: 'Peaceful accommodation near University',
//     city: 'Delhi',
//     locality: 'North Campus',
//     price: 8000,
//     type: 'boys',
//     featured: true,
//     images: [],
//     amenities: ['WiFi', 'AC', 'Food', 'Laundry'],
//     rating: 4.5,
//     reviewCount: 12
//   },
//   {
//     _id: '2',
//     name: 'Girls Safe PG',
//     description: 'Secure and comfortable girls PG',
//     city: 'Delhi',
//     locality: 'South Campus',
//     price: 9000,
//     type: 'girls',
//     featured: true,
//     images: [],
//     amenities: ['WiFi', 'Food', 'Security', 'Hot Water'],
//     rating: 4.2,
//     reviewCount: 8
//   },
//   {
//     _id: '3',
//     name: 'Co-ed Modern PG',
//     description: 'Modern PG with all facilities',
//     city: 'Delhi',
//     locality: 'Dwarka',
//     price: 10000,
//     type: 'co-ed',
//     featured: true,
//     images: [],
//     amenities: ['WiFi', 'AC', 'Gym', 'Food', 'Laundry'],
//     rating: 4.8,
//     reviewCount: 15
//   }
// ];

// // MongoDB Connection
// const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pgfinder';

// console.log('🔌 Connecting to MongoDB...');
// console.log(`MongoDB URI: ${MONGODB_URI}`);

// mongoose.connect(MONGODB_URI)
//   .then(() => {
//     console.log('✅ MongoDB Connected Successfully!');
//   })
//   .catch(err => {
//     console.log('⚠️ MongoDB Connection Failed:', err.message);
//     console.log('📝 Using mock data for now...');
//   });

// // PG Schema
// const pgListingSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   description: {
//     type: String,
//     default: ''
//   },
//   city: {
//     type: String,
//     default: 'Delhi'
//   },
//   locality: {
//     type: String,
//     default: ''
//   },
//   price: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   type: {
//     type: String,
//     enum: ['boys', 'girls', 'co-ed', 'family'],
//     default: 'boys'
//   },
//   featured: {
//     type: Boolean,
//     default: false
//   },
//   images: [String],
//   amenities: [String],
//   rating: {
//     type: Number,
//     default: 0,
//     min: 0,
//     max: 5
//   },
//   reviewCount: {
//     type: Number,
//     default: 0
//   }
// }, { timestamps: true });

// const PGListing = mongoose.models.PGListing || mongoose.model('PGListing', pgListingSchema);

// // Log requests
// app.use((req, res, next) => {
//   console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
//   next();
// });

// // ============ ROUTES ============

// // Home route
// app.get('/', (req, res) => {
//   res.json({ 
//     message: '🏠 PG Finder Backend API',
//     version: '1.0.0',
//     status: 'running 🚀',
//     database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
//     timestamp: new Date().toISOString(),
//     endpoints: {
//       getPGs: 'GET /api/pg',
//       getFeaturedPGs: 'GET /api/pg?featured=true',
//       createPG: 'POST /api/pg',
//       health: 'GET /health'
//     }
//   });
// });

// // Health check
// app.get('/health', (req, res) => {
//   res.json({
//     status: 'healthy',
//     timestamp: new Date().toISOString(),
//     database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
//   });
// });

// // Test endpoint
// app.get('/api/test', (req, res) => {
//   res.json({
//     success: true,
//     message: '✅ API is working!',
//     data: {
//       serverTime: new Date().toISOString(),
//       nodeVersion: process.version
//     }
//   });
// });

// // GET all PG listings
// app.get('/api/pg', async (req, res) => {
//   try {
//     console.log('📋 GET /api/pg', req.query);
    
//     // Check if MongoDB is connected
//     if (mongoose.connection.readyState !== 1) {
//       console.log('⚠️ MongoDB not connected, using mock data');
      
//       let data = [...mockPGs];
      
//       // Apply filters to mock data
//       if (req.query.featured === 'true') {
//         data = data.filter(pg => pg.featured === true);
//         console.log(`Filtered ${data.length} featured PGs from mock data`);
//       }
      
//       if (req.query.type && req.query.type !== 'all') {
//         data = data.filter(pg => pg.type === req.query.type);
//       }
      
//       if (req.query.city) {
//         data = data.filter(pg => 
//           pg.city.toLowerCase().includes(req.query.city.toLowerCase())
//         );
//       }
      
//       return res.json({
//         success: true,
//         message: 'Using mock data',
//         count: data.length,
//         data: data
//       });
//     }
    
//     // Build query for MongoDB
//     const query = {};
    
//     if (req.query.featured === 'true') {
//       query.featured = true;
//       console.log('🔍 Filtering for featured PGs');
//     }
    
//     if (req.query.type && req.query.type !== 'all') {
//       query.type = req.query.type;
//     }
    
//     if (req.query.city) {
//       query.city = { $regex: req.query.city, $options: 'i' };
//     }
    
//     if (req.query.search) {
//       query.$or = [
//         { name: { $regex: req.query.search, $options: 'i' } },
//         { description: { $regex: req.query.search, $options: 'i' } },
//         { locality: { $regex: req.query.search, $options: 'i' } }
//       ];
//     }
    
//     console.log('Database query:', query);
    
//     // Fetch from MongoDB
//     let listings = await PGListing.find(query).sort({ createdAt: -1 });
    
//     console.log(`✅ Found ${listings.length} listings from database`);
    
//     // If no featured PGs found but featured filter is on, use mock data
//     if (req.query.featured === 'true' && listings.length === 0) {
//       console.log('No featured PGs in DB, using mock data');
//       const featuredMock = mockPGs.filter(pg => pg.featured === true);
//       return res.json({
//         success: true,
//         message: 'Using mock data - no featured PGs in database',
//         count: featuredMock.length,
//         data: featuredMock
//       });
//     }
    
//     return res.json({
//       success: true,
//       count: listings.length,
//       data: listings
//     });
    
//   } catch (error) {
//     console.error('❌ Error fetching listings:', error);
    
//     // Fallback to mock data on any error
//     let data = [...mockPGs];
    
//     if (req.query.featured === 'true') {
//       data = data.filter(pg => pg.featured === true);
//     }
    
//     return res.json({
//       success: true,
//       message: 'Using fallback data due to error',
//       count: data.length,
//       data: data
//     });
//   }
// });

// // CREATE PG listing
// app.post('/api/pg', async (req, res) => {
//   try {
//     console.log('➕ POST /api/pg');
//     console.log('Request body:', req.body);
    
//     if (mongoose.connection.readyState !== 1) {
//       return res.status(500).json({
//         success: false,
//         message: 'Database not connected'
//       });
//     }
    
//     // Validate required fields
//     if (!req.body.name || !req.body.price) {
//       return res.status(400).json({
//         success: false,
//         message: 'Name and price are required'
//       });
//     }
    
//     const newPG = new PGListing({
//       name: req.body.name,
//       description: req.body.description || '',
//       city: req.body.city || 'Delhi',
//       locality: req.body.locality || '',
//       price: Number(req.body.price),
//       type: req.body.type || 'boys',
//       featured: req.body.featured || false,
//       images: req.body.images || [],
//       amenities: req.body.amenities || [],
//       rating: req.body.rating || 0,
//       reviewCount: req.body.reviewCount || 0
//     });
    
//     const savedPG = await newPG.save();
    
//     console.log('✅ PG saved to database:', savedPG._id);
    
//     res.status(201).json({
//       success: true,
//       message: 'PG listing created successfully',
//       data: savedPG
//     });
    
//   } catch (error) {
//     console.error('❌ Error creating PG:', error);
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// });

// // GET single PG by ID
// app.get('/api/pg/:id', async (req, res) => {
//   try {
//     console.log('🔍 GET /api/pg/:id', req.params.id);
    
//     if (mongoose.connection.readyState !== 1) {
//       // Find in mock data
//       const mockPG = mockPGs.find(pg => pg._id === req.params.id);
//       if (mockPG) {
//         return res.json({
//           success: true,
//           data: mockPG
//         });
//       }
//       return res.status(404).json({
//         success: false,
//         message: 'PG not found'
//       });
//     }
    
//     const pg = await PGListing.findById(req.params.id);
    
//     if (!pg) {
//       return res.status(404).json({
//         success: false,
//         message: 'PG not found'
//       });
//     }
    
//     res.json({
//       success: true,
//       data: pg
//     });
    
//   } catch (error) {
//     console.error('Error fetching PG:', error);
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// });

// // Database test endpoint
// app.get('/api/db-test', async (req, res) => {
//   try {
//     if (mongoose.connection.readyState !== 1) {
//       return res.json({
//         success: false,
//         message: 'Database not connected',
//         readyState: mongoose.connection.readyState
//       });
//     }
    
//     // Create a test PG
//     const testPG = new PGListing({
//       name: 'Test PG for Database',
//       description: 'This is a test PG to verify database connection',
//       city: 'Test City',
//       price: 5000,
//       type: 'boys',
//       featured: true
//     });
    
//     const savedPG = await testPG.save();
    
//     // Count all PGs
//     const count = await PGListing.countDocuments();
    
//     // Delete test PG
//     await PGListing.findByIdAndDelete(savedPG._id);
    
//     res.json({
//       success: true,
//       message: 'Database test successful',
//       data: {
//         testId: savedPG._id,
//         totalPGs: count - 1
//       }
//     });
    
//   } catch (error) {
//     console.error('Database test error:', error);
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// });

// // 404 handler
// app.use('*', (req, res) => {
//   res.status(404).json({
//     success: false,
//     message: 'Endpoint not found',
//     path: req.originalUrl
//   });
// });

// // Error handler
// app.use((err, req, res, next) => {
//   console.error('🚨 Server error:', err);
//   res.status(500).json({
//     success: false,
//     message: 'Internal server error',
//     error: process.env.NODE_ENV === 'development' ? err.message : undefined
//   });
// });

// // Start server
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`\n🚀 Server running on http://localhost:${PORT}`);
//   console.log(`📊 MongoDB Status: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
//   console.log('\n📋 Available Endpoints:');
//   console.log(`  🔗 Home: http://localhost:${PORT}/`);
//   console.log(`  ❤️  Health: http://localhost:${PORT}/health`);
//   console.log(`  🧪 Test: http://localhost:${PORT}/api/test`);
//   console.log(`  🏢 All PGs: http://localhost:${PORT}/api/pg`);
//   console.log(`  ⭐ Featured PGs: http://localhost:${PORT}/api/pg?featured=true`);
//   console.log(`  🗄️  DB Test: http://localhost:${PORT}/api/db-test`);
//   console.log('\n🎯 Quick Test:');
//   console.log(`  curl http://localhost:${PORT}/api/pg?featured=true`);
//   console.log('\n📌 Press Ctrl+C to stop\n');
// });