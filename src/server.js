// server.js - MongoDB Atlas Version
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

// ================ MONGODB ATLAS CONNECTION ================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://deep:deep123@cluster0.veuok.mongodb.net/pgfinder?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔌 Attempting MongoDB Atlas connection...');
console.log(`MongoDB URI: ${MONGODB_URI.replace(/deep:deep123@/, 'USER:PASSWORD@')}`); // Hide password in logs

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds
})
  .then(() => {
    console.log('✅ MongoDB Atlas Connected Successfully!');
    console.log(`Database: ${mongoose.connection.name}`);
    console.log(`Host: ${mongoose.connection.host}`);
    
    // List all collections
    mongoose.connection.db.listCollections().toArray()
      .then(collections => {
        console.log('\n📁 Available Collections:');
        if (collections.length === 0) {
          console.log('  (No collections found)');
        } else {
          collections.forEach(col => {
            console.log(`  - ${col.name}`);
          });
        }
      })
      .catch(err => {
        console.log('⚠️ Could not list collections:', err.message);
      });
  })
  .catch(err => {
    console.error('❌ MongoDB Atlas Connection Error:', err.message);
    console.log('⚠️ Make sure:');
    console.log('  1. Your internet connection is working');
    console.log('  2. MongoDB Atlas cluster is running');
    console.log('  3. IP address is whitelisted in Atlas');
    console.log('  4. Username and password are correct');
    console.log('⚠️ Running in fallback mode - Using local data');
  });

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected from MongoDB Atlas');
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
    atlas: 'MongoDB Atlas',
    timestamp: new Date().toISOString(),
    endpoints: {
      createPG: 'POST /api/pg',
      getPGs: 'GET /api/pg',
      health: 'GET /health',
      test: 'GET /api/test',
      getSingle: 'GET /api/pg/:id'
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
      atlas: true,
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
      environment: process.env.NODE_ENV || 'development',
      database: mongoose.connection.readyState === 1 ? 'Connected to MongoDB Atlas' : 'Not connected'
    }
  });
});

// Test database connection
app.get('/api/db-test', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: false,
        message: 'Database not connected to MongoDB Atlas',
        readyState: mongoose.connection.readyState
      });
    }
    
    // Count existing listings
    const count = await PGListing.countDocuments();
    
    // Create a test document
    const testDoc = new PGListing({
      name: 'Test PG - MongoDB Atlas',
      city: 'Test City',
      price: 9999,
      type: 'boys',
      description: 'Test document created at: ' + new Date().toISOString(),
      amenities: ['Test', 'Database', 'Atlas'],
      published: false,
      ownerName: 'Test Owner',
      ownerPhone: '1234567890'
    });
    
    const savedDoc = await testDoc.save();
    
    // Count again
    const newCount = await PGListing.countDocuments();
    
    // Get all documents
    const allDocs = await PGListing.find({}).limit(5);
    
    // Delete test document
    await PGListing.findByIdAndDelete(savedDoc._id);
    
    return res.json({
      success: true,
      message: 'MongoDB Atlas test completed successfully!',
      data: {
        connection: 'MongoDB Atlas',
        initialCount: count,
        savedDocumentId: savedDoc._id,
        finalCount: newCount - 1,
        recentDocuments: allDocs,
        testDocument: savedDoc
      }
    });
    
  } catch (error) {
    console.error('❌ MongoDB Atlas test error:', error);
    return res.status(500).json({
      success: false,
      message: 'Database test failed',
      error: error.message,
      help: 'Check your MongoDB Atlas connection string and network'
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
      console.log('⚠️ MongoDB Atlas not connected, returning mock data');
      
      // Return mock data when database is not connected
      const mockData = [
        {
          _id: 'mock-1',
          name: 'Premium Boys PG Near CU',
          city: 'Chandigarh',
          price: 8500,
          type: 'boys',
          description: 'Premium accommodation for boys near Chandigarh University',
          images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'],
          amenities: ['WiFi', 'AC', 'Meals', 'Parking'],
          rating: 4.5,
          reviewCount: 42,
          ownerName: 'Rajesh Kumar',
          ownerPhone: '9876543210',
          createdAt: new Date()
        },
        {
          _id: 'mock-2',
          name: 'Co-Ed PG for Students',
          city: 'Chandigarh',
          price: 7500,
          type: 'co-ed',
          description: 'Comfortable co-ed PG with all facilities',
          images: ['https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800'],
          amenities: ['WiFi', 'Meals', 'Laundry', 'Study Room'],
          rating: 4.2,
          reviewCount: 28,
          ownerName: 'Priya Sharma',
          ownerPhone: '9876543211',
          createdAt: new Date()
        }
      ];
      
      return res.json({
        success: true,
        message: 'Using mock data (MongoDB Atlas not connected)',
        count: mockData.length,
        data: mockData
      });
    }
    
    // Build query for database
    const query = { published: true };
    
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
    
    // Fetch from MongoDB Atlas
    const listings = await PGListing.find(query).sort({ createdAt: -1 });
    
    console.log(`✅ Found ${listings.length} listings from MongoDB Atlas`);
    
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
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.log('❌ MongoDB Atlas not connected');
      return res.status(500).json({
        success: false,
        message: 'MongoDB Atlas not connected',
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
      city: req.body.city || 'Chandigarh',
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
      published: req.body.published !== undefined ? req.body.published : true,
      verified: req.body.verified || false,
      featured: req.body.featured || false,
      rating: req.body.rating || 0,
      reviewCount: req.body.reviewCount || 0,
      ownerName: req.body.ownerName || '',
      ownerPhone: req.body.ownerPhone || '',
      ownerEmail: req.body.ownerEmail || ''
    };
    
    // Create and save listing to MongoDB Atlas
    const newListing = new PGListing(listingData);
    const savedListing = await newListing.save();
    
    console.log('✅ Listing saved to MongoDB Atlas with ID:', savedListing._id);
    
    return res.status(201).json({
      success: true,
      message: 'PG listing created successfully in MongoDB Atlas',
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

// GET single listing by ID
app.get('/api/pg/:id', async (req, res) => {
  try {
    console.log('🔍 GET /api/pg/:id', req.params.id);
    
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ MongoDB Atlas not connected, returning mock data');
      
      // Return mock data when database is not connected
      const mockData = {
        _id: req.params.id,
        name: 'Premium Boys PG Near CU',
        description: 'Premium accommodation for boys near Chandigarh University. Features spacious rooms, high-speed WiFi, nutritious meals, and 24/7 security. Perfect for students looking for a comfortable and safe living environment.',
        city: 'Chandigarh',
        address: 'Gate 1, Chandigarh University Road, Gharuan, Punjab',
        price: 8500,
        type: 'boys',
        images: [
          'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop&q=80'
        ],
        amenities: ['WiFi', 'AC', 'Meals', 'Parking', 'CCTV', 'Power Backup', 'Laundry', 'Hot Water', 'Study Room'],
        verified: true,
        featured: true,
        rating: 4.5,
        reviewCount: 128,
        ownerName: 'Rajesh Kumar',
        ownerPhone: '9315058665',
        ownerEmail: 'rajesh.cupg@gmail.com',
        createdAt: new Date().toISOString(),
        distance: '500m from CU Gate 1',
        locality: 'Gate 1 Area'
      };
      
      return res.json({
        success: true,
        message: 'Using mock data (MongoDB Atlas not connected)',
        data: mockData
      });
    }
    
    const listing = await PGListing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found in MongoDB Atlas'
      });
    }
    
    console.log('✅ Found listing in MongoDB Atlas:', listing._id);
    
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

// Add some sample data endpoint
app.post('/api/pg/sample-data', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        message: 'MongoDB Atlas not connected'
      });
    }
    
    const sampleListings = [
      {
        name: 'Royal Boys PG',
        description: 'Luxurious boys PG with modern amenities near Chandigarh University',
        city: 'Chandigarh',
        address: 'Gate 2, CU Road',
        price: 9000,
        type: 'boys',
        images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'],
        amenities: ['WiFi', 'AC', 'Meals', 'Parking', 'Gym', 'Study Room'],
        published: true,
        verified: true,
        rating: 4.7,
        reviewCount: 56,
        ownerName: 'Amit Verma',
        ownerPhone: '9876543212'
      },
      {
        name: 'Sunshine Girls PG',
        description: 'Safe and secure girls PG with 24/7 security and CCTV',
        city: 'Chandigarh',
        address: 'Library Road, CU',
        price: 9500,
        type: 'girls',
        images: ['https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800'],
        amenities: ['WiFi', 'AC', 'Meals', 'CCTV', '24/7 Security', 'Hot Water'],
        published: true,
        verified: true,
        rating: 4.8,
        reviewCount: 89,
        ownerName: 'Sunita Devi',
        ownerPhone: '9876543213'
      },
      {
        name: 'Student Hub Co-Ed PG',
        description: 'Co-ed PG with study rooms and high-speed internet',
        city: 'Chandigarh',
        address: 'Sports Complex Road',
        price: 8000,
        type: 'co-ed',
        images: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800'],
        amenities: ['WiFi', 'Study Room', 'Library', 'Common Room', 'Laundry'],
        published: true,
        verified: true,
        rating: 4.3,
        reviewCount: 34,
        ownerName: 'Rohit Sharma',
        ownerPhone: '9876543214'
      }
    ];
    
    const savedListings = [];
    
    for (const listing of sampleListings) {
      const newListing = new PGListing(listing);
      const saved = await newListing.save();
      savedListings.push(saved);
    }
    
    return res.json({
      success: true,
      message: 'Sample data added to MongoDB Atlas',
      count: savedListings.length,
      data: savedListings
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

// ================ ERROR HANDLERS ================

// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Global Error Handler:', err.message);
  
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
      'GET  /api/db-test',
      'GET  /api/pg',
      'POST /api/pg',
      'POST /api/pg/sample-data',
      'GET  /api/pg/:id'
    ]
  });
});

// ================ START SERVER ================

const PORT = process.env.PORT || 5000;

const startServer = () => {
  const server = app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 MongoDB Atlas Status: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
    
    console.log('\n📋 Available Endpoints:');
    console.log(`  🔗 API Base: http://localhost:${PORT}/api`);
    console.log(`  🏠 Home:      http://localhost:${PORT}/`);
    console.log(`  ❤️  Health:    http://localhost:${PORT}/health`);
    console.log(`  🧪 Test:      http://localhost:${PORT}/api/test`);
    console.log(`  🗄️  DB Test:   http://localhost:${PORT}/api/db-test`);
    console.log(`  🏢 PG Listings:`);
    console.log(`    GET    http://localhost:${PORT}/api/pg`);
    console.log(`    POST   http://localhost:${PORT}/api/pg`);
    console.log(`    POST   http://localhost:${PORT}/api/pg/sample-data`);
    console.log(`    GET    http://localhost:${PORT}/api/pg/:id`);
    
    console.log('\n💡 Pro Tips:');
    console.log('  1. First visit: http://localhost:5000/api/db-test');
    console.log('  2. Add sample data: http://localhost:5000/api/pg/sample-data (POST)');
    console.log('  3. View all PGs: http://localhost:5000/api/pg');
    
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
    console.log('✅ MongoDB Atlas connection closed');
    process.exit(0);
  });
});

// Export app for testing
module.exports = app;