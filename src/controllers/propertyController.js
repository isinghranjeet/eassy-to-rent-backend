const PG = require('../models/PGListing');
const Location = require('../models/Location');
const { INACTIVE_AVAILABILITY_VALUES } = require('../utils/locationUtils');

// Allowed location slugs as per your frontend
const ALLOWED_LOCATION_SLUGS = new Set([
  'gharaun','gharuan',
  'kharar',
  'landran',
  'mohali',
  'banur',
  'zirakpur',
]);

const normalizeLocation = (location) => {
  if (!location) return null;
  const slug = String(location).trim().toLowerCase();
  if (!slug) return null;

  // If user passes full city name, keep best-effort conversion.
  // If user passes known slug, map to expected city name for PGListing.city.
  const cityFromSlug = {
    gharuan: 'Gharuan',
    gharaun: 'Gharuan',
    kharar: 'Kharar',
    landran: 'Landran',
    mohali: 'Mohali',
  };

  const city = cityFromSlug[slug];
  if (city) return city;

  // Fallback: treat as city name
  return slug
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const parseNumber = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// @route   GET /api/properties
// @desc    List properties with filters, sorting, pagination
// @access  Public
const getProperties = async (req, res) => {
  try {
    const {
      location,
      page = '1',
      limit = '12',
      minPrice,
      maxPrice,
      type,
      sort = 'price_asc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const query = { published: true };

    // location -> city
    const city = normalizeLocation(location);
    if (city) {
      // exact city match ignoring case
      query.city = { $regex: new RegExp(`^${city}$`, 'i') };
    }

    // type
    if (type && String(type).toLowerCase() !== 'all') {
      const t = String(type).toLowerCase();
      // PGListing has enum: ['boys','girls','co-ed','family']
      if (t === 'co-ed' || t === 'coed') query.type = 'co-ed';
      else if (t === 'boys' || t === 'girls') query.type = t;
      else if (t === 'family') query.type = 'family';
    }

    // price range
    const min = parseNumber(minPrice);
    const max = parseNumber(maxPrice);
    if (min !== null || max !== null) {
      query.price = {};
      if (min !== null) query.price.$gte = min;
      if (max !== null) query.price.$lte = max;
    }

    // sort
    const sortKey = String(sort).toLowerCase();
    let mongoSort = { price: 1 };
    if (sortKey === 'price_desc') mongoSort = { price: -1 };
    else if (sortKey === 'rating') mongoSort = { rating: -1 };
    else if (sortKey === 'price_asc') mongoSort = { price: 1 };

    const [total, items] = await Promise.all([
      PG.countDocuments(query),
      PG.find(query)
        .sort(mongoSort)
        .limit(limitNum)
        .skip(skip)
        .lean(),
    ]);

    const pages = Math.max(1, Math.ceil(total / limitNum));

    return res.json({
      success: true,
      data: {
        items,
        total,
        page: pageNum,
        pages,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @route   GET /api/properties/:slug
// @desc    Get single property by slug
// @access  Public
const getPropertyBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const property = await PG.findOne({ slug, published: true }).lean();
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    return res.json({ success: true, data: property });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @route   GET /api/properties/location/:slug
// @desc    List active properties assigned to a location landing page
// @access  Public
const getPropertiesByLocation = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return res.status(400).json({ success: false, message: 'Invalid location slug' });
    }

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 12);
    const sort = String(req.query.sort || 'price_asc');
    const sortOptions = {
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      rating: { rating: -1, reviewCount: -1 },
      newest: { createdAt: -1 },
    };

    if (!Number.isInteger(page) || page < 1 ||
        !Number.isInteger(limit) || limit < 1 || limit > 100 ||
        !sortOptions[sort]) {
      return res.status(400).json({ success: false, message: 'Invalid pagination or sort options' });
    }

    const location = await Location.findOne({ slug }).select('_id').lean();
    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    const query = {
      locationSlug: slug,
      published: true,
      availability: { $nin: INACTIVE_AVAILABILITY_VALUES },
    };
    const [items, total] = await Promise.all([
      PG.find(query)
        .sort(sortOptions[sort])
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PG.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: {
        items,
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get properties by location error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load properties for this location' });
  }
};

module.exports = {
  getProperties,
  getPropertiesByLocation,
  getPropertyBySlug,
};

