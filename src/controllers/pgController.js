const mongoose = require('mongoose');
const PGListing = require('../models/PGListing');
const User = require('../models/User');
const Review = require('../models/Review');
const logger = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/response');
const { uploadImage, uploadGalleryImages } = require('../utils/cloudinary');

// ✅ OPTIMIZED: Import cache service
let cache;
try {
  cache = require('../services/cache');
  logger.info('✅ Cache service integrated');
} catch (error) {
  logger.warn('⚠️ Cache service not available:', error.message);
  cache = null;
}

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper function to get coordinates by city (AUTO-COORDINATES)
const getCoordinatesByCity = (city) => {
  const cityCoordinates = {
    'chandigarh': { lat: 30.7333, lng: 76.7794 },
    'mohali': { lat: 30.7046, lng: 76.7179 },
    'panchkula': { lat: 30.6942, lng: 76.8606 },
    'kharar': { lat: 30.7463, lng: 76.6468 },
    'ropar': { lat: 30.9686, lng: 76.5271 },
    'zirakpur': { lat: 30.6442, lng: 76.8186 },
    'noida': { lat: 28.5355, lng: 77.3910 },
    'faridabad': { lat: 28.4089, lng: 77.3178 },
    'delhi': { lat: 28.7041, lng: 77.1025 },
    'gurgaon': { lat: 28.4595, lng: 77.0266 },
    'lucknow': { lat: 26.8467, lng: 80.9462 },
    'jaipur': { lat: 26.9124, lng: 75.7873 },
  };
  
  const cityKey = city?.toLowerCase().trim();
  return cityCoordinates[cityKey] || { lat: 30.7333, lng: 76.7794 };
};

// Helper function to convert YouTube URL to embed URL
const getYouTubeEmbedUrl = (url) => {
  if (!url) return null;
  
  let embedUrl = url;
  
  if (url.includes('youtube.com/watch?v=')) {
    embedUrl = url.replace('watch?v=', 'embed/');
  } else if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1]?.split('?')[0];
    embedUrl = `https://www.youtube.com/embed/${videoId}`;
  } else if (url.includes('vimeo.com/') && !url.includes('player.vimeo.com')) {
    const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
    embedUrl = `https://player.vimeo.com/video/${videoId}`;
  }
  
  return embedUrl;
};

// @desc    Get all PG listings
// @route   GET /api/pg
// @access  Public
exports.getPGListings = async (req, res, next) => {
  try {
    logger.info('Get PG listings request', { query: req.query });

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
      hasVirtualTour,
      sort = '-createdAt',
      page = 1,
limit = 20
    } = req.query;
    
    // ✅ OPTIMIZED: Check cache for basic listing requests (first page, no filters)
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const cacheKey = `pg_list_${type || 'all'}_${city || 'all'}_${sort}`;
    if (cache && !search && !minPrice && !maxPrice && pageNum === 1 && limitNum >= 20) {
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.info(`✅ Cache hit for: ${cacheKey}`);
        return successResponse(res, {
          statusCode: 200,
          message: 'PG listings fetched from cache',
          data: cached,
          cached: true
        });
      }
    }
    
    let query = {};
    
    if
    if (published === 'true') query.published = true;
    if (published === 'false') query.published = false;
    if (featured === 'true') query.featured = true;
    if (verified === 'true') query.verified = true;
    if (city) query.city = new RegExp(city, 'i');
    if (availability) query.availability = availability;
    
    if (hasVirtualTour === 'true') {
      query.$or = [
        { videoUrl: { $ne: '', $exists: true } },
        { virtualTour: { $ne: '', $exists: true } }
      ];
    }
    
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // ✅ OPTIMIZED: Use lean() for better performance on read-only queries
    let listings = await PGListing.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    listings = listings.map(listing => {
      const listingObj = listing.toObject();
      
      listingObj.hasVirtualTour = !!(listingObj.videoUrl || listingObj.virtualTour);
      listingObj.videoEmbedUrl = getYouTubeEmbedUrl(listingObj.videoUrl);
      listingObj.virtualTourType = listingObj.videoUrl ? 'youtube' : listingObj.virtualTour ? '3d-tour' : null;
      
      let hasValidCoords = false;
      
      if (listingObj.coordinates && 
          listingObj.coordinates.lat && 
          listingObj.coordinates.lat !== 0 && 
          listingObj.coordinates.lng && 
          listingObj.coordinates.lng !== 0) {
        hasValidCoords = true;
      }
      
      if (!hasValidCoords && listingObj.location?.coordinates && listingObj.location.coordinates.length === 2) {
        const lat = listingObj.location.coordinates[1];
        const lng = listingObj.location.coordinates[0];
        if (lat && lng && lat !== 0 && lng !== 0) {
          listingObj.coordinates = { lat, lng };
          hasValidCoords = true;
        }
      }
      
      if (!hasValidCoords) {
        const defaultCoords = getCoordinatesByCity(listingObj.city);
        listingObj.coordinates = defaultCoords;
      }
      
      return listingObj;
    });

    const total = await PGListing.countDocuments(query);

    return successResponse(res, {
      statusCode: 200,
      message: 'PG listings fetched successfully',
      data: {
        count: listings.length,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        items: listings,
      },
    });
  } catch (error) {
    console.error('Get PG listings error:', error);
    return errorResponse(res, {
      statusCode: 500,
      message: 'Failed to fetch PG listings',
      errors: error.message
    });
  }
};

// @desc    Get single PG listing
// @route   GET /api/pg/:id
// @access  Public
exports.getPGListing = async (req, res, next) => {
  try {
    let listing = await PGListing.findById(req.params.id);
    
    if (!listing) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'PG listing not found',
      });
    }
    
    const listingObj = listing.toObject();
    
    listingObj.hasVirtualTour = !!(listingObj.videoUrl || listingObj.virtualTour);
    listingObj.videoEmbedUrl = getYouTubeEmbedUrl(listingObj.videoUrl);
    listingObj.virtualTourType = listingObj.videoUrl ? 'youtube' : listingObj.virtualTour ? '3d-tour' : null;
    
    if (!listingObj.coordinates || listingObj.coordinates.lat === 0) {
      const defaultCoords = getCoordinatesByCity(listingObj.city);
      listingObj.coordinates = defaultCoords;
    }
    
    const views = listing.views || 0;
    const weeklyBookings = listing.weeklyBookings || 0;
    
    let demandLevel = 'Low';
    if (views > 200 || weeklyBookings > 10) demandLevel = 'High';
    if (views > 500 || weeklyBookings > 20) demandLevel = 'Very High';
    
    listingObj.demandMeter = {
      views,
      weeklyBookings,
      demandLevel
    };
    
    return successResponse(res, {
      message: 'PG listing fetched successfully',
      data: listingObj,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid listing ID',
      });
    }
    return next(error);
  }
};

// @desc    Get PG by slug
// @route   GET /api/pg/slug/:slug
// @access  Public
exports.getPGBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    let listing = await PGListing.findOne({ slug });
    
    if (!listing) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'PG listing not found',
      });
    }
    
    const listingObj = listing.toObject();
    
    listingObj.hasVirtualTour = !!(listingObj.videoUrl || listingObj.virtualTour);
    listingObj.videoEmbedUrl = getYouTubeEmbedUrl(listingObj.videoUrl);
    listingObj.virtualTourType = listingObj.videoUrl ? 'youtube' : listingObj.virtualTour ? '3d-tour' : null;
    
    if (!listingObj.coordinates || listingObj.coordinates.lat === 0) {
      const defaultCoords = getCoordinatesByCity(listingObj.city);
      listingObj.coordinates = defaultCoords;
    }
    
    return successResponse(res, {
      message: 'PG listing fetched successfully',
      data: listingObj,
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Create PG listing
// @route   POST /api/pg
// @access  Private/Admin
exports.createPGListing = async (req, res, next) => {
  try {
    logger.info('Create listing request', {
      user: req.user && req.user.email,
    });

    const { name, city, ownerEmail } = req.body;
    const existingPG = await PGListing.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      city: { $regex: new RegExp(`^${city}$`, 'i') },
      ownerEmail: ownerEmail || req.user.email
    });

    if (existingPG) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'This PG listing already exists! Duplicate entries are not allowed.',
      });
    }

    const rawImages = Array.isArray(req.body.images) ? req.body.images : [];
    const rawGallery = Array.isArray(req.body.gallery) ? req.body.gallery : [];

    const [primaryImageUrl, galleryUrls] = await Promise.all([
      rawImages.length > 0 ? uploadImage(rawImages[0]) : null,
      uploadGalleryImages(rawGallery),
    ]);

    const images = [];
    if (primaryImageUrl) {
      images.push(primaryImageUrl);
    }

    const cityName = req.body.city;
    const autoCoordinates = getCoordinatesByCity(cityName);
    
    let coordinates = null;
    if (req.body.lat && req.body.lng) {
      coordinates = { lat: parseFloat(req.body.lat), lng: parseFloat(req.body.lng) };
    } else {
      coordinates = autoCoordinates;
      logger.info(`Auto-assigned coordinates for ${cityName}: ${autoCoordinates.lat}, ${autoCoordinates.lng}`);
    }

    const listingData = {
      ...req.body,
      images,
      gallery: galleryUrls,
      coordinates,
      published: req.body.published || false,
      verified: req.body.verified || false,
      featured: req.body.featured || false,
      ownerName: req.body.ownerName || req.user.name,
      ownerEmail: req.body.ownerEmail || req.user.email,
      views: 0,
      weeklyBookings: 0,
      monthlyBookings: 0,
      videoUrl: req.body.videoUrl || '',
      virtualTour: req.body.virtualTour || '',
    };

    const listing = await PGListing.create(listingData);

    return successResponse(res, {
      statusCode: 201,
      message: 'PG listing created successfully',
      data: listing,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return errorResponse(res, {
        statusCode: 400,
        message: 'Validation error',
        errors: messages,
      });
    }
    
    if (error.code === 11000) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Listing with this name already exists',
      });
    }
    return next(error);
  }
};

// @desc    Update PG listing
// @route   PUT /api/pg/:id
// @access  Private/Admin
exports.updatePGListing = async (req, res, next) => {
  try {
    let listing = await PGListing.findById(req.params.id);

    if (!listing) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'PG listing not found',
      });
    }

    const updatePayload = { ...req.body };

    if (req.body.videoUrl !== undefined) {
      updatePayload.videoUrl = req.body.videoUrl;
    }
    if (req.body.virtualTour !== undefined) {
      // Validate YouTube URL
      const v = req.body.virtualTour;
      if (v && !/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(v)) {
        return errorResponse(res, {
          statusCode: 400,
          message: 'Invalid virtual tour URL. Only YouTube URLs (youtube.com or youtu.be) are allowed',
        });
      }
      updatePayload.virtualTour = v;
    }

    if (req.body.lat && req.body.lng) {
      updatePayload.coordinates = { lat: parseFloat(req.body.lat), lng: parseFloat(req.body.lng) };
    } else if (req.body.city && req.body.city !== listing.city) {
      const autoCoordinates = getCoordinatesByCity(req.body.city);
      updatePayload.coordinates = autoCoordinates;
    }

    if (Array.isArray(req.body.images) && req.body.images.length > 0) {
      const url = await uploadImage(req.body.images[0]);
      updatePayload.images = url ? [url] : listing.images;
    }

    if (Array.isArray(req.body.gallery) && req.body.gallery.length > 0) {
      const galleryUrls = await uploadGalleryImages(req.body.gallery);
      if (galleryUrls.length > 0) {
        updatePayload.gallery = galleryUrls;
      }
    }

    updatePayload.updatedAt = Date.now();

    listing = await PGListing.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      {
        new: true,
        runValidators: true,
      }
    );

    const responseData = listing.toObject();
    responseData.hasVirtualTour = !!(responseData.videoUrl || responseData.virtualTour);
    responseData.videoEmbedUrl = getYouTubeEmbedUrl(responseData.videoUrl);
    responseData.virtualTourType = responseData.videoUrl ? 'youtube' : responseData.virtualTour ? '3d-tour' : null;

    return successResponse(res, {
      message: 'PG listing updated successfully',
      data: responseData,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return errorResponse(res, {
        statusCode: 400,
        message: 'Validation error',
        errors: messages,
      });
    }
    
    if (error.name === 'CastError') {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid listing ID',
      });
    }
    return next(error);
  }
};

// @desc    Delete PG listing
// @route   DELETE /api/pg/:id
// @access  Private/Admin
exports.deletePGListing = async (req, res, next) => {
  try {
    const listing = await PGListing.findById(req.params.id);
    
    if (!listing) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'PG listing not found',
      });
    }
    
    await listing.deleteOne();
    
    return successResponse(res, {
      message: 'PG listing deleted successfully',
      data: {},
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid listing ID',
      });
    }
    return next(error);
  }
};

// @desc    Toggle listing status
// @route   PATCH /api/pg/:id/toggle-status
// @access  Private/Admin
exports.toggleStatus = async (req, res, next) => {
  try {
    const { field } = req.body;
    const validFields = ['published', 'featured', 'verified'];
    
    if (!field || !validFields.includes(field)) {
      return errorResponse(res, {
        statusCode: 400,
        message: `Invalid field. Must be one of: ${validFields.join(', ')}`,
      });
    }
    
    const listing = await PGListing.findById(req.params.id);
    
    if (!listing) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'PG listing not found',
      });
    }
    
    listing[field] = !listing[field];
    listing.updatedAt = Date.now();
    
    await listing.save();
    
    return successResponse(res, {
      message: `${field} status updated`,
      data: listing,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid listing ID',
      });
    }
    return next(error);
  }
};

// @desc    Get PG statistics
// @route   GET /api/pg/stats
// @access  Private/Admin
exports.getStats = async (req, res, next) => {
  try {
    const total = await PGListing.countDocuments();
    const published = await PGListing.countDocuments({ published: true });
    const featured = await PGListing.countDocuments({ featured: true });
    const verified = await PGListing.countDocuments({ verified: true });
    
    const withVirtualTour = await PGListing.countDocuments({
      $or: [
        { videoUrl: { $ne: '', $exists: true } },
        { virtualTour: { $ne: '', $exists: true } }
      ]
    });
    
    const boys = await PGListing.countDocuments({ type: 'boys' });
    const girls = await PGListing.countDocuments({ type: 'girls' });
    const coed = await PGListing.countDocuments({ type: 'co-ed' });
    
    return successResponse(res, {
      message: 'PG statistics fetched successfully',
      data: {
        total,
        published,
        draft: total - published,
        featured,
        verified,
        withVirtualTour,
        boys,
        girls,
        coed,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// @desc    Search PG listings
// @route   GET /api/pg/search
// @access  Public
exports.searchPGListings = async (req, res, next) => {
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
    
    const listings = await PGListing.find(query).sort('-createdAt').limit(20);
    
    const items = listings.map(pg => ({
      ...pg.toObject(),
      hasVirtualTour: !!(pg.videoUrl || pg.virtualTour),
      videoEmbedUrl: getYouTubeEmbedUrl(pg.videoUrl)
    }));

    return successResponse(res, {
      message: 'Search completed',
      data: {
        count: listings.length,
        items,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ========== MAP & LOCATION BASED FEATURES ==========

exports.getPGsForMap = async (req, res, next) => {
  try {
    const { lat, lng, radius = 10, limit = 100 } = req.query;
    
    let query = { 
      published: true,
      'coordinates.lat': { $ne: null, $exists: true },
      'coordinates.lng': { $ne: null, $exists: true }
    };
    
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      
      const allPGs = await PGListing.find(query)
        .select('_id name address city price type images rating reviewCount coordinates slug')
        .limit(parseInt(limit));
      
      const nearbyPGs = allPGs.filter(pg => {
        if (!pg.coordinates?.lat || !pg.coordinates?.lng) return false;
        
        const distance = calculateDistance(
          userLat, userLng,
          pg.coordinates.lat, pg.coordinates.lng
        );
        
        return distance <= parseFloat(radius);
      }).map(pg => ({
        ...pg.toObject(),
        distance: calculateDistance(
          userLat, userLng,
          pg.coordinates.lat, pg.coordinates.lng
        )
      }));
      
      nearbyPGs.sort((a, b) => a.distance - b.distance);
      
      return successResponse(res, {
        statusCode: 200,
        message: 'Nearby PGs fetched successfully',
        data: {
          count: nearbyPGs.length,
          items: nearbyPGs,
          userLocation: { lat: userLat, lng: userLng }
        }
      });
    }
    
    const pgs = await PGListing.find(query)
      .select('_id name address city price type images rating reviewCount coordinates slug')
      .limit(parseInt(limit));
    
    return successResponse(res, {
      statusCode: 200,
      message: 'Map data fetched successfully',
      data: {
        count: pgs.length,
        items: pgs
      }
    });
  } catch (error) {
    console.error('Get map data error:', error);
    return errorResponse(res, {
      statusCode: 500,
      message: 'Failed to fetch map data',
      errors: error.message
    });
  }
};

exports.getPGMapDetail = async (req, res, next) => {
  try {
    const pg = await PGListing.findById(req.params.id)
      .select('_id name address city price type images rating reviewCount coordinates slug description amenities');
    
    if (!pg) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'PG not found'
      });
    }
    
    let distance = null;
    if (req.query.lat && req.query.lng && pg.coordinates?.lat && pg.coordinates?.lng) {
      distance = calculateDistance(
        parseFloat(req.query.lat),
        parseFloat(req.query.lng),
        pg.coordinates.lat,
        pg.coordinates.lng
      );
    }
    
    return successResponse(res, {
      statusCode: 200,
      message: 'PG map detail fetched successfully',
      data: {
        pg,
        distance: distance ? `${distance.toFixed(1)} km` : null
      }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid PG ID'
      });
    }
    return next(error);
  }
};

exports.getPGsByCityForMap = async (req, res, next) => {
  try {
    const { city } = req.params;
    
    const pgs = await PGListing.find({
      city: { $regex: new RegExp(city, 'i') },
      published: true,
      'coordinates.lat': { $ne: null, $exists: true }
    }).select('_id name address city price type images rating reviewCount coordinates slug');
    
    return successResponse(res, {
      statusCode: 200,
      message: `PGs in ${city} fetched successfully`,
      data: pgs
    });
  } catch (error) {
    return next(error);
  }
};

// ========== DEMAND METER FEATURES ==========

exports.incrementViewCount = async (req, res, next) => {
  try {
    const pg = await PGListing.findById(req.params.id);
    
    if (!pg) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'PG not found'
      });
    }
    
    pg.views = (pg.views || 0) + 1;
    pg.lastViewUpdate = new Date();
    await pg.save();
    
    return successResponse(res, {
      message: 'View count updated',
      data: { views: pg.views }
    });
  } catch (error) {
    console.error('Increment view error:', error);
    return errorResponse(res, {
      statusCode: 500,
      message: error.message
    });
  }
};

exports.getDemandMeter = async (req, res, next) => {
  try {
    const pg = await PGListing.findById(req.params.id)
      .select('views weeklyBookings monthlyBookings rating reviewCount');
    
    if (!pg) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'PG not found'
      });
    }
    
    const views = pg.views || 0;
    const weeklyBookings = pg.weeklyBookings || 0;
    
    let demandLevel = 'Low';
    let demandColor = 'bg-green-500';
    let demandPercentage = 30;
    let demandMessage = '📈 Good availability. Book at your convenience.';
    
    if (views > 500 || weeklyBookings > 20) {
      demandLevel = 'Very High';
      demandColor = 'bg-red-500';
      demandPercentage = 95;
      demandMessage = '⚡ Only few slots left! Book now to secure your spot.';
    } else if (views > 200 || weeklyBookings > 10) {
      demandLevel = 'High';
      demandColor = 'bg-orange-500';
      demandPercentage = 85;
      demandMessage = '🔥 High demand! Limited availability. Book soon.';
    } else if (views > 100 || weeklyBookings > 5) {
      demandLevel = 'Medium';
      demandColor = 'bg-yellow-500';
      demandPercentage = 60;
      demandMessage = '📈 Good interest in this property. Check availability.';
    }
    
    return successResponse(res, {
      message: 'Demand meter data fetched',
      data: {
        views,
        weeklyBookings,
        monthlyBookings: pg.monthlyBookings || 0,
        rating: pg.rating || 4.5,
        reviewCount: pg.reviewCount || 0,
        demandLevel,
        demandColor,
        demandPercentage,
        demandMessage
      }
    });
  } catch (error) {
    console.error('Get demand meter error:', error);
    return errorResponse(res, {
      statusCode: 500,
      message: error.message
    });
  }
};

exports.getPopularPGs = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    
    const popularPGs = await PGListing.find({ published: true })
      .sort({ views: -1, weeklyBookings: -1 })
      .limit(parseInt(limit))
      .select('name price images city rating views weeklyBookings slug');
    
    return successResponse(res, {
      message: 'Popular PGs fetched successfully',
      data: popularPGs
    });
  } catch (error) {
    console.error('Get popular PGs error:', error);
    return errorResponse(res, {
      statusCode: 500,
      message: error.message
    });
  }
};

exports.incrementBookingCount = async (req, res, next) => {
  try {
    const pg = await PGListing.findById(req.params.id);
    
    if (!pg) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'PG not found'
      });
    }
    
    pg.weeklyBookings = (pg.weeklyBookings || 0) + 1;
    pg.monthlyBookings = (pg.monthlyBookings || 0) + 1;
    await pg.save();
    
    return successResponse(res, {
      message: 'Booking count updated',
      data: {
        weeklyBookings: pg.weeklyBookings,
        monthlyBookings: pg.monthlyBookings
      }
    });
  } catch (error) {
    console.error('Increment booking error:', error);
    return errorResponse(res, {
      statusCode: 500,
      message: error.message
    });
  }
};

// ========== Wishlist ==========

exports.addToWishlist = async (req, res, next) => {
  try {
    const pgId = req.params.id;

    const listing = await PGListing.findById(pgId);
    if (!listing) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'PG listing not found',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    const alreadyInWishlist = user.wishlist.some(
      (id) => id.toString() === pgId.toString()
    );

    if (alreadyInWishlist) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Listing already in wishlist',
      });
    }

    user.wishlist.push(pgId);
    await user.save();

    return successResponse(res, {
      message: 'Added to wishlist',
      data: {
        wishlistCount: user.wishlist.length,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.removeFromWishlist = async (req, res, next) => {
  try {
    const pgId = req.params.id;

    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    user.wishlist = user.wishlist.filter(
      (id) => id.toString() !== pgId.toString()
    );
    await user.save();

    return successResponse(res, {
      message: 'Removed from wishlist',
      data: {
        wishlistCount: user.wishlist.length,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'wishlist',
      select: 'name price city type images rating reviewCount featured verified coordinates slug',
    });

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    return successResponse(res, {
      message: 'Wishlist fetched successfully',
      data: {
        count: user.wishlist.length,
        items: user.wishlist,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ========== Compare ==========

exports.addToCompare = async (req, res, next) => {
  try {
    const pgId = req.params.id;

    const listing = await PGListing.findById(pgId);
    if (!listing) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'PG listing not found',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    const alreadyInCompare = user.compare.some(
      (id) => id.toString() === pgId.toString()
    );

    if (alreadyInCompare) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Listing already in compare list',
      });
    }

    if (user.compare.length >= 3) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Compare list can have at most 3 items',
      });
    }

    user.compare.push(pgId);
    await user.save();

    return successResponse(res, {
      message: 'Added to compare list',
      data: {
        compareCount: user.compare.length,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.removeFromCompare = async (req, res, next) => {
  try {
    const pgId = req.params.id;

    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    user.compare = user.compare.filter(
      (id) => id.toString() !== pgId.toString()
    );
    await user.save();

    return successResponse(res, {
      message: 'Removed from compare list',
      data: {
        compareCount: user.compare.length,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getCompareList = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'compare',
      select:
        'name price city type images rating reviewCount amenities roomTypes featured verified coordinates slug',
    });

    if (!user) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'User not found',
      });
    }

    return successResponse(res, {
      message: 'Compare list fetched successfully',
      data: {
        count: user.compare.length,
        items: user.compare,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ========== Detail ==========

exports.getPGDetail = async (req, res, next) => {
  try {
    const pgId = req.params.id;

    const listing = await PGListing.findById(pgId).lean();

    if (!listing) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'PG listing not found',
      });
    }

    const reviews = await Review.find({ pgListing: pgId })
      .populate('user', 'name')
      .sort('-createdAt')
      .limit(50)
      .lean();

    return successResponse(res, {
      message: 'PG detail fetched successfully',
      data: {
        listing,
        reviews: {
          count: reviews.length,
          items: reviews,
        },
        stats: {
          rating: listing.rating,
          reviewCount: listing.reviewCount,
        },
      },
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid listing ID',
      });
    }
    return next(error);
  }
};

// ========== VIRTUAL TOUR BULK OPERATIONS ==========

exports.bulkUpdateVirtualTour = async (req, res, next) => {
  try {
    const { ids, videoUrl, virtualTour } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide an array of property IDs'
      });
    }
    
    const updateData = {};
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (virtualTour !== undefined) updateData.virtualTour = virtualTour;
    
    if (Object.keys(updateData).length === 0) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide videoUrl or virtualTour to update'
      });
    }
    
    updateData.updatedAt = Date.now();
    
    const result = await PGListing.updateMany(
      { _id: { $in: ids } },
      { $set: updateData }
    );
    
    return successResponse(res, {
      message: `Virtual tour updated for ${result.modifiedCount} properties`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Bulk update virtual tour error:', error);
    return errorResponse(res, {
      statusCode: 500,
      message: error.message
    });
  }
};

exports.getPropertiesWithVirtualTour = async (req, res, next) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    
    const query = {
      published: true,
      $or: [
        { videoUrl: { $ne: '', $exists: true } },
        { virtualTour: { $ne: '', $exists: true } }
      ]
    };
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    const pgs = await PGListing.find(query)
      .select('_id name slug city price type images rating videoUrl virtualTour')
      .limit(limitNum)
      .skip(skip)
      .sort({ createdAt: -1 });
    
    const total = await PGListing.countDocuments(query);
    
    const items = pgs.map(pg => ({
      ...pg.toObject(),
      hasVirtualTour: true,
      videoEmbedUrl: getYouTubeEmbedUrl(pg.videoUrl),
      virtualTourType: pg.videoUrl ? 'youtube' : '3d-tour'
    }));
    
    return successResponse(res, {
      message: 'Properties with virtual tour fetched successfully',
      data: {
        count: items.length,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        items
      }
    });
  } catch (error) {
    console.error('Get properties with virtual tour error:', error);
    return errorResponse(res, {
      statusCode: 500,
      message: error.message
    });
  }
};