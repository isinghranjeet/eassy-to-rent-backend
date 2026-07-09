const PG = require('../models/PGListing');

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

module.exports = {
  getProperties,
  getPropertyBySlug,
};

