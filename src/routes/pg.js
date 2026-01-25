// // routes/pg.js
// const express = require('express');
// const router = express.Router();

// // Import model
// const PGListing = require('../models/PGListing');

// // Test route
// router.get('/test', (req, res) => {
//   const dbConnected = req.app.get('mongoose').connection.readyState === 1;
//   res.json({ 
//     success: true, 
//     message: 'PG route working ✅',
//     database: dbConnected ? 'connected' : 'disconnected',
//     timestamp: new Date().toISOString()
//   });
// });

// // Get all PG listings
// router.get('/', async (req, res) => {
//   try {
//     console.log('📋 Get PG listings query:', req.query);
    
//     // Check MongoDB connection
//     const mongoose = req.app.get('mongoose');
//     if (!mongoose || mongoose.connection.readyState !== 1) {
//       console.log('⚠️ MongoDB not connected, returning mock data');
//       return getMockListings(req, res);
//     }
    
//     // Build query
//     const query = {};
    
//     if (req.query.type && req.query.type !== 'all') {
//       query.type = req.query.type;
//     }
    
//     if (req.query.city) {
//       query.city = { $regex: req.query.city, $options: 'i' };
//     }
    
//     if (req.query.published !== undefined) {
//       query.published = req.query.published === 'true';
//     }
    
//     if (req.query.search) {
//       query.$or = [
//         { name: { $regex: req.query.search, $options: 'i' } },
//         { address: { $regex: req.query.search, $options: 'i' } },
//         { city: { $regex: req.query.search, $options: 'i' } },
//         { description: { $regex: req.query.search, $options: 'i' } }
//       ];
//     }
    
//     // Fetch from database
//     const listings = await PGListing.find(query).sort({ createdAt: -1 });
    
//     console.log(`✅ Found ${listings.length} listings from database`);
    
//     res.json({
//       success: true,
//       count: listings.length,
//       data: listings
//     });
    
//   } catch (error) {
//     console.error('❌ Error fetching listings:', error);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Server error',
//       error: error.message
//     });
//   }
// });

// // Create PG listing
// router.post('/', async (req, res) => {
//   try {
//     console.log('➕ Create PG listing:', req.body);
    
//     // Check MongoDB connection
//     const mongoose = req.app.get('mongoose');
//     if (!mongoose || mongoose.connection.readyState !== 1) {
//       console.log('❌ MongoDB not connected');
//       return res.status(500).json({
//         success: false,
//         message: 'Database not connected. Cannot save listing.',
//         data: {
//           ...req.body,
//           _id: `mock-${Date.now()}`,
//           createdAt: new Date(),
//           updatedAt: new Date()
//         }
//       });
//     }
    
//     // Validate required fields
//     const requiredFields = ['name', 'city', 'price'];
//     const missingFields = requiredFields.filter(field => !req.body[field]);
    
//     if (missingFields.length > 0) {
//       return res.status(400).json({
//         success: false,
//         message: `Missing required fields: ${missingFields.join(', ')}`
//       });
//     }
    
//     // Create listing data
//     const listingData = {
//       name: req.body.name,
//       description: req.body.description || '',
//       city: req.body.city,
//       locality: req.body.locality || '',
//       address: req.body.address || '',
//       price: Number(req.body.price),
//       type: req.body.type || 'boys',
//       images: req.body.images || [],
//       amenities: req.body.amenities || [],
//       location: req.body.location || {
//         type: 'Point',
//         coordinates: [0, 0]
//       },
//       published: req.body.published || false,
//       verified: req.body.verified || false,
//       featured: req.body.featured || false,
//       rating: req.body.rating || 0,
//       reviewCount: req.body.reviewCount || 0,
//       ownerName: req.body.ownerName || '',
//       ownerPhone: req.body.ownerPhone || '',
//       ownerEmail: req.body.ownerEmail || ''
//     };
    
//     // Create and save listing
//     const newListing = new PGListing(listingData);
//     const savedListing = await newListing.save();
    
//     console.log('✅ Listing saved to MongoDB with ID:', savedListing._id);
//     console.log('📄 Saved data:', savedListing);
    
//     res.status(201).json({
//       success: true,
//       message: 'PG listing created successfully',
//       data: savedListing
//     });
    
//   } catch (error) {
//     console.error('❌ Error creating listing:', error);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Failed to create listing',
//       error: error.message,
//       stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     });
//   }
// });

// // Get single listing
// router.get('/:id', async (req, res) => {
//   try {
//     console.log('🔍 Get listing by ID:', req.params.id);
    
//     const mongoose = req.app.get('mongoose');
//     if (!mongoose || mongoose.connection.readyState !== 1) {
//       return res.status(500).json({
//         success: false,
//         message: 'Database not connected'
//       });
//     }
    
//     const listing = await PGListing.findById(req.params.id);
    
//     if (!listing) {
//       return res.status(404).json({
//         success: false,
//         message: 'Listing not found'
//       });
//     }
    
//     res.json({
//       success: true,
//       data: listing
//     });
    
//   } catch (error) {
//     console.error('❌ Error fetching listing:', error);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Server error',
//       error: error.message
//     });
//   }
// });

// // Update listing
// router.put('/:id', async (req, res) => {
//   try {
//     console.log('✏️ Update listing:', req.params.id, req.body);
    
//     const mongoose = req.app.get('mongoose');
//     if (!mongoose || mongoose.connection.readyState !== 1) {
//       return res.status(500).json({
//         success: false,
//         message: 'Database not connected'
//       });
//     }
    
//     const updatedListing = await PGListing.findByIdAndUpdate(
//       req.params.id,
//       req.body,
//       { new: true, runValidators: true }
//     );
    
//     if (!updatedListing) {
//       return res.status(404).json({
//         success: false,
//         message: 'Listing not found'
//       });
//     }
    
//     console.log('✅ Listing updated:', updatedListing._id);
    
//     res.json({
//       success: true,
//       message: 'Listing updated successfully',
//       data: updatedListing
//     });
    
//   } catch (error) {
//     console.error('❌ Error updating listing:', error);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Server error',
//       error: error.message
//     });
//   }
// });

// // Delete listing
// router.delete('/:id', async (req, res) => {
//   try {
//     console.log('🗑️ Delete listing:', req.params.id);
    
//     const mongoose = req.app.get('mongoose');
//     if (!mongoose || mongoose.connection.readyState !== 1) {
//       return res.status(500).json({
//         success: false,
//         message: 'Database not connected'
//       });
//     }
    
//     const deletedListing = await PGListing.findByIdAndDelete(req.params.id);
    
//     if (!deletedListing) {
//       return res.status(404).json({
//         success: false,
//         message: 'Listing not found'
//       });
//     }
    
//     console.log('✅ Listing deleted:', req.params.id);
    
//     res.json({
//       success: true,
//       message: 'Listing deleted successfully',
//       data: { id: req.params.id }
//     });
    
//   } catch (error) {
//     console.error('❌ Error deleting listing:', error);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Server error',
//       error: error.message
//     });
//   }
// });

// // Helper function for mock data
// function getMockListings(req, res) {
//   const mockData = [
//     {
//       _id: 'mock-1',
//       name: 'Sunshine PG (Mock)',
//       city: 'Delhi',
//       address: '123 Main Street',
//       price: 5000,
//       type: 'boys',
//       rating: 4.5,
//       description: 'Mock data - MongoDB not connected',
//       amenities: ['WiFi', 'AC', 'Food'],
//       images: [],
//       published: true,
//       featured: false,
//       verified: true,
//       createdAt: new Date().toISOString(),
//       updatedAt: new Date().toISOString()
//     },
//     {
//       _id: 'mock-2',
//       name: 'Rose PG for Girls (Mock)',
//       city: 'Mumbai',
//       address: '456 Park Avenue',
//       price: 6000,
//       type: 'girls',
//       rating: 4.2,
//       description: 'Safe and secure PG for girls - Mock data',
//       amenities: ['WiFi', 'Security', 'Laundry'],
//       images: [],
//       published: true,
//       featured: true,
//       verified: true,
//       createdAt: new Date().toISOString(),
//       updatedAt: new Date().toISOString()
//     }
//   ];
  
//   // Apply filters to mock data
//   let filtered = [...mockData];
  
//   if (req.query.type && req.query.type !== 'all') {
//     filtered = filtered.filter(l => l.type === req.query.type);
//   }
  
//   if (req.query.search) {
//     const search = req.query.search.toLowerCase();
//     filtered = filtered.filter(l => 
//       l.name.toLowerCase().includes(search) || 
//       l.address.toLowerCase().includes(search)
//     );
//   }
  
//   res.json({
//     success: true,
//     message: 'Using mock data - MongoDB not connected',
//     count: filtered.length,
//     data: filtered
//   });
// }

// module.exports = router;

const express = require('express');
const router = express.Router();

// Import model
const PGListing = require('../models/PGListing');

// Get all PG listings
router.get('/', async (req, res) => {
  try {
    console.log('📋 GET /api/pg');
    
    const listings = await PGListing.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: listings.length,
      data: listings
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error'
    });
  }
});

// Create PG listing
router.post('/', async (req, res) => {
  try {
    console.log('➕ POST /api/pg:', req.body);
    
    // Validate
    if (!req.body.name || !req.body.city || !req.body.price) {
      return res.status(400).json({
        success: false,
        message: 'Name, city and price are required'
      });
    }
    
    const listingData = {
      name: req.body.name,
      description: req.body.description || '',
      city: req.body.city,
      locality: req.body.locality || '',
      address: req.body.address || '',
      price: Number(req.body.price),
      type: req.body.type || 'boys',
      images: req.body.images || [],
      amenities: req.body.amenities || []
    };
    
    const newListing = new PGListing(listingData);
    const savedListing = await newListing.save();
    
    console.log('✅ Saved:', savedListing._id);
    
    res.status(201).json({
      success: true,
      message: 'PG listing created',
      data: savedListing
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create listing',
      error: error.message
    });
  }
});

module.exports = router;