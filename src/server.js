




// server-fixed.js - Complete fixed version
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const PGListing = require('./models/PGListing'); // Import the model

const app = express();

// ================ CORS CONFIGURATION ================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://eassy-to-rent-startup.vercel.app',
  'https://easy-to-rent-startup.vercel.app',
  'https://pg-finder-frontend.vercel.app',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚫 CORS Blocked Origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.options('*', cors());

// ================ MIDDLEWARE ================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`\n${new Date().toISOString()} ${req.method} ${req.url}`);
  console.log('Origin:', req.headers.origin || 'No Origin Header');
  next();
});
// ================ MONGODB ATLAS CONNECTION ================
const MONGODB_URI = process.env.MONGO_URI || 'mongodb+srv://rsinghranjeet74282:Ranjeet123@cluster0.ibrwq.mongodb.net/pgfinder?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔌 Attempting MongoDB Atlas connection...');

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log('✅ MongoDB Atlas Connected Successfully!');
    console.log(`Database: ${mongoose.connection.name}`);
  })
  .catch(err => {
    console.error('❌ MongoDB Atlas Connection Error:', err.message);
    console.log('⚠️ Running in fallback mode');
  });
  
// ================ ROUTES ================
app.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  
  res.json({
    message: '🏠 PG Finder Backend API v2.1.0',
    status: 'running 🚀',
    database: dbStatus,
    timestamp: new Date().toISOString(),
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
      dbTest: 'GET /api/db-test'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1;
  return res.json({
    status: 'healthy',
    database: { connected: dbStatus },
    cors: { origin: req.headers.origin || 'No Origin' }
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  return res.json({
    success: true,
    message: '✅ API is working!',
    data: { serverTime: new Date().toISOString() }
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
      
      // Get one sample PG if exists
      const pgs = await PGListing.find({}).limit(1);
      if (pgs.length > 0) {
        samplePG = {
          id: pgs[0]._id,
          name: pgs[0].name,
          price: pgs[0].price
        };
      }
    }
    
    return res.json({
      success: true,
      database: {
        status: dbStatus === 1 ? 'connected' : 'disconnected',
        readyState: dbStatus,
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

// ================ CRUD OPERATIONS ================

// GET all PG listings - FIXED
app.get('/api/pg', async (req, res) => {
  try {
    console.log('📋 GET /api/pg');
    console.log('Database readyState:', mongoose.connection.readyState);
    
    // Try to get real data from database
    if (mongoose.connection.readyState === 1) {
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
      
      if (req.query.admin !== 'true') {
        query.published = true;
      }
      
      const listings = await PGListing.find(query).sort({ createdAt: -1 });
      
      console.log(`✅ Found ${listings.length} REAL listings from MongoDB Atlas`);
      
      if (listings.length > 0) {
        console.log('Sample listing IDs:', listings.slice(0, 3).map(l => l._id));
      }
      
      return res.json({
        success: true,
        count: listings.length,
        data: listings
      });
    }
    
    // If database not connected, return minimal sample data
    console.log('⚠️ MongoDB not connected, returning minimal sample data');
    
    const sampleData = [
      {
        _id: 'sample-1',
        name: 'Sample PG - Database not connected',
        city: 'Chandigarh',
        price: 8500,
        type: 'co-ed',
        description: 'Real data unavailable. Please check database connection.',
        images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'],
        amenities: ['WiFi', 'AC'],
        rating: 4.0,
        reviewCount: 0,
        ownerName: 'Sample',
        ownerPhone: '9315058665',
        address: 'Sample Address',
        verified: false,
        featured: false,
        published: true,
        createdAt: new Date()
      }
    ];
    
    return res.json({
      success: true,
      message: 'Using minimal sample data (database not connected)',
      count: sampleData.length,
      data: sampleData
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

// GET single listing by ID - FIXED TO SHOW REAL DATA
app.get('/api/pg/:id', async (req, res) => {
  try {
    console.log('🔍 GET /api/pg/:id', req.params.id);
    console.log('Database readyState:', mongoose.connection.readyState);
    
    // Validate ID
    if (!req.params.id || req.params.id === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'PG ID is required'
      });
    }
    
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Database not connected, returning sample data');
      
      const sampleData = {
        _id: req.params.id,
        name: 'Sample PG - Database Issue',
        description: 'Unable to connect to database. Please try again later.',
        city: 'Chandigarh',
        address: 'Database connection issue',
        price: 0,
        type: 'co-ed',
        images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'],
        amenities: ['Database not connected'],
        verified: false,
        featured: false,
        rating: 0,
        reviewCount: 0,
        ownerName: 'System',
        ownerPhone: '9315058665',
        contactPhone: '9315058665',
        contactEmail: 'support@example.com',
        googleMapLink: '',
        roomTypes: ['Single'],
        distance: 'Unknown',
        availability: 'unavailable',
        published: false,
        createdAt: new Date().toISOString(),
        gallery: []
      };
      
      return res.json({
        success: true,
        message: 'Database not connected',
        data: sampleData
      });
    }
    
    // Try to fetch from database
    console.log('🔍 Searching for PG in database with ID:', req.params.id);
    
    let listing;
    try {
      // First try with findById
      listing = await PGListing.findById(req.params.id);
      
      if (!listing) {
        // Try to find by any field containing the ID
        listing = await PGListing.findOne({
          $or: [
            { _id: req.params.id },
            { name: { $regex: req.params.id, $options: 'i' } }
          ]
        });
      }
    } catch (dbError) {
      console.log('❌ Database query error:', dbError.message);
    }
    
    if (listing) {
      console.log('✅ FOUND REAL LISTING IN DATABASE!');
      console.log('ID:', listing._id);
      console.log('Name:', listing.name);
      console.log('Price:', listing.price);
      console.log('Type:', listing.type);
      
      return res.json({
        success: true,
        message: 'Real data loaded from database',
        data: listing
      });
    }
    
    console.log('❌ Listing not found in database, checking if it might be a mock ID');
    
    // If not found and looks like a mock ID
    if (req.params.id.includes('mock') || req.params.id.includes('sample')) {
      const sampleData = {
        _id: req.params.id,
        name: 'Sample PG Listing',
        description: 'This is a sample PG listing for testing purposes.',
        city: 'Chandigarh',
        address: 'Sample Location',
        price: 8500,
        type: 'co-ed',
        images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'],
        amenities: ['WiFi', 'AC', 'Meals', 'Parking'],
        verified: true,
        featured: true,
        rating: 4.5,
        reviewCount: 128,
        ownerName: 'Sample Owner',
        ownerPhone: '9315058665',
        contactPhone: '9315058665',
        contactEmail: 'sample@example.com',
        googleMapLink: '',
        roomTypes: ['Single', 'Double', 'Triple'],
        distance: '500m from University',
        availability: 'available',
        published: true,
        createdAt: new Date().toISOString(),
        gallery: [
          'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800',
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w-800'
        ]
      };
      
      return res.json({
        success: true,
        message: 'Using sample data for mock ID',
        data: sampleData
      });
    }
    
    // If not found and not a mock ID
    console.log('❌ PG not found with ID:', req.params.id);
    
    return res.status(404).json({
      success: false,
      message: 'PG listing not found'
    });
    
  } catch (error) {
    console.error('❌ Error in GET /api/pg/:id:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid PG ID format'
      });
    }
    
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
    
    if (mongoose.connection.readyState !== 1) {
      console.log('❌ MongoDB not connected');
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
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
    
    const listingData = {
      name: req.body.name,
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
      contactPhone: req.body.contactPhone || '9315058665',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const newListing = new PGListing(listingData);
    const savedListing = await newListing.save();
    
    console.log('✅ REAL listing saved to database!');
    console.log('ID:', savedListing._id);
    console.log('Name:', savedListing.name);
    console.log('Price:', savedListing.price);
    
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

// UPDATE listing by ID
app.put('/api/pg/:id', async (req, res) => {
  try {
    console.log('✏️ PUT /api/pg/:id', req.params.id);
    
    if (mongoose.connection.readyState !== 1) {
      console.log('❌ MongoDB not connected');
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

// DELETE listing by ID
app.delete('/api/pg/:id', async (req, res) => {
  try {
    console.log('🗑️ DELETE /api/pg/:id', req.params.id);
    
    if (mongoose.connection.readyState !== 1) {
      console.log('❌ MongoDB not connected');
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

// PATCH endpoints (keep existing)
app.patch('/api/pg/:id/publish', async (req, res) => {
  try {
    const listingId = req.params.id;
    const published = req.body.published;
    
    if (mongoose.connection.readyState !== 1) {
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

app.patch('/api/pg/:id/feature', async (req, res) => {
  try {
    const listingId = req.params.id;
    const featured = req.body.featured;
    
    if (mongoose.connection.readyState !== 1) {
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

app.patch('/api/pg/:id/verify', async (req, res) => {
  try {
    const listingId = req.params.id;
    const verified = req.body.verified;
    
    if (mongoose.connection.readyState !== 1) {
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

// Add sample data endpoint
app.post('/api/pg/sample-data', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
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
    
    return res.json({
      success: true,
      message: 'Sample data added successfully',
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

// Search endpoint
app.get('/api/search', async (req, res) => {
  try {
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

// Stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
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
    
    return res.json({
      success: true,
      data: {
        totalPGs,
        boysPGs,
        girlsPGs,
        coedPGs,
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

// ================ ERROR HANDLERS ================
app.use((err, req, res, next) => {
  console.error('🚨 Global Error Handler:', err.message);
  
  return res.status(err.status || 500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
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

// ================ START SERVER ================
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 MongoDB Status: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
  
  console.log('\n📋 Available Endpoints:');
  console.log(`  🏠 Home:      http://localhost:${PORT}/`);
  console.log(`  ❤️  Health:    http://localhost:${PORT}/health`);
  console.log(`  🧪 Test:      http://localhost:${PORT}/api/test`);
  console.log(`  🔍 DB Test:   http://localhost:${PORT}/api/db-test`);
  console.log(`  🏢 PG List:   http://localhost:${PORT}/api/pg`);
  console.log(`  🔍 Search:    http://localhost:${PORT}/api/search?city=Chandigarh&type=boys`);
  console.log(`  📊 Stats:     http://localhost:${PORT}/api/stats`);
  console.log(`  📱 Frontend:  https://eassy-to-rent-startup.vercel.app`);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  server.close(() => {
    console.log('✅ HTTP server closed');
  });
  mongoose.connection.close(false, () => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

module.exports = app; 