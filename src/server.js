// // server.js - Complete version with all CRUD operations
// require('dotenv').config();
// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const PGListing = require('./models/PGListing'); // Import the model

// const app = express();

// // CORS configuration
// app.use(cors({
//   origin: ['http://localhost:3000', 'http://localhost:5173'],
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));

// // Body parsing middleware
// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// // Request logging middleware
// app.use((req, res, next) => {
//   console.log(`\n${new Date().toISOString()} ${req.method} ${req.url}`);
//   if (req.body && Object.keys(req.body).length > 0) {
//     console.log('📦 Request Body:', JSON.stringify(req.body).substring(0, 200));
//   }
//   next();
// });

// // ================ MONGODB ATLAS CONNECTION ================

// const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://deep:deep123@cluster0.veuok.mongodb.net/pgfinder?retryWrites=true&w=majority&appName=Cluster0';

// console.log('🔌 Attempting MongoDB Atlas connection...');
// console.log(`MongoDB URI: ${MONGODB_URI.replace(/deep:deep123@/, 'USER:PASSWORD@')}`); // Hide password in logs

// mongoose.connect(MONGODB_URI, {
//   serverSelectionTimeoutMS: 10000, // Increased timeout to 10 seconds
//   socketTimeoutMS: 45000,
// })
//   .then(() => {
//     console.log('✅ MongoDB Atlas Connected Successfully!');
//     console.log(`Database: ${mongoose.connection.name}`);
    
//     // List all collections
//     mongoose.connection.db.listCollections().toArray()
//       .then(collections => {
//         console.log('\n📁 Available Collections:');
//         if (collections.length === 0) {
//           console.log('  (No collections found)');
//         } else {
//           collections.forEach(col => {
//             console.log(`  - ${col.name}`);
//           });
//         }
//       })
//       .catch(err => {
//         console.log('⚠️ Could not list collections:', err.message);
//       });
//   })
//   .catch(err => {
//     console.error('❌ MongoDB Atlas Connection Error:', err.message);
//     console.log('⚠️ Running in fallback mode');
//   });

// // ================ ROUTES ================

// // Root endpoint
// app.get('/', (req, res) => {
//   return res.json({
//     message: '🏠 PG Finder Backend API',
//     version: '2.0.0',
//     status: 'running 🚀',
//     database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
//     endpoints: {
//       createPG: 'POST /api/pg',
//       getPGs: 'GET /api/pg',
//       getSinglePG: 'GET /api/pg/:id',
//       updatePG: 'PUT /api/pg/:id',
//       deletePG: 'DELETE /api/pg/:id',
//       publishPG: 'PATCH /api/pg/:id/publish',
//       featurePG: 'PATCH /api/pg/:id/feature',
//       verifyPG: 'PATCH /api/pg/:id/verify',
//       health: 'GET /health',
//       test: 'GET /api/test',
//       sampleData: 'POST /api/pg/sample-data'
//     }
//   });
// });

// // Health check
// app.get('/health', (req, res) => {
//   const dbStatus = mongoose.connection.readyState === 1;
  
//   return res.json({
//     status: 'healthy',
//     database: {
//       connected: dbStatus,
//       atlas: true,
//       readyState: mongoose.connection.readyState
//     },
//     server: {
//       uptime: process.uptime(),
//       memory: process.memoryUsage(),
//       platform: process.platform
//     }
//   });
// });

// // Test endpoint
// app.get('/api/test', (req, res) => {
//   return res.json({
//     success: true,
//     message: '✅ API is working!',
//     data: {
//       serverTime: new Date().toISOString(),
//       nodeVersion: process.version,
//       environment: process.env.NODE_ENV || 'development',
//       database: mongoose.connection.readyState === 1 ? 'Connected to MongoDB Atlas' : 'Not connected'
//     }
//   });
// });

// // Test database connection
// app.get('/api/db-test', async (req, res) => {
//   try {
//     if (mongoose.connection.readyState !== 1) {
//       return res.json({
//         success: false,
//         message: 'Database not connected',
//         readyState: mongoose.connection.readyState
//       });
//     }
    
//     const count = await PGListing.countDocuments();
    
//     return res.json({
//       success: true,
//       message: 'MongoDB Atlas is connected!',
//       data: {
//         connection: 'MongoDB Atlas',
//         collectionCount: count,
//         collections: await mongoose.connection.db.listCollections().toArray().then(cols => cols.map(c => c.name))
//       }
//     });
    
//   } catch (error) {
//     console.error('❌ MongoDB Atlas test error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Database test failed',
//       error: error.message
//     });
//   }
// });

// // ================ CRUD OPERATIONS ================

// // GET all PG listings
// app.get('/api/pg', async (req, res) => {
//   try {
//     console.log('📋 GET /api/pg');
    
//     if (mongoose.connection.readyState !== 1) {
//       console.log('⚠️ MongoDB Atlas not connected, returning mock data');
      
//       const mockData = [
//         {
//           _id: 'mock-1',
//           name: 'Premium Boys PG Near CU',
//           city: 'Chandigarh',
//           price: 8500,
//           type: 'boys',
//           description: 'Premium accommodation for boys near Chandigarh University',
//           images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'],
//           amenities: ['WiFi', 'AC', 'Meals', 'Parking'],
//           rating: 4.5,
//           reviewCount: 42,
//           ownerName: 'Rajesh Kumar',
//           ownerPhone: '9876543210',
//           createdAt: new Date()
//         }
//       ];
      
//       return res.json({
//         success: true,
//         message: 'Using mock data (MongoDB Atlas not connected)',
//         count: mockData.length,
//         data: mockData
//       });
//     }
    
//     const query = {};
    
//     if (req.query.type && req.query.type !== 'all') {
//       query.type = req.query.type;
//     }
    
//     if (req.query.city) {
//       query.city = { $regex: req.query.city, $options: 'i' };
//     }
    
//     if (req.query.search) {
//       query.$or = [
//         { name: { $regex: req.query.search, $options: 'i' } },
//         { address: { $regex: req.query.search, $options: 'i' } },
//         { city: { $regex: req.query.search, $options: 'i' } },
//         { description: { $regex: req.query.search, $options: 'i' } }
//       ];
//     }
    
//     // For admin panel, include all listings (published and unpublished)
//     if (req.query.admin === 'true') {
//       delete query.published; // Remove published filter for admin
//     } else {
//       query.published = true; // For public, only show published
//     }
    
//     const listings = await PGListing.find(query).sort({ createdAt: -1 });
    
//     console.log(`✅ Found ${listings.length} listings from MongoDB Atlas`);
    
//     return res.json({
//       success: true,
//       count: listings.length,
//       data: listings
//     });
    
//   } catch (error) {
//     console.error('❌ Error fetching listings:', error);
//     return res.status(500).json({ 
//       success: false, 
//       message: 'Server error',
//       error: error.message
//     });
//   }
// });

// // GET single listing by ID
// app.get('/api/pg/:id', async (req, res) => {
//   try {
//     console.log('🔍 GET /api/pg/:id', req.params.id);
    
//     if (mongoose.connection.readyState !== 1) {
//       console.log('⚠️ MongoDB Atlas not connected, returning mock data');
      
//       const mockData = {
//         _id: req.params.id,
//         name: 'Premium Boys PG Near CU',
//         description: 'Premium accommodation for boys near Chandigarh University',
//         city: 'Chandigarh',
//         address: 'Gate 1, Chandigarh University Road',
//         price: 8500,
//         type: 'boys',
//         images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'],
//         amenities: ['WiFi', 'AC', 'Meals', 'Parking', 'CCTV'],
//         verified: true,
//         featured: true,
//         rating: 4.5,
//         reviewCount: 128,
//         ownerName: 'Rajesh Kumar',
//         ownerPhone: '9876543210',
//         createdAt: new Date().toISOString(),
//         distance: '500m from CU Gate 1'
//       };
      
//       return res.json({
//         success: true,
//         message: 'Using mock data (MongoDB Atlas not connected)',
//         data: mockData
//       });
//     }
    
//     const listing = await PGListing.findById(req.params.id);
    
//     if (!listing) {
//       return res.status(404).json({
//         success: false,
//         message: 'Listing not found'
//       });
//     }
    
//     console.log('✅ Found listing:', listing._id);
    
//     return res.json({
//       success: true,
//       data: listing
//     });
    
//   } catch (error) {
//     console.error('❌ Error fetching listing:', error);
//     return res.status(500).json({ 
//       success: false, 
//       message: 'Server error',
//       error: error.message
//     });
//   }
// });

// // CREATE new PG listing
// app.post('/api/pg', async (req, res) => {
//   try {
//     console.log('➕ POST /api/pg');
    
//     if (mongoose.connection.readyState !== 1) {
//       console.log('❌ MongoDB Atlas not connected');
//       return res.status(500).json({
//         success: false,
//         message: 'MongoDB Atlas not connected'
//       });
//     }
    
//     if (!req.body.name) {
//       return res.status(400).json({
//         success: false,
//         message: 'Name is required'
//       });
//     }
    
//     if (!req.body.price) {
//       return res.status(400).json({
//         success: false,
//         message: 'Price is required'
//       });
//     }
    
//     const listingData = {
//       name: req.body.name,
//       description: req.body.description || '',
//       city: req.body.city || 'Chandigarh',
//       locality: req.body.locality || '',
//       address: req.body.address || '',
//       price: Number(req.body.price),
//       type: req.body.type || 'boys',
//       images: req.body.images || [],
//       gallery: req.body.gallery || [],
//       googleMapLink: req.body.googleMapLink || '',
//       amenities: req.body.amenities || [],
//       roomTypes: req.body.roomTypes || ['Single', 'Double'],
//       distance: req.body.distance || '',
//       availability: req.body.availability || 'available',
//       location: req.body.location || {
//         type: 'Point',
//         coordinates: [0, 0]
//       },
//       published: req.body.published !== undefined ? req.body.published : true,
//       verified: req.body.verified || false,
//       featured: req.body.featured || false,
//       rating: req.body.rating || 0,
//       reviewCount: req.body.reviewCount || 0,
//       ownerName: req.body.ownerName || '',
//       ownerPhone: req.body.ownerPhone || '',
//       ownerEmail: req.body.ownerEmail || '',
//       ownerId: req.body.ownerId || '',
//       contactEmail: req.body.contactEmail || '',
//       contactPhone: req.body.contactPhone || ''
//     };
    
//     const newListing = new PGListing(listingData);
//     const savedListing = await newListing.save();
    
//     console.log('✅ Listing saved with ID:', savedListing._id);
    
//     return res.status(201).json({
//       success: true,
//       message: 'PG listing created successfully',
//       data: savedListing
//     });
    
//   } catch (error) {
//     console.error('❌ Error creating listing:', error);
//     return res.status(500).json({ 
//       success: false, 
//       message: 'Failed to create listing',
//       error: error.message
//     });
//   }
// });

// // UPDATE listing by ID
// app.put('/api/pg/:id', async (req, res) => {
//   try {
//     console.log('✏️ PUT /api/pg/:id', req.params.id);
    
//     if (mongoose.connection.readyState !== 1) {
//       console.log('❌ MongoDB Atlas not connected');
//       return res.status(500).json({
//         success: false,
//         message: 'MongoDB Atlas not connected'
//       });
//     }
    
//     const listingId = req.params.id;
    
//     if (!mongoose.Types.ObjectId.isValid(listingId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid listing ID format'
//       });
//     }
    
//     const existingListing = await PGListing.findById(listingId);
//     if (!existingListing) {
//       return res.status(404).json({
//         success: false,
//         message: 'Listing not found'
//       });
//     }
    
//     const updateData = {};
    
//     // Update only provided fields
//     const fields = [
//       'name', 'description', 'city', 'locality', 'address', 'price', 'type',
//       'images', 'gallery', 'googleMapLink', 'amenities', 'roomTypes',
//       'distance', 'availability', 'location', 'published', 'verified',
//       'featured', 'rating', 'reviewCount', 'ownerName', 'ownerPhone',
//       'ownerEmail', 'ownerId', 'contactEmail', 'contactPhone'
//     ];
    
//     fields.forEach(field => {
//       if (req.body[field] !== undefined) {
//         if (field === 'price' || field === 'rating' || field === 'reviewCount') {
//           updateData[field] = Number(req.body[field]);
//         } else if (field === 'published' || field === 'verified' || field === 'featured') {
//           updateData[field] = Boolean(req.body[field]);
//         } else {
//           updateData[field] = req.body[field];
//         }
//       }
//     });
    
//     const updatedListing = await PGListing.findByIdAndUpdate(
//       listingId,
//       { $set: updateData },
//       { new: true, runValidators: true }
//     );
    
//     console.log('✅ Listing updated:', updatedListing._id);
    
//     return res.json({
//       success: true,
//       message: 'Listing updated successfully',
//       data: updatedListing
//     });
    
//   } catch (error) {
//     console.error('❌ Error updating listing:', error);
//     return res.status(500).json({ 
//       success: false, 
//       message: 'Failed to update listing',
//       error: error.message
//     });
//   }
// });

// // DELETE listing by ID
// app.delete('/api/pg/:id', async (req, res) => {
//   try {
//     console.log('🗑️ DELETE /api/pg/:id', req.params.id);
    
//     if (mongoose.connection.readyState !== 1) {
//       console.log('❌ MongoDB Atlas not connected');
//       return res.status(500).json({
//         success: false,
//         message: 'MongoDB Atlas not connected'
//       });
//     }
    
//     const listingId = req.params.id;
    
//     if (!mongoose.Types.ObjectId.isValid(listingId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid listing ID format'
//       });
//     }
    
//     const existingListing = await PGListing.findById(listingId);
//     if (!existingListing) {
//       return res.status(404).json({
//         success: false,
//         message: 'Listing not found'
//       });
//     }
    
//     await PGListing.findByIdAndDelete(listingId);
    
//     console.log('✅ Listing deleted:', listingId);
    
//     return res.json({
//       success: true,
//       message: 'Listing deleted successfully'
//     });
    
//   } catch (error) {
//     console.error('❌ Error deleting listing:', error);
//     return res.status(500).json({ 
//       success: false, 
//       message: 'Failed to delete listing',
//       error: error.message
//     });
//   }
// });

// // PATCH endpoints for toggling status
// app.patch('/api/pg/:id/publish', async (req, res) => {
//   try {
//     const listingId = req.params.id;
//     const published = req.body.published;
    
//     if (mongoose.connection.readyState !== 1) {
//       return res.status(500).json({
//         success: false,
//         message: 'MongoDB Atlas not connected'
//       });
//     }
    
//     if (!mongoose.Types.ObjectId.isValid(listingId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid listing ID format'
//       });
//     }
    
//     const updatedListing = await PGListing.findByIdAndUpdate(
//       listingId,
//       { published: Boolean(published) },
//       { new: true }
//     );
    
//     if (!updatedListing) {
//       return res.status(404).json({
//         success: false,
//         message: 'Listing not found'
//       });
//     }
    
//     return res.json({
//       success: true,
//       message: `Listing ${published ? 'published' : 'unpublished'} successfully`,
//       data: updatedListing
//     });
    
//   } catch (error) {
//     console.error('Error toggling publish:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to update listing',
//       error: error.message
//     });
//   }
// });

// app.patch('/api/pg/:id/feature', async (req, res) => {
//   try {
//     const listingId = req.params.id;
//     const featured = req.body.featured;
    
//     if (mongoose.connection.readyState !== 1) {
//       return res.status(500).json({
//         success: false,
//         message: 'MongoDB Atlas not connected'
//       });
//     }
    
//     if (!mongoose.Types.ObjectId.isValid(listingId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid listing ID format'
//       });
//     }
    
//     const updatedListing = await PGListing.findByIdAndUpdate(
//       listingId,
//       { featured: Boolean(featured) },
//       { new: true }
//     );
    
//     if (!updatedListing) {
//       return res.status(404).json({
//         success: false,
//         message: 'Listing not found'
//       });
//     }
    
//     return res.json({
//       success: true,
//       message: `Listing ${featured ? 'featured' : 'unfeatured'} successfully`,
//       data: updatedListing
//     });
    
//   } catch (error) {
//     console.error('Error toggling feature:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to update listing',
//       error: error.message
//     });
//   }
// });

// app.patch('/api/pg/:id/verify', async (req, res) => {
//   try {
//     const listingId = req.params.id;
//     const verified = req.body.verified;
    
//     if (mongoose.connection.readyState !== 1) {
//       return res.status(500).json({
//         success: false,
//         message: 'MongoDB Atlas not connected'
//       });
//     }
    
//     if (!mongoose.Types.ObjectId.isValid(listingId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid listing ID format'
//       });
//     }
    
//     const updatedListing = await PGListing.findByIdAndUpdate(
//       listingId,
//       { verified: Boolean(verified) },
//       { new: true }
//     );
    
//     if (!updatedListing) {
//       return res.status(404).json({
//         success: false,
//         message: 'Listing not found'
//       });
//     }
    
//     return res.json({
//       success: true,
//       message: `Listing ${verified ? 'verified' : 'unverified'} successfully`,
//       data: updatedListing
//     });
    
//   } catch (error) {
//     console.error('Error toggling verify:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to update listing',
//       error: error.message
//     });
//   }
// });

// // Add sample data endpoint
// app.post('/api/pg/sample-data', async (req, res) => {
//   try {
//     if (mongoose.connection.readyState !== 1) {
//       return res.status(500).json({
//         success: false,
//         message: 'MongoDB Atlas not connected'
//       });
//     }
    
//     const sampleListings = [
//       {
//         name: 'Royal Boys PG',
//         description: 'Luxurious boys PG with modern amenities near Chandigarh University',
//         city: 'Chandigarh',
//         address: 'Gate 2, CU Road',
//         price: 9000,
//         type: 'boys',
//         images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'],
//         amenities: ['WiFi', 'AC', 'Meals', 'Parking', 'Gym', 'Study Room'],
//         published: true,
//         verified: true,
//         featured: true,
//         rating: 4.7,
//         reviewCount: 56,
//         ownerName: 'Amit Verma',
//         ownerPhone: '9315058665'
//       },
//       {
//         name: 'Sunshine Girls PG',
//         description: 'Safe and secure girls PG with 24/7 security and CCTV',
//         city: 'Chandigarh',
//         address: 'Library Road, CU',
//         price: 9500,
//         type: 'girls',
//         images: ['https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800'],
//         amenities: ['WiFi', 'AC', 'Meals', 'CCTV', '24/7 Security', 'Hot Water'],
//         published: true,
//         verified: true,
//         featured: true,
//         rating: 4.8,
//         reviewCount: 89,
//         ownerName: 'Sunita Devi',
//         ownerPhone: '9315058665'
//       },
//       {
//         name: 'Student Hub Co-Ed PG',
//         description: 'Co-ed PG with study rooms and high-speed internet',
//         city: 'Chandigarh',
//         address: 'Sports Complex Road',
//         price: 8000,
//         type: 'co-ed',
//         images: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800'],
//         amenities: ['WiFi', 'Study Room', 'Library', 'Common Room', 'Laundry'],
//         published: true,
//         verified: true,
//         featured: false,
//         rating: 4.3,
//         reviewCount: 34,
//         ownerName: 'Rohit Sharma',
//         ownerPhone: '9315058665'
//       }
//     ];
    
//     const savedListings = [];
    
//     for (const listing of sampleListings) {
//       const newListing = new PGListing(listing);
//       const saved = await newListing.save();
//       savedListings.push(saved);
//     }
    
//     return res.json({
//       success: true,
//       message: 'Sample data added successfully',
//       count: savedListings.length,
//       data: savedListings
//     });
    
//   } catch (error) {
//     console.error('❌ Error adding sample data:', error);
//     return res.status(500).json({ 
//       success: false, 
//       message: 'Failed to add sample data',
//       error: error.message
//     });
//   }
// });

// // ================ ERROR HANDLERS ================

// // Global error handler
// app.use((err, req, res, next) => {
//   console.error('🚨 Global Error Handler:', err.message);
  
//   return res.status(err.status || 500).json({
//     success: false,
//     message: 'Internal server error',
//     error: err.message
//   });
// });

// // 404 handler
// app.all('*', (req, res) => {
//   console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
  
//   return res.status(404).json({
//     success: false,
//     error: 'Endpoint not found',
//     path: req.originalUrl,
//     method: req.method,
//     availableEndpoints: [
//       'GET  /',
//       'GET  /health',
//       'GET  /api/test',
//       'GET  /api/db-test',
//       'GET  /api/pg',
//       'POST /api/pg',
//       'GET  /api/pg/:id',
//       'PUT  /api/pg/:id',
//       'DELETE /api/pg/:id',
//       'PATCH /api/pg/:id/publish',
//       'PATCH /api/pg/:id/feature',
//       'PATCH /api/pg/:id/verify',
//       'POST /api/pg/sample-data'
//     ]
//   });
// });

// // ================ START SERVER ================

// const PORT = process.env.PORT || 5000;

// const server = app.listen(PORT, () => {
//   console.log(`\n🚀 Server running on http://localhost:${PORT}`);
//   console.log(`📊 MongoDB Atlas Status: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
  
//   console.log('\n📋 Available Endpoints:');
//   console.log(`  🏠 Home:      http://localhost:${PORT}/`);
//   console.log(`  ❤️  Health:    http://localhost:${PORT}/health`);
//   console.log(`  🧪 Test:      http://localhost:${PORT}/api/test`);
//   console.log(`  🗄️  DB Test:   http://localhost:${PORT}/api/db-test`);
//   console.log(`  🏢 PG CRUD:`);
//   console.log(`    GET    http://localhost:${PORT}/api/pg`);
//   console.log(`    POST   http://localhost:${PORT}/api/pg`);
//   console.log(`    GET    http://localhost:${PORT}/api/pg/:id`);
//   console.log(`    PUT    http://localhost:${PORT}/api/pg/:id`);
//   console.log(`    DELETE http://localhost:${PORT}/api/pg/:id`);
//   console.log(`    POST   http://localhost:${PORT}/api/pg/sample-data`);
  
//   console.log('\n💡 Pro Tips:');
//   console.log('  1. First test: http://localhost:5000/api/db-test');
//   console.log('  2. Add sample: http://localhost:5000/api/pg/sample-data (POST)');
//   console.log('  3. View all: http://localhost:5000/api/pg');
//   console.log('\n📌 Press Ctrl+C to stop\n');
// });

// // Graceful shutdown
// process.on('SIGINT', () => {
//   console.log('\n👋 Shutting down...');
  
//   server.close(() => {
//     console.log('✅ HTTP server closed');
//   });
  
//   mongoose.connection.close(false, () => {
//     console.log('✅ MongoDB Atlas connection closed');
//     process.exit(0);
//   });
// });

// module.exports = app;



// server.js - Complete version with all CRUD operations
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const PGListing = require('./models/PGListing'); // Import the model

const app = express();

// ================ CORS CONFIGURATION (FIXED) ================
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
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Request Body:', JSON.stringify(req.body).substring(0, 200));
  }
  next();
});

// ================ MONGODB ATLAS CONNECTION ================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://deep:deep123@cluster0.veuok.mongodb.net/pgfinder?retryWrites=true&w=majority&appName=Cluster0';

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
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  return res.json({
    message: '🏠 PG Finder Backend API',
    version: '2.0.0',
    status: 'running 🚀',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
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
      corsTest: 'GET /api/cors-test',
      sampleData: 'POST /api/pg/sample-data'
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

// ================ CRUD OPERATIONS ================
// GET all PG listings
app.get('/api/pg', async (req, res) => {
  try {
    console.log('📋 GET /api/pg');
    
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ MongoDB Atlas not connected, returning mock data');
      
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
          ownerPhone: '9315058665',
          contactPhone: '9315058665',
          address: 'Gate 1, Chandigarh University Road',
          verified: true,
          featured: true,
          published: true,
          createdAt: new Date()
        },
        {
          _id: 'mock-2',
          name: 'Sunshine Girls PG',
          city: 'Chandigarh',
          price: 9500,
          type: 'girls',
          description: 'Safe and secure girls PG with 24/7 security',
          images: ['https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800'],
          amenities: ['WiFi', 'AC', 'Meals', 'CCTV', '24/7 Security'],
          rating: 4.8,
          reviewCount: 36,
          ownerName: 'Sunita Devi',
          ownerPhone: '9315058665',
          contactPhone: '9315058665',
          address: 'Library Road, Chandigarh University',
          verified: true,
          featured: true,
          published: true,
          createdAt: new Date()
        },
        {
          _id: 'mock-3',
          name: 'Co-Ed Student Hub',
          city: 'Chandigarh',
          price: 7500,
          type: 'co-ed',
          description: 'Co-ed PG with study rooms and high-speed internet',
          images: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800'],
          amenities: ['WiFi', 'Study Room', 'Library', 'Common Room'],
          rating: 4.3,
          reviewCount: 28,
          ownerName: 'Rohit Sharma',
          ownerPhone: '9315058665',
          contactPhone: '9315058665',
          address: 'Sports Complex Road, Chandigarh',
          verified: true,
          featured: false,
          published: true,
          createdAt: new Date()
        },
        {
          _id: 'mock-4',
          name: 'Royal Boys PG Luxury',
          city: 'Chandigarh',
          price: 12000,
          type: 'boys',
          description: 'Luxury PG with gym, AC rooms and premium facilities',
          images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800'],
          amenities: ['WiFi', 'AC', 'Gym', 'Laundry', 'Meals', 'Parking', 'CCTV'],
          rating: 4.9,
          reviewCount: 58,
          ownerName: 'Amit Verma',
          ownerPhone: '9315058665',
          contactPhone: '9315058665',
          address: 'Sector 15, Chandigarh',
          verified: true,
          featured: true,
          published: true,
          createdAt: new Date()
        },
        {
          _id: 'mock-5',
          name: 'Girls Paradise PG',
          city: 'Chandigarh',
          price: 9000,
          type: 'girls',
          description: 'Exclusive girls PG with home-like environment',
          images: ['https://images.unsplash.com/photo-1544984243-ec57ea16fe25?w=800'],
          amenities: ['WiFi', 'AC', 'Meals', 'Hot Water', 'Study Room', 'CCTV'],
          rating: 4.7,
          reviewCount: 45,
          ownerName: 'Neha Gupta',
          ownerPhone: '9315058665',
          contactPhone: '9315058665',
          address: 'Near CU Campus, Mohali',
          verified: true,
          featured: true,
          published: true,
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

// GET single listing by ID
app.get('/api/pg/:id', async (req, res) => {
  try {
    console.log('🔍 GET /api/pg/:id', req.params.id);
    
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ MongoDB Atlas not connected, returning mock data');
      
      const mockData = {
        _id: req.params.id,
        name: 'Premium Boys PG Near CU',
        description: 'Premium accommodation for boys near Chandigarh University',
        city: 'Chandigarh',
        address: 'Gate 1, Chandigarh University Road',
        price: 8500,
        type: 'boys',
        images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'],
        amenities: ['WiFi', 'AC', 'Meals', 'Parking', 'CCTV', 'Gym'],
        verified: true,
        featured: true,
        rating: 4.5,
        reviewCount: 128,
        ownerName: 'Rajesh Kumar',
        ownerPhone: '9315058665',
        contactPhone: '9315058665',
        contactEmail: 'rajesh.pg@gmail.com',
        googleMapLink: 'https://maps.google.com/?q=Chandigarh+University',
        roomTypes: ['Single', 'Double', 'Triple'],
        distance: '500m from CU Gate 1',
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
        message: 'Using mock data (MongoDB Atlas not connected)',
        data: mockData
      });
    }
    
    const listing = await PGListing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    console.log('✅ Found listing:', listing._id);
    
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

// CREATE new PG listing
app.post('/api/pg', async (req, res) => {
  try {
    console.log('➕ POST /api/pg');
    
    if (mongoose.connection.readyState !== 1) {
      console.log('❌ MongoDB Atlas not connected');
      return res.status(500).json({
        success: false,
        message: 'MongoDB Atlas not connected'
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
      contactPhone: req.body.contactPhone || '9315058665'
    };
    
    const newListing = new PGListing(listingData);
    const savedListing = await newListing.save();
    
    console.log('✅ Listing saved with ID:', savedListing._id);
    
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
      console.log('❌ MongoDB Atlas not connected');
      return res.status(500).json({
        success: false,
        message: 'MongoDB Atlas not connected'
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
      console.log('❌ MongoDB Atlas not connected');
      return res.status(500).json({
        success: false,
        message: 'MongoDB Atlas not connected'
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

// PATCH endpoints
app.patch('/api/pg/:id/publish', async (req, res) => {
  try {
    const listingId = req.params.id;
    const published = req.body.published;
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        message: 'MongoDB Atlas not connected'
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
        message: 'MongoDB Atlas not connected'
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
        message: 'MongoDB Atlas not connected'
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
        featured: false,
        rating: 4.3,
        reviewCount: 34,
        ownerName: 'Rohit Sharma',
        ownerPhone: '9315058665',
        contactPhone: '9315058665'
      },
      {
        name: 'Premium Boys PG Elite',
        description: 'Premium accommodation with all facilities for boys',
        city: 'Chandigarh',
        address: 'Sector 14, Chandigarh',
        price: 11000,
        type: 'boys',
        images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800'],
        amenities: ['WiFi', 'AC', 'Meals', 'Gym', 'Swimming Pool', 'Parking'],
        published: true,
        verified: true,
        featured: true,
        rating: 4.9,
        reviewCount: 72,
        ownerName: 'Vikram Singh',
        ownerPhone: '9315058665',
        contactPhone: '9315058665'
      },
      {
        name: 'Girls Comfort PG',
        description: 'Comfortable and secure PG exclusively for girls',
        city: 'Chandigarh',
        address: 'Near CU Hostel, Mohali',
        price: 8500,
        type: 'girls',
        images: ['https://images.unsplash.com/photo-1544984243-ec57ea16fe25?w=800'],
        amenities: ['WiFi', 'AC', 'Meals', 'Hot Water', 'Study Room', 'CCTV'],
        published: true,
        verified: true,
        featured: false,
        rating: 4.6,
        reviewCount: 41,
        ownerName: 'Priya Sharma',
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
    const totalPGs = await PGListing.countDocuments({ published: true });
    const boysPGs = await PGListing.countDocuments({ type: 'boys', published: true });
    const girlsPGs = await PGListing.countDocuments({ type: 'girls', published: true });
    const coedPGs = await PGListing.countDocuments({ type: 'co-ed', published: true });
    const featuredPGs = await PGListing.countDocuments({ featured: true, published: true });
    const verifiedPGs = await PGListing.countDocuments({ verified: true, published: true });
    
    // Get average price
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
  console.log(`📊 MongoDB Atlas Status: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
  
  console.log('\n📋 Available Endpoints:');
  console.log(`  🏠 Home:      http://localhost:${PORT}/`);
  console.log(`  ❤️  Health:    http://localhost:${PORT}/health`);
  console.log(`  🧪 Test:      http://localhost:${PORT}/api/test`);
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
    console.log('✅ MongoDB Atlas connection closed');
    process.exit(0);
  });
});

module.exports = app;