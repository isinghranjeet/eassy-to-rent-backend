// backend/src/controllers/locationController.js
const PG = require('../models/PGListing');
const Location = require('../models/Location');
const {
  slugifyLocationName,
  locationPhraseFromSlug,
  buildLocationMatchQueryFromSlug,
  INACTIVE_AVAILABILITY_VALUES,
} = require('../utils/locationUtils');

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
          slug: { $toLower: { $replaceAll: { input: { $trim: { input: "$_id" } }, find: " ", replacement: "-" } } },
          pgCount: "$count",
          image: { $ifNull: ["$image", "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=500"] },
          _id: 0
        }
      },
      { $sort: { pgCount: -1 } }
    ]);

    // Ensure slugging stays consistent with other location endpoints
    const data = (locations || []).map((l) => ({
      ...l,
      slug: slugifyLocationName(l?.name),
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get top locations by live database aggregation
// @route   GET /api/locations/top
// @access  Public
const getTopLocations = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({ success: false, message: 'Limit must be an integer from 1 to 100' });
    }
    const limitNum = parsedLimit;

    const indexedLocations = await Location.find({
      isIndexed: true,
      totalActiveListings: { $gt: 0 },
    })
      .sort({ totalActiveListings: -1 })
      .limit(limitNum)
      .lean();

    if (indexedLocations.length > 0) {
      return res.json({
        success: true,
        data: indexedLocations.map((location) => ({
          name: location.name,
          city: location.city,
          slug: location.slug,
          propertyCount: location.totalActiveListings,
          pgCount: location.totalActiveListings,
          image: location.image,
        })),
      });
    }

    // Debug logging
    const totalListingsCount = await PG.countDocuments({});
    const publishedListingsCount = await PG.countDocuments({ published: true });

    // Location fields actually present in schema:
    // city, locality (preferred); address is a string; no separate address.city/address.locality fields.


    // IMPORTANT: use $aggregate with real schema fields only
    const locations = await PG.aggregate([
      {
        $match: {
          published: true,
        },
      },
      {
        // Prefer locality; fallback to city
        $addFields: {
          localityTrimmed: {
            $trim: { input: { $ifNull: ['$locality', ''] } },
          },
          cityTrimmed: {
            $trim: { input: { $ifNull: ['$city', ''] } },
          },
        },
      },
      {
        $addFields: {
          chosenLocationName: {
            $cond: [
              { $ne: ['$localityTrimmed', ''] },
              '$localityTrimmed',
              '$cityTrimmed',
            ],
          },
          chosenLocationNormalized: {
            $toLower: {
              // NOTE: avoid $regexReplace for older MongoDB versions.
              // We normalize more aggressively in Node (slugifyLocationName).
              $cond: [
                { $ne: ['$localityTrimmed', ''] },
                '$localityTrimmed',
                '$cityTrimmed',
              ],
            },
          },
        },
      },
      {
        $match: {
          chosenLocationNormalized: { $ne: '' },
        },
      },
      {
        $group: {
          _id: '$chosenLocationNormalized',
          propertyCount: { $sum: 1 },
          name: {
            // Keep a representative (non-normalized) value
            $first: '$chosenLocationName',
          },
        },
      },
      {
        $project: {
          _id: 0,
          name: '$name',
          slug: {
            $toLower: {
              $replaceAll: {
                input: {
                  $replaceAll: {
                    input: { $trim: { input: '$name' } },
                    find: ' ',
                    replacement: '-',
                  },
                },
                find: '.',
                replacement: '',
              },
            },
          },
          propertyCount: 1,
        },
      },
      { $match: { propertyCount: { $gte: 1 } } },
      { $sort: { propertyCount: -1 } },
      { $limit: limitNum },
    ]);

    // matched listings count (for debug)
    const matchedListingsCount = await PG.countDocuments({
      published: true,
      $or: [
        { locality: { $exists: true, $ne: '' } },
        { city: { $exists: true, $ne: '' } },
      ],
    });

    console.log('[locations/top] totalListingsCount=', totalListingsCount);
    console.log('[locations/top] publishedListingsCount=', publishedListingsCount);
    console.log('[locations/top] matchedListingsCount=', matchedListingsCount);
    console.log('[locations/top] aggregationOutput=', locations);

    // Ensure consistent slugging between endpoints (aggregation slug may differ subtly)
    const data = (locations || []).map((l) => ({
      ...l,
      slug: slugifyLocationName(l?.name),
    }));

    // Final response
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Get top locations error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};



// @desc    Get popular locations (for carousel)
// @route   GET /api/locations/popular
// @access  Public
const getPopularLocations = async (req, res) => {
  try {
    const { limit = 8 } = req.query;
    const limitNum = Number(limit);
    if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ success: false, message: 'Limit must be an integer from 1 to 100' });
    }

    const indexedLocations = await Location.find({
      isIndexed: true,
      totalActiveListings: { $gt: 0 },
    })
      .sort({ totalActiveListings: -1 })
      .limit(limitNum)
      .lean();

    if (indexedLocations.length > 0) {
      return res.json({
        success: true,
        data: indexedLocations.map((location) => ({
          name: location.name,
          city: location.city,
          slug: location.slug,
          pgCount: location.totalActiveListings,
          propertyCount: location.totalActiveListings,
          image: location.image,
        })),
      });
    }

    const locations = await PG.aggregate([
      { $match: { published: true, city: { $ne: null, $exists: true, $ne: '' } } },
      {
        $group: {
          _id: "$city",
          count: { $sum: 1 },
          image: { $first: { $arrayElemAt: ["$images", 0] } },
        },
      },
      {
        $project: {
          name: "$_id",
          slug: { $toLower: { $replaceAll: { input: "$_id", find: " ", replacement: "-" } } },
          pgCount: "$count",
          image: { $ifNull: ["$image", "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=500"] },
          _id: 0,
        },
      },
      { $sort: { pgCount: -1 } },
      { $limit: limitNum },
    ]);

    const data = (locations || []).map((l) => ({ ...l, slug: slugifyLocationName(l?.name) }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get popular locations error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get active, indexable location slugs for the sitemap
// @route   GET /api/locations/sitemap-slugs
// @access  Public
const getSitemapSlugs = async (req, res) => {
  try {
    const locations = await Location.find({
      isIndexed: true,
      totalActiveListings: { $gt: 0 },
    })
      .select('slug updatedAt')
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: locations.map(({ slug, updatedAt }) => ({ slug, updatedAt })),
    });
  } catch (error) {
    console.error('Get sitemap location slugs error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load location sitemap data' });
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
          pgCount: "$count",
          _id: 0
        }
      },
      { $limit: parseInt(limit) }
    ]);

    const data = (locations || []).map((l) => ({ ...l, slug: slugifyLocationName(l?.name) }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Search locations error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single location with PGs
// @route   GET /api/locations/:slug
// @access  Public
const getLocationBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const { page = 1, limit = 12, sort = "price_asc", type, minPrice, maxPrice } = req.query;

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return res.status(400).json({ success: false, message: 'Invalid location slug' });
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const min = minPrice === undefined ? undefined : Number(minPrice);
    const max = maxPrice === undefined ? undefined : Number(maxPrice);
    const allowedSorts = ['price_asc', 'price_desc', 'rating', 'newest'];

    if (!Number.isInteger(pageNum) || pageNum < 1 ||
        !Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100 ||
        !allowedSorts.includes(String(sort)) ||
        (min !== undefined && (!Number.isFinite(min) || min < 0)) ||
        (max !== undefined && (!Number.isFinite(max) || max < 0)) ||
        (min !== undefined && max !== undefined && min > max)) {
      return res.status(400).json({ success: false, message: 'Invalid location listing filters' });
    }

    const location = await Location.findOne({ slug }).lean();
    const pgQuery = location
      ? {
          locationSlug: slug,
          published: true,
          availability: { $nin: INACTIVE_AVAILABILITY_VALUES },
        }
      : buildLocationMatchQueryFromSlug(slug);
    
    if (type && type !== 'all') {
      const normalizedType = String(type).toLowerCase();
      if (!['boys', 'girls', 'co-ed', 'family'].includes(normalizedType)) {
        return res.status(400).json({ success: false, message: 'Invalid property type' });
      }
      pgQuery.type = normalizedType;
    }
    if (min !== undefined || max !== undefined) {
      pgQuery.price = {};
      if (min !== undefined) pgQuery.price.$gte = min;
      if (max !== undefined) pgQuery.price.$lte = max;
    }
    
    let pgSort = { price: 1 };
    if (sort === "price_desc") pgSort = { price: -1 };
    else if (sort === "rating") pgSort = { rating: -1 };
    else if (sort === "newest") pgSort = { createdAt: -1 };
    
    const skip = (pageNum - 1) * limitNum;

    const [pgs, totalPGs, firstPG] = await Promise.all([
      PG.find(pgQuery).sort(pgSort).limit(limitNum).skip(skip).lean(),
      PG.countDocuments(pgQuery),
      PG.findOne(pgQuery).select('images').lean(),
    ]);

    const locationData = location || {
      name: locationPhraseFromSlug(slug),
      city: locationPhraseFromSlug(slug),
      slug,
      totalActiveListings: totalPGs,
      pgCount: totalPGs,
      averageRent: 0,
      isIndexed: totalPGs > 0,
    };

    return res.json({
      success: true,
      data: {
        location: {
          ...locationData,
          pgCount: location?.totalActiveListings ?? totalPGs,
          image: location?.image || firstPG?.images?.[0] ||
            "https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=500",
        },
        pgs,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalPGs / limitNum),
          totalItems: totalPGs,
          itemsPerPage: limitNum
        }
      }
    });
  } catch (error) {
    console.error('Get location by slug error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get PGs by city name (simple version)
// @route   GET /api/locations/city/:city
// @access  Public
const getPGsByCity = async (req, res) => {
  try {
    const { city } = req.params;
    const { limit = 20 } = req.query;
    
    const pgs = await PG.find({
      published: true,
      city: { $regex: new RegExp(`^${city}$`, 'i') }
    }).limit(parseInt(limit));
    
    res.json({
      success: true,
      data: {
        count: pgs.length,
        items: pgs
      }
    });
  } catch (error) {
    console.error('Get PGs by city error:', error);
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
  getTopLocations,
  getPopularLocations,
  searchLocations,
  getSitemapSlugs,
  getLocationBySlug,
  getPGsByCity,
  filterPGsByLocation,
  calculateDistance,
  updateLocationCounts,
  createLocation,
};
