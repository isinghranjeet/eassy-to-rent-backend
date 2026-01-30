require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const PGListing = require('./models/PGListing');

const app = express();

// ================ CORS CONFIGURATION - COMPLETELY OPEN ================
console.log('🛡️ Setting up CORS with wildcard access...');

// Option 1: Simple wildcard CORS (Recommended for now)
app.use(cors({
  origin: '*', // ✅ ALLOW EVERYTHING - TEMPORARY FIX
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 204,
  maxAge: 86400
}));

// Option 2: Debugging CORS middleware
app.use((req, res, next) => {
  console.log('\n' + '='.repeat(50));
  console.log(`🌍 ${new Date().toISOString()} ${req.method} ${req.url}`);
  console.log(`🌍 Origin: ${req.headers.origin || 'No Origin'}`);
  console.log(`🌍 Referer: ${req.headers.referer || 'No Referer'}`);
  console.log(`🌍 User-Agent: ${req.headers['user-agent']?.substring(0, 50) || 'Unknown'}`);
  
  // Set CORS headers manually
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    console.log('🛬 Handling OPTIONS preflight request');
    return res.status(204).end();
  }
  
  next();
});

// ================ MIDDLEWARE ================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ================ MONGODB ATLAS CONNECTION ================
const MONGODB_URI = process.env.MONGO_URI || 'mongodb+srv://rsinghranjeet74282:Ranjeet123@cluster0.ibrwq.mongodb.net/pgfinder?retryWrites=true&w=majority&appName=Cluster0';

console.log('\n🔌 Attempting MongoDB Atlas connection...');

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
})
  .then(() => {
    console.log('✅ MongoDB Atlas Connected Successfully!');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`📊 Host: ${mongoose.connection.host}`);
  })
  .catch(err => {
    console.error('❌ MongoDB Atlas Connection Error:', err.message);
  });

// ================ ROUTES ================

// Home route with CORS debug info
app.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  
  res.json({
    message: '🏠 PG Finder Backend API v2.2.0',
    status: 'running 🚀',
    database: dbStatus,
    cors: {
      enabled: true,
      origin: req.headers.origin || 'Unknown',
      method: req.method,
      timestamp: new Date().toISOString()
    },
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
      search: 'GET /api/search'
    }
  });
});

// Health check with detailed CORS info
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1;
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cors: {
      origin: req.headers.origin || 'No Origin Header',
      allowed: true,
      method: req.method
    },
    database: { 
      connected: dbStatus,
      readyState: mongoose.connection.readyState 
    },
    server: {
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  });
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: '✅ API is working perfectly!',
    data: { 
      serverTime: new Date().toISOString(),
      clientOrigin: req.headers.origin || 'Direct Access',
      clientIP: req.ip
    },
    cors: 'Enabled for all origins'
  });
});

// Database test endpoint
app.get('/api/db-test', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState;
    let pgCount = 0;
    let samplePG = null;
    
    if (dbStatus === 1) {
      pgCount = await PGListing.countDocuments({});
      
      const pgs = await PGListing.find({}).limit(1);
      if (pgs.length > 0) {
        samplePG = {
          id: pgs[0]._id,
          name: pgs[0].name,
          price: pgs[0].price,
          type: pgs[0].type,
          city: pgs[0].city
        };
      }
    }
    
    res.json({
      success: true,
      database: {
        status: dbStatus === 1 ? 'connected' : 'disconnected',
        readyState: dbStatus,
        totalPGs: pgCount,
        samplePG: samplePG,
        connectionString: MONGODB_URI ? 'Using Atlas connection' : 'Using fallback'
      },
      cors: {
        origin: req.headers.origin || 'No Origin',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ DB test error:', error);
    res.status(500).json({
      success: false,
      message: 'Database test failed',
      error: error.message,
      cors: 'Enabled'
    });
  }
});

// ================ MAIN PG LISTINGS ENDPOINT ================

// GET all PG listings - WITH CORS DEBUGGING
app.get('/api/pg', async (req, res) => {
  try {
    console.log('\n📋 GET /api/pg - Request Details:');
    console.log('🔗 Full URL:', req.protocol + '://' + req.get('host') + req.originalUrl);
    console.log('📍 Origin:', req.headers.origin || 'No Origin');
    console.log('📍 Referer:', req.headers.referer || 'No Referer');
    console.log('📍 Query Params:', req.query);
    
    // Set CORS headers explicitly for this route
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Expose-Headers', 'X-Total-Count, Content-Type');
    
    // Try to get real data from database
    if (mongoose.connection.readyState === 1) {
      const query = {};
      
      // Apply filters
      if (req.query.type && req.query.type !== 'all') {
        query.type = req.query.type;
      }
      
      if (req.query.city && req.query.city !== 'all') {
        query.city = { $regex: req.query.city, $options: 'i' };
      }
      
      if (req.query.search) {
        query.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { address: { $regex: req.query.search, $options: 'i' } },
          { city: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } },
          { locality: { $regex: req.query.search, $options: 'i' } }
        ];
      }
      
      if (req.query.admin !== 'true') {
        query.published = true;
      }
      
      const listings = await PGListing.find(query).sort({ createdAt: -1 }).limit(100);
      
      console.log(`✅ Found ${listings.length} REAL listings from MongoDB Atlas`);
      
      if (listings.length > 0) {
        console.log('📊 Sample listings:', listings.slice(0, 3).map(l => ({
          id: l._id,
          name: l.name,
          price: l.price,
          city: l.city,
          type: l.type
        })));
      }
      
      // Add CORS debug info to response
      const responseData = {
        success: true,
        count: listings.length,
        data: listings,
        debug: {
          timestamp: new Date().toISOString(),
          origin: req.headers.origin || 'Direct',
          database: 'MongoDB Atlas',
          queryUsed: query,
          cors: {
            enabled: true,
            origin: '*',
            method: 'GET'
          }
        }
      };
      
      return res.json(responseData);
    }
    
    // If database not connected, return helpful error
    console.log('⚠️ MongoDB not connected, returning error message');
    
    res.status(503).json({
      success: false,
      message: 'Database connection issue',
      debug: {
        databaseStatus: mongoose.connection.readyState,
        timestamp: new Date().toISOString(),
        cors: 'Enabled but database not connected'
      },
      suggestions: [
        'Check MongoDB Atlas connection',
        'Verify network connectivity',
        'Check if database has PGs published'
      ]
    });
    
  } catch (error) {
    console.error('❌ Error fetching listings:', error);
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching listings',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      debug: {
        timestamp: new Date().toISOString(),
        origin: req.headers.origin || 'Unknown',
        cors: 'Enabled'
      }
    });
  }
});

// GET single PG by ID
app.get('/api/pg/:id', async (req, res) => {
  try {
    console.log(`🔍 GET /api/pg/${req.params.id}`);
    console.log('Origin:', req.headers.origin || 'Direct');
    
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    
    const listingId = req.params.id;
    
    if (!listingId || listingId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'PG ID is required'
      });
    }
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected',
        cors: 'Enabled'
      });
    }
    
    let listing;
    
    // Try to find by ID
    if (mongoose.Types.ObjectId.isValid(listingId)) {
      listing = await PGListing.findById(listingId);
    }
    
    // If not found by ID, try to find by name or other fields
    if (!listing) {
      listing = await PGListing.findOne({
        $or: [
          { name: { $regex: listingId, $options: 'i' } },
          { slug: listingId }
        ]
      });
    }
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'PG listing not found',
        requestedId: listingId,
        cors: 'Enabled'
      });
    }
    
    res.json({
      success: true,
      data: listing,
      cors: {
        origin: req.headers.origin || 'Direct',
        allowed: true
      }
    });
    
  } catch (error) {
    console.error('Error fetching single PG:', error);
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
      cors: 'Enabled'
    });
  }
});

// CREATE new PG listing
app.post('/api/pg', async (req, res) => {
  try {
    console.log('➕ POST /api/pg');
    console.log('Origin:', req.headers.origin || 'Direct');
    console.log('Body length:', JSON.stringify(req.body).length);
    
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    // Validation
    if (!req.body.name || !req.body.name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'PG name is required'
      });
    }
    
    if (!req.body.price || isNaN(req.body.price)) {
      return res.status(400).json({
        success: false,
        message: 'Valid price is required'
      });
    }
    
    const listingData = {
      name: req.body.name.trim(),
      description: req.body.description || '',
      city: req.body.city || 'Chandigarh',
      locality: req.body.locality || '',
      address: req.body.address || '',
      price: Number(req.body.price),
      type: req.body.type || 'boys',
      images: Array.isArray(req.body.images) ? req.body.images : [],
      gallery: Array.isArray(req.body.gallery) ? req.body.gallery : [],
      googleMapLink: req.body.googleMapLink || '',
      amenities: Array.isArray(req.body.amenities) ? req.body.amenities : [],
      roomTypes: Array.isArray(req.body.roomTypes) ? req.body.roomTypes : ['Single', 'Double'],
      distance: req.body.distance || '',
      availability: req.body.availability || 'available',
      location: req.body.location || { type: 'Point', coordinates: [0, 0] },
      published: req.body.published !== undefined ? req.body.published : true,
      verified: req.body.verified || false,
      featured: req.body.featured || false,
      rating: req.body.rating || 0,
      reviewCount: req.body.reviewCount || 0,
      ownerName: req.body.ownerName || '',
      ownerPhone: req.body.ownerPhone || '',
      ownerEmail: req.body.ownerEmail || '',
      ownerId: req.body.ownerId || '',
      contactEmail: req.body.contactEmail || '',
      contactPhone: req.body.contactPhone || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const newListing = new PGListing(listingData);
    const savedListing = await newListing.save();
    
    console.log(`✅ PG created: ${savedListing.name} (₹${savedListing.price})`);
    
    res.status(201).json({
      success: true,
      message: 'PG listing created successfully',
      data: savedListing,
      cors: {
        origin: req.headers.origin || 'Direct',
        allowed: true
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating PG:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to create PG listing',
      error: error.message,
      cors: 'Enabled'
    });
  }
});

// UPDATE PG listing
app.put('/api/pg/:id', async (req, res) => {
  try {
    console.log(`✏️ PUT /api/pg/${req.params.id}`);
    
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
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
      'ownerEmail', 'ownerId', 'contactEmail', 'contactPhone'
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
    
    updateData.updatedAt = new Date();
    
    const updatedListing = await PGListing.findByIdAndUpdate(
      listingId,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      message: 'Listing updated successfully',
      data: updatedListing
    });
    
  } catch (error) {
    console.error('❌ Error updating listing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update listing',
      error: error.message
    });
  }
});

// DELETE PG listing
app.delete('/api/pg/:id', async (req, res) => {
  try {
    console.log(`🗑️ DELETE /api/pg/${req.params.id}`);
    
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
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
    
    res.json({
      success: true,
      message: 'Listing deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error deleting listing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete listing',
      error: error.message
    });
  }
});

// PATCH endpoints
app.patch('/api/pg/:id/publish', async (req, res) => {
  try {
    const listingId = req.params.id;
    const published = req.body.published;
    
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
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
    
    res.json({
      success: true,
      message: `Listing ${published ? 'published' : 'unpublished'} successfully`,
      data: updatedListing
    });
    
  } catch (error) {
    console.error('Error toggling publish:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update listing',
      error: error.message
    });
  }
});

app.patch('/api/pg/:id/feature', async (req, res) => {
  try {
    const listingId = req.params.id;
    const featured = req.body.featured;
    
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
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
    
    res.json({
      success: true,
      message: `Listing ${featured ? 'featured' : 'unfeatured'} successfully`,
      data: updatedListing
    });
    
  } catch (error) {
    console.error('Error toggling feature:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update listing',
      error: error.message
    });
  }
});

app.patch('/api/pg/:id/verify', async (req, res) => {
  try {
    const listingId = req.params.id;
    const verified = req.body.verified;
    
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
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
    
    res.json({
      success: true,
      message: `Listing ${verified ? 'verified' : 'unverified'} successfully`,
      data: updatedListing
    });
    
  } catch (error) {
    console.error('Error toggling verify:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update listing',
      error: error.message
    });
  }
});

// Add sample data endpoint
app.post('/api/pg/sample-data', async (req, res) => {
  try {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
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
        featured: true,
        rating: 4.7,
        reviewCount: 56,
        ownerName: 'Amit Verma',
        ownerPhone: '9315058665',
        contactPhone: '9315058665'
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
        featured: true,
        rating: 4.8,
        reviewCount: 89,
        ownerName: 'Sunita Devi',
        ownerPhone: '9315058665',
        contactPhone: '9315058665'
      }
    ];
    
    const savedListings = [];
    
    for (const listing of sampleListings) {
      const newListing = new PGListing(listing);
      const saved = await newListing.save();
      savedListings.push(saved);
    }
    
    res.json({
      success: true,
      message: 'Sample data added successfully',
      count: savedListings.length,
      data: savedListings
    });
    
  } catch (error) {
    console.error('❌ Error adding sample data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add sample data',
      error: error.message
    });
  }
});

// Search endpoint
app.get('/api/search', async (req, res) => {
  try {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    
    const { city, type, minPrice, maxPrice, amenities } = req.query;
    
    let query = {};
    
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
    
    query.published = true;
    
    const listings = await PGListing.find(query).sort({ featured: -1, rating: -1 });
    
    res.json({
      success: true,
      count: listings.length,
      data: listings,
      query: req.query
    });
    
  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
});

// Stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        data: {
          totalPGs: 0,
          boysPGs: 0,
          girlsPGs: 0,
          coedPGs: 0,
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
    const featuredPGs = await PGListing.countDocuments({ featured: true, published: true });
    const verifiedPGs = await PGListing.countDocuments({ verified: true, published: true });
    
    const avgPriceResult = await PGListing.aggregate([
      { $match: { published: true } },
      { $group: { _id: null, avgPrice: { $avg: "$price" } } }
    ]);
    
    const avgPrice = avgPriceResult.length > 0 ? Math.round(avgPriceResult[0].avgPrice) : 0;
    
    res.json({
      success: true,
      data: {
        totalPGs,
        boysPGs,
        girlsPGs,
        coedPGs,
        featuredPGs,
        verifiedPGs,
        avgPrice,
        lastUpdated: new Date().toISOString(),
        cors: {
          origin: req.headers.origin || 'Direct',
          allowed: true
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stats',
      error: error.message
    });
  }
});

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  console.log('🔬 CORS Test Request:', {
    origin: req.headers.origin,
    referer: req.headers.referer,
    method: req.method,
    url: req.url
  });
  
  res.json({
    success: true,
    message: 'CORS is working!',
    requestDetails: {
      origin: req.headers.origin || 'No Origin',
      referer: req.headers.referer || 'No Referer',
      timestamp: new Date().toISOString(),
      clientIP: req.ip
    },
    corsHeaders: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
});

// ================ ERROR HANDLERS ================
app.use((err, req, res, next) => {
  console.error('🚨 Global Error Handler:', err.message);
  console.error('Error Stack:', err.stack);
  
  // Set CORS headers even for errors
  res.header('Access-Control-Allow-Origin', '*');
  
  res.status(err.status || 500).json({
    success: false,
    message: 'Internal server error',
    error: err.message,
    cors: 'Enabled'
  });
});

// 404 handler
app.all('*', (req, res) => {
  console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
  console.log('Origin:', req.headers.origin || 'Direct');
  
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  
  res.status(404).json({
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
      'GET  /api/pg/:id',
      'PUT  /api/pg/:id',
      'DELETE /api/pg/:id',
      'GET  /api/search',
      'GET  /api/stats',
      'GET  /api/cors-test'
    ],
    cors: 'Enabled for all origins'
  });
});

// ================ START SERVER ================
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 MongoDB Status: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
  console.log(`🛡️ CORS Policy: All origins allowed (*)`);
  console.log('='.repeat(60));
  
  console.log('\n📋 Available Endpoints:');
  console.log(`  🏠 Home:        http://localhost:${PORT}/`);
  console.log(`  ❤️  Health:      http://localhost:${PORT}/health`);
  console.log(`  🧪 Test:        http://localhost:${PORT}/api/test`);
  console.log(`  🔍 DB Test:     http://localhost:${PORT}/api/db-test`);
  console.log(`  🛡️ CORS Test:   http://localhost:${PORT}/api/cors-test`);
  console.log(`  🏢 PG List:     http://localhost:${PORT}/api/pg`);
  console.log(`  🔍 Search:      http://localhost:${PORT}/api/search?city=Chandigarh&type=boys`);
  console.log(`  📊 Stats:       http://localhost:${PORT}/api/stats`);
  console.log(`  📱 Frontend:    https://eassy-to-rent-startup.vercel.app`);
  console.log(`  🌐 Backend URL: https://eassy-to-rent-backend.onrender.com`);
  console.log('\n' + '='.repeat(60));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = app;