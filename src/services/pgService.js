// src/services/pgService.js
const PGListing = require('../models/PGListing');
const User = require('../models/User');
const { getCoordinatesByCity, getYouTubeEmbedUrl, normalizeListingRooms, syncRoomInventoryFromCounts } = require('../utils/pgHelpers');
const { ensureLocation, syncLocationMetadata } = require('../utils/locationUtils');
const { uploadImage, uploadGalleryImages } = require('../utils/cloudinary');

let cache;
try {
  cache = require('../services/cache');
} catch (error) {
  cache = null;
}

class PGService {
  async fetchListings(queryFilters) {
    const { type, published, featured, verified, search, minPrice, maxPrice, city, availability, hasVirtualTour, sort = '-createdAt', page = 1, limit = 20 } = queryFilters;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const cacheKey = `pg_list_${type || 'all'}_${city || 'all'}_${sort}`;
    if (cache && !search && !minPrice && !maxPrice && pageNum === 1 && limitNum >= 20) {
      const cached = cache.get(cacheKey);
      if (cached) return { items: cached, total: cached.length, cached: true };
    }

    let query = {};
    if (published === 'true') query.published = true;
    if (published === 'false') query.published = false;
    if (featured === 'true') query.featured = true;
    if (verified === 'true') query.verified = true;
    if (city) query.city = new RegExp(city, 'i');
    if (availability) query.availability = availability;

    if (hasVirtualTour === 'true') {
      query.$or = [{ videoUrl: { $ne: '', $exists: true } }, { virtualTour: { $ne: '', $exists: true } }];
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
        { city: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (pageNum - 1) * limitNum;
    
    // Populate owner details from User collection
    let listings = await PGListing.find(query)
      .populate('owner', 'name email phone')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    listings = listings.map((listing) => {
      const listingObj = normalizeListingRooms(listing);
      
      // ✅ Smart Fallback: If owner is populated, use it. Otherwise fallback to stored owner fields or default profile (Rohit)
      if (listing.owner && typeof listing.owner === 'object') {
        listingObj.ownerName = listing.owner.name;
        listingObj.ownerEmail = listing.owner.email;
        listingObj.ownerPhone = listing.owner.phone;
      } else {
        // Fallback for legacy records where owner relation wasn't stored
        listingObj.ownerName = listing.ownerName || 'Rohit';
        listingObj.ownerEmail = listing.ownerEmail || 'acquarohit@gmail.com';
        listingObj.ownerPhone = listing.ownerPhone || '9592135196';
      }

      listingObj.hasVirtualTour = !!(listingObj.videoUrl || listingObj.virtualTour);
      listingObj.videoEmbedUrl = getYouTubeEmbedUrl(listingObj.videoUrl);
      listingObj.virtualTourType = listingObj.videoUrl ? 'youtube' : listingObj.virtualTour ? '3d-tour' : null;

      let hasValidCoords = listingObj.coordinates?.lat && listingObj.coordinates.lat !== 0 && listingObj.coordinates?.lng && listingObj.coordinates.lng !== 0;
      if (!hasValidCoords && listingObj.location?.coordinates?.length === 2) {
        const [lng, lat] = listingObj.location.coordinates;
        if (lat && lng && lat !== 0 && lng !== 0) {
          listingObj.coordinates = { lat, lng };
          hasValidCoords = true;
        }
      }
      if (!hasValidCoords) {
        listingObj.coordinates = getCoordinatesByCity(listingObj.city);
      }
      return listingObj;
    });

    const total = await PGListing.countDocuments(query);
    return { items: listings, total, page: pageNum, pages: Math.ceil(total / limitNum) };
  }

  async createListing(bodyData, user) {
    const { name, city, ownerEmail } = bodyData;
    const existingPG = await PGListing.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      city: { $regex: new RegExp(`^${city}$`, 'i') },
      ownerEmail: ownerEmail || user.email,
    });

    if (existingPG) throw new Error('DUPLICATE_PG');

    const primaryImageUrl = bodyData.images?.[0] ? await uploadImage(bodyData.images[0]) : null;
    const galleryUrls = await uploadGalleryImages(bodyData.gallery || []);

    const images = primaryImageUrl ? [primaryImageUrl] : [];
    const coordinates = bodyData.lat && bodyData.lng ? { lat: parseFloat(bodyData.lat), lng: parseFloat(bodyData.lng) } : getCoordinatesByCity(city);

    const listingData = {
      ...bodyData,
      owner: user._id, // Automatically map logged-in user as owner
      images,
      gallery: galleryUrls,
      coordinates,
      published: bodyData.published || false,
      verified: bodyData.verified || false,
      featured: bodyData.featured || false,
      ownerName: bodyData.ownerName || user.name,
      ownerEmail: bodyData.ownerEmail || user.email,
      ownerPhone: bodyData.ownerPhone || user.phone,
      views: 0,
      weeklyBookings: 0,
      monthlyBookings: 0,
    };

    syncRoomInventoryFromCounts(listingData);
    const { location } = await ensureLocation(listingData.locality, listingData.city || 'Chandigarh');
    listingData.locationSlug = location.slug;
    listingData.locationId = location._id;

    const listing = await PGListing.create(listingData);
    await syncLocationMetadata(location.slug);
    if (cache && typeof cache.clear === 'function') cache.clear();

    return listing;
  }
}

module.exports = new PGService();