// backend/src/controllers/locationController.js
const PG = require('../models/PGListing');

// @desc    Get all unique locations from PGs (DYNAMIC)
// @route   GET /api/locations
// @access  Public
const getLocations = async (req, res) => {
  try {
    const locations = await PG.aggregate([
      { $match: { published: true } },
      {
        $group: {
          _id: "$city",
          count: { $sum: 1 },
          image: { $first: { $arrayElemAt: ["$images", 0] } }
        }
      },
      {
        $project: {
          name: "$_id",
          slug: { $toLower: { $replaceAll: { input: "$_id", find: " ", replacement: "-" } } },
          pgCount: "$count",
          image: { $ifNull: ["$image", "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=500"] },
          _id: 0
        }
      },
      { $sort: { pgCount: -1 } }
    ]);
    
    res.json({ success: true, data: locations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get popular locations (for carousel)
// @route   GET /api/locations/popular
// @access  Public
const getPopularLocations = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const locations = await PG.aggregate([
      { $match: { published: true } },
      {
        $group: {
          _id: "$city",
          count: { $sum: 1 },
          image: { $first: { $arrayElemAt: ["$images", 0] } }
        }
      },
      {
        $project: {
          name: "$_id",
          slug: { $toLower: { $replaceAll: { input: "$_id", find: " ", replacement: "-" } } },
          pgCount: "$count",
          image: { $ifNull: ["$image", "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=500"] }
        }
      },
      { $sort: { pgCount: -1 } },
      { $limit: parseInt(limit) }
    ]);
    
    res.json({ success: true, data: locations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Search locations (autocomplete)
// @route   GET /api/locations/search
// @access  Public
const searchLocations = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }
    
    const locations = await PG.aggregate([
      { $match: { published: true, city: { $regex: q, $options: 'i' } } },
      { $group: { _id: "$city", count: { $sum: 1 } } },
      {
        $project: {
          name: "$_id",
          slug: { $toLower: { $replaceAll: { input: "$_id", find: " ", replacement: "-" } } },
          pgCount: "$count"
        }
      },
      { $limit: parseInt(limit) }
    ]);
    
    res.json({ success: true, data: locations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single location with PGs
// @route   GET /api/locations/:slug
// @access  Public
const getLocationBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 12, sort = "price_asc", type, minPrice, maxPrice } = req.query;
    
    const cityName = slug.replace(/-/g, ' ');
    
    let pgQuery = {
      published: true,
      city: { $regex: new RegExp(`^${cityName}$`, 'i') }
    };
    
    if (type) pgQuery.type = type;
    if (minPrice || maxPrice) {
      pgQuery.price = {};
      if (minPrice) pgQuery.price.$gte = parseInt(minPrice);
      if (maxPrice) pgQuery.price.$lte = parseInt(maxPrice);
    }
    
    let pgSort = { price: 1 };
    if (sort === "price_desc") pgSort = { price: -1 };
    else if (sort === "rating") pgSort = { rating: -1 };
    
    const pgs = await PG.find(pgQuery)
      .sort(pgSort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const totalPGs = await PG.countDocuments(pgQuery);
    
    const firstPG = await PG.findOne({ city: { $regex: new RegExp(`^${cityName}$`, 'i') } });
    const locationImage = firstPG?.images?.[0] || "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=500";
    
    res.json({
      success: true,
      data: {
        location: { name: cityName, slug, pgCount: totalPGs, image: locationImage },
        pgs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalPGs / parseInt(limit)),
          totalItems: totalPGs,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Placeholder functions (if needed by routes)
const filterPGsByLocation = async (req, res) => {
  res.json({ success: true, message: "Filter PGs by location - Coming soon" });
};

const calculateDistance = async (req, res) => {
  res.json({ success: true, message: "Distance calculator - Coming soon" });
};

const updateLocationCounts = async (req, res) => {
  res.json({ success: true, message: "Update counts - Coming soon" });
};

const createLocation = async (req, res) => {
  res.json({ success: true, message: "Create location - Coming soon" });
};

module.exports = {
  getLocations,
  getPopularLocations,
  searchLocations,
  getLocationBySlug,
  filterPGsByLocation,
  calculateDistance,
  updateLocationCounts,
  createLocation
};