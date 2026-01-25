const PGListing = require('../models/PGListing');

// @desc    Get all PG listings
// @route   GET /api/pg
// @access  Public
exports.getPGListings = async (req, res) => {
  try {
    console.log('Get PG listings request:', req.query);

    const { 
      type, 
      published, 
      featured, 
      verified, 
      search,
      minPrice,
      maxPrice,
      city,
      availability,
      sort = '-createdAt',
      page = 1,
      limit = 20
    } = req.query;
    
    let query = {};
    
    // Build query
    if (type && type !== 'all') query.type = type;
    if (published === 'true') query.published = true;
    if (published === 'false') query.published = false;
    if (featured === 'true') query.featured = true;
    if (verified === 'true') query.verified = true;
    if (city) query.city = new RegExp(city, 'i');
    if (availability) query.availability = availability;
    
    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const listings = await PGListing.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await PGListing.countDocuments(query);

    res.json({
      success: true,
      count: listings.length,
      total: total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: listings
    });

  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single PG listing
// @route   GET /api/pg/:id
// @access  Public
exports.getPGListing = async (req, res) => {
  try {
    const listing = await PGListing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'PG listing not found'
      });
    }
    
    res.json({
      success: true,
      data: listing
    });

  } catch (error) {
    console.error('Get listing error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create PG listing
// @route   POST /api/pg
// @access  Private/Admin
exports.createPGListing = async (req, res) => {
  try {
    console.log('Create listing request from user:', req.user.email);
    console.log('Listing data:', req.body);

    // Add default values if not provided
    const listingData = {
      ...req.body,
      published: req.body.published || false,
      verified: req.body.verified || false,
      featured: req.body.featured || false,
      ownerName: req.body.ownerName || req.user.name,
      ownerEmail: req.body.ownerEmail || req.user.email
    };

    const listing = await PGListing.create(listingData);
    
    console.log('✅ Listing created:', listing.name);

    res.status(201).json({
      success: true,
      message: 'PG listing created successfully',
      data: listing
    });

  } catch (error) {
    console.error('Create listing error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    // Handle duplicate slug error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Listing with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create listing',
      error: error.message
    });
  }
};

// @desc    Update PG listing
// @route   PUT /api/pg/:id
// @access  Private/Admin
exports.updatePGListing = async (req, res) => {
  try {
    console.log('Update listing request:', req.params.id);
    console.log('Update data:', req.body);

    let listing = await PGListing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'PG listing not found'
      });
    }
    
    // Update listing
    listing = await PGListing.findByIdAndUpdate(
      req.params.id,
      { 
        ...req.body,
        updatedAt: Date.now()
      },
      { 
        new: true, 
        runValidators: true 
      }
    );
    
    console.log('✅ Listing updated:', listing.name);

    res.json({
      success: true,
      message: 'PG listing updated successfully',
      data: listing
    });

  } catch (error) {
    console.error('Update listing error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update listing',
      error: error.message
    });
  }
};

// @desc    Delete PG listing
// @route   DELETE /api/pg/:id
// @access  Private/Admin
exports.deletePGListing = async (req, res) => {
  try {
    const listing = await PGListing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'PG listing not found'
      });
    }
    
    await listing.deleteOne();
    
    console.log('✅ Listing deleted:', listing.name);

    res.json({
      success: true,
      message: 'PG listing deleted successfully',
      data: {}
    });

  } catch (error) {
    console.error('Delete listing error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete listing',
      error: error.message
    });
  }
};

// @desc    Toggle listing status
// @route   PATCH /api/pg/:id/toggle-status
// @access  Private/Admin
exports.toggleStatus = async (req, res) => {
  try {
    const { field } = req.body;
    const validFields = ['published', 'featured', 'verified'];
    
    if (!field || !validFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: `Invalid field. Must be one of: ${validFields.join(', ')}`
      });
    }
    
    const listing = await PGListing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'PG listing not found'
      });
    }
    
    // Toggle the field
    listing[field] = !listing[field];
    listing.updatedAt = Date.now();
    
    await listing.save();
    
    console.log(`✅ ${field} toggled to ${listing[field]} for:`, listing.name);

    res.json({
      success: true,
      message: `${field} status updated`,
      data: listing
    });

  } catch (error) {
    console.error('Toggle status error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid listing ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to toggle status',
      error: error.message
    });
  }
};

// @desc    Get PG statistics
// @route   GET /api/pg/stats
// @access  Private/Admin
exports.getStats = async (req, res) => {
  try {
    const total = await PGListing.countDocuments();
    const published = await PGListing.countDocuments({ published: true });
    const featured = await PGListing.countDocuments({ featured: true });
    const verified = await PGListing.countDocuments({ verified: true });
    
    const boys = await PGListing.countDocuments({ type: 'boys' });
    const girls = await PGListing.countDocuments({ type: 'girls' });
    const coed = await PGListing.countDocuments({ type: 'co-ed' });
    
    res.json({
      success: true,
      data: {
        total,
        published,
        draft: total - published,
        featured,
        verified,
        boys,
        girls,
        coed
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics',
      error: error.message
    });
  }
};

// @desc    Search PG listings
// @route   GET /api/pg/search
// @access  Public
exports.searchPGListings = async (req, res) => {
  try {
    const { q, location, type } = req.query;
    
    let query = {};
    
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { address: { $regex: q, $options: 'i' } },
        { city: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }
    
    if (location) {
      query.$or = query.$or || [];
      query.$or.push(
        { address: { $regex: location, $options: 'i' } },
        { city: { $regex: location, $options: 'i' } }
      );
    }
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    query.published = true;
    
    const listings = await PGListing.find(query)
      .sort('-createdAt')
      .limit(20);

    res.json({
      success: true,
      count: listings.length,
      data: listings
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
};