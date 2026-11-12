// backend/src/controllers/locationController.js
const mongoose = require('mongoose');
const PG = require('../models/PGListing');
const Location = require('../models/Location');
const {
  slugifyLocationName,
  locationPhraseFromSlug,
  buildLocationMatchQueryFromSlug,
  INACTIVE_AVAILABILITY_VALUES,
  ensureLocation,
  syncLocationMetadata,
  escapeRegex,
  generateLocationSlug,
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
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = Number(req.query.limit || 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return res.status(400).json({ success: false, message: 'Limit must be an integer from 1 to 50' });
    }

    if (q.length < 2) {
      return res.json({ success: true, data: [] });
    }
    const expression = new RegExp(escapeRegex(q), 'i');
    const locations = await Location.find({
      isActive: true,
      isIndexed: true,
      totalActiveListings: { $gt: 0 },
      $or: [{ name: expression }, { city: expression }],
    })
      .select('name city slug totalActiveListings image')
      .sort({ totalActiveListings: -1, name: 1 })
      .limit(limit)
      .lean();

    const data = locations.map((location) => ({
      name: location.name,
      locality: location.name,
      city: location.city,
      slug: location.slug,
      pgCount: location.totalActiveListings,
      propertyCount: location.totalActiveListings,
      image: location.image,
    }));
    if (data.length === 0) {
      const fallbackLocations = await PG.aggregate([
        {
          $match: {
            published: true,
            availability: { $nin: INACTIVE_AVAILABILITY_VALUES },
            $or: [{ locality: expression }, { city: expression }],
          },
        },
        {
          $addFields: {
            cleanLocality: { $trim: { input: { $ifNull: ['$locality', ''] } } },
            cleanCity: { $trim: { input: { $ifNull: ['$city', ''] } } },
          },
        },
        {
          $group: {
            _id: { locality: '$cleanLocality', city: { $toLower: '$cleanCity' } },
            name: { $first: '$cleanLocality' },
            city: { $first: '$cleanCity' },
            pgCount: { $sum: 1 },
            image: { $first: { $arrayElemAt: ['$images', 0] } },
          },
        },
        { $sort: { pgCount: -1, name: 1 } },
        { $limit: limit },
      ]);
      data.push(...fallbackLocations.map((location) => {
        const name = location.name || location.city;
        return {
          name,
          locality: location.name,
          city: location.city,
          slug: generateLocationSlug(location.name, location.city),
          pgCount: location.pgCount,
          propertyCount: location.pgCount,
          image: location.image,
        };
      }));
    }
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
    const city = String(req.params.city || '').trim();
    const limit = Number(req.query.limit || 20);
    if (!city || city.length > 100) {
      return res.status(400).json({ success: false, message: 'A valid city is required' });
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ success: false, message: 'Limit must be an integer from 1 to 100' });
    }

    const pgs = await PG.find({
      published: true,
      availability: { $nin: INACTIVE_AVAILABILITY_VALUES },
      city: { $regex: new RegExp(`^${escapeRegex(city)}$`, 'i') },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
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

const filterPGsByLocation = async (req, res) => {
  try {
    const filters = req.body || {};
    const {
      locationIds = [],
      minPrice,
      maxPrice,
      type,
      amenities = [],
      page = 1,
      limit = 12,
      sort = 'price_asc',
      latitude,
      longitude,
      maxDistanceKm,
    } = filters;

    if (!Array.isArray(locationIds) ||
        locationIds.some((id) => typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ success: false, message: 'Location IDs must be valid IDs' });
    }
    if (!locationIds.length) {
      return res.status(400).json({ success: false, message: 'At least one location is required' });
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const min = minPrice === undefined || minPrice === null || minPrice === '' ? undefined : Number(minPrice);
    const max = maxPrice === undefined || maxPrice === null || maxPrice === '' ? undefined : Number(maxPrice);
    const hasDistanceFilter = latitude !== undefined || longitude !== undefined || maxDistanceKm !== undefined;
    const hasNumericValue = (value) =>
      (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
      Number.isFinite(Number(value));
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    const parsedMaxDistanceKm = Number(maxDistanceKm);
    const sortOptions = {
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      rating: { rating: -1, reviewCount: -1 },
      newest: { createdAt: -1 },
    };

    if (!Number.isInteger(pageNum) || pageNum < 1 ||
        !Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100 ||
        typeof sort !== 'string' || !Object.prototype.hasOwnProperty.call(sortOptions, sort) ||
        (min !== undefined && (!Number.isFinite(min) || min < 0)) ||
        (max !== undefined && (!Number.isFinite(max) || max < 0)) ||
        (min !== undefined && max !== undefined && min > max) ||
        (locationIds.length > 50) ||
        (hasDistanceFilter && (
          !hasNumericValue(latitude) || parsedLatitude < -90 || parsedLatitude > 90 ||
          !hasNumericValue(longitude) || parsedLongitude < -180 || parsedLongitude > 180 ||
          !hasNumericValue(maxDistanceKm) || parsedMaxDistanceKm <= 0 || parsedMaxDistanceKm > 500
        ))) {
      return res.status(400).json({ success: false, message: 'Invalid listing filters' });
    }
    if (type !== undefined && type !== '' &&
        (typeof type !== 'string' || !['boys', 'girls', 'co-ed', 'family'].includes(type))) {
      return res.status(400).json({ success: false, message: 'Invalid property type' });
    }
    if (!Array.isArray(amenities) ||
        amenities.length > 20 ||
        amenities.some((amenity) => typeof amenity !== 'string' || !amenity.trim() || amenity.length > 100)) {
      return res.status(400).json({ success: false, message: 'Invalid amenities filter' });
    }

    const query = {
      locationId: { $in: locationIds.map((id) => new mongoose.Types.ObjectId(id)) },
      published: true,
      availability: { $nin: INACTIVE_AVAILABILITY_VALUES },
    };
    if (type) query.type = type;
    if (min !== undefined || max !== undefined) {
      query.price = {};
      if (min !== undefined) query.price.$gte = min;
      if (max !== undefined) query.price.$lte = max;
    }
    if (amenities.length) query.amenities = { $all: amenities.map((amenity) => amenity.trim()) };

    let items;
    let total;
    if (hasDistanceFilter) {
      const [result] = await PG.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [parsedLongitude, parsedLatitude],
            },
            key: 'location',
            distanceField: 'distanceMeters',
            maxDistance: parsedMaxDistanceKm * 1000,
            spherical: true,
            query: {
              ...query,
              'coordinates.lat': { $type: 'number' },
              'coordinates.lng': { $type: 'number' },
            },
          },
        },
        {
          $facet: {
            items: [
              { $sort: sortOptions[sort] },
              { $skip: (pageNum - 1) * limitNum },
              { $limit: limitNum },
            ],
            count: [{ $count: 'total' }],
          },
        },
      ]);
      items = result?.items || [];
      total = result?.count?.[0]?.total || 0;
    } else {
      [items, total] = await Promise.all([
        PG.find(query)
          .sort(sortOptions[sort])
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean(),
        PG.countDocuments(query),
      ]);
    }

    return res.json({
      success: true,
      data: {
        items,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Filter PGs by location error:', error);
    return res.status(500).json({ success: false, message: 'Unable to filter properties by location' });
  }
};

const calculateDistance = async (req, res) => {
  try {
    const { pgId, userLat, userLng } = req.body || {};
    const hasCoordinateValue = (value) =>
      (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
      Number.isFinite(Number(value));
    const latitude = Number(userLat);
    const longitude = Number(userLng);
    if (!mongoose.Types.ObjectId.isValid(pgId) ||
        !hasCoordinateValue(userLat) || latitude < -90 || latitude > 90 ||
        !hasCoordinateValue(userLng) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ success: false, message: 'Valid property and coordinate values are required' });
    }

    const pg = await PG.findOne({
      _id: pgId,
      published: true,
      availability: { $nin: INACTIVE_AVAILABILITY_VALUES },
    }).select('coordinates location').lean();
    if (!pg) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    let pgLat = pg.coordinates?.lat;
    let pgLng = pg.coordinates?.lng;
    if (!Number.isFinite(pgLat) || !Number.isFinite(pgLng)) {
      const [geoLng, geoLat] = pg.location?.coordinates || [];
      if (geoLng === 0 && geoLat === 0) {
        return res.status(422).json({ success: false, message: 'Property coordinates are unavailable' });
      }
      pgLat = geoLat;
      pgLng = geoLng;
    }
    if (!Number.isFinite(pgLat) || pgLat < -90 || pgLat > 90 ||
        !Number.isFinite(pgLng) || pgLng < -180 || pgLng > 180) {
      return res.status(422).json({ success: false, message: 'Property coordinates are unavailable' });
    }

    const radians = (degrees) => degrees * (Math.PI / 180);
    const deltaLat = radians(pgLat - latitude);
    const deltaLng = radians(pgLng - longitude);
    const haversine = Math.sin(deltaLat / 2) ** 2 +
      Math.cos(radians(latitude)) * Math.cos(radians(pgLat)) *
      Math.sin(deltaLng / 2) ** 2;
    const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

    return res.json({
      success: true,
      data: { pgId: pg._id, distanceKm: Number(distanceKm.toFixed(2)), unit: 'km' },
    });
  } catch (error) {
    console.error('Calculate property distance error:', error);
    return res.status(500).json({ success: false, message: 'Unable to calculate property distance' });
  }
};

const updateLocationCounts = async (req, res) => {
  try {
    const identifier = String(req.params.id || '').trim();
    const location = mongoose.Types.ObjectId.isValid(identifier)
      ? await Location.findById(identifier).select('slug')
      : await Location.findOne({ slug: identifier.toLowerCase() }).select('slug');

    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    const updatedLocation = await syncLocationMetadata(location.slug);
    return res.json({
      success: true,
      message: 'Location listing counts synchronized',
      data: updatedLocation,
    });
  } catch (error) {
    console.error('Update location counts error:', error);
    return res.status(500).json({ success: false, message: 'Unable to synchronize location counts' });
  }
};

const createLocation = async (req, res) => {
  try {
    const { name, city } = req.body || {};
    if (typeof name !== 'string' || typeof city !== 'string' ||
        !name.trim() || !city.trim() || name.trim().length > 120 || city.trim().length > 120) {
      return res.status(400).json({ success: false, message: 'A valid location name and city are required' });
    }

    const { location, created } = await ensureLocation(name, city);
    const updatedLocation = await syncLocationMetadata(location.slug);
    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Location created' : 'Location updated',
      data: updatedLocation,
    });
  } catch (error) {
    console.error('Create location error:', error);
    return res.status(500).json({ success: false, message: 'Unable to create location' });
  }
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
