const PGListing = require('../../models/PGListing');
const { successResponse, errorResponse } = require('../../utils/response');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { fillMissingPGSeo } = require('../../utils/pgSeo');

const getAdminPGs = asyncHandler(async (req, res) => {
  const {
    status,
    city,
    type,
    search,
    verified,
    featured,
    published,
    minPrice,
    maxPrice,
    sort = '-createdAt',
    page = 1,
    limit = 20
  } = req.query;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  let query = {};

  if (status) {
    switch (status.toLowerCase()) {
      case 'published': query.published = true; break;
      case 'unpublished': query.published = false; break;
      case 'verified': query.verified = true; break;
      case 'pending': query.verified = false; query.published = true; break;
      case 'unverified': query.verified = false; break;
      case 'featured': query.featured = true; break;
      case 'draft': query.published = false; break;
      default: break;
    }
  }

  if (verified !== undefined) query.verified = verified === 'true';
  if (featured !== undefined) query.featured = featured === 'true';
  if (published !== undefined) query.published = published === 'true';

  if (city && city !== 'all') {
    query.city = { $regex: city, $options: 'i' };
  }

  if (type && type !== 'all') {
    query.type = type.toLowerCase();
  }

  if (minPrice !== undefined) {
    query.price = { ...query.price, $gte: parseFloat(minPrice) };
  }

  if (maxPrice !== undefined) {
    query.price = { ...query.price, $lte: parseFloat(maxPrice) };
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { address: { $regex: search, $options: 'i' } },
      { city: { $regex: search, $options: 'i' } },
      { ownerName: { $regex: search, $options: 'i' } },
      { ownerEmail: { $regex: search, $options: 'i' } }
    ];
  }

  const [pgs, total] = await Promise.all([
    PGListing.find(query).sort(sort).skip(skip).limit(limitNum).lean(),
    PGListing.countDocuments(query)
  ]);

  const items = pgs.map((pg) => ({
    ...pg,
    hasVirtualTour: !!(pg.videoUrl || pg.virtualTour),
    statusLabel: pg.published ? (pg.verified ? 'Live' : 'Pending') : 'Draft'
  }));

  return successResponse(res, {
    message: 'PG listings fetched successfully',
    data: { count: items.length, total, page: pageNum, pages: Math.ceil(total / limitNum), items }
  });
});

const updatePGStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { field, value } = req.body;

  const validFields = ['published', 'featured', 'verified', 'adminRecommended'];
  if (!field || !validFields.includes(field)) {
    return errorResponse(res, { statusCode: 400, message: `Invalid field. Must be: ${validFields.join(', ')}` });
  }

  const pg = await PGListing.findById(id);
  if (!pg) {
    return errorResponse(res, { statusCode: 404, message: 'PG listing not found' });
  }

  pg[field] = value;
  if ((field === 'verified' && value === true) || (field === 'published' && value === true && pg.verified)) {
    fillMissingPGSeo(pg);
  }
  pg.updatedAt = Date.now();
  await pg.save();

  return successResponse(res, { message: `PG ${field} updated successfully`, data: pg });
});

module.exports = { getAdminPGs, updatePGStatus };