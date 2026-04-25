const PGListing = require('../models/PGListing');
const Booking = require('../models/Booking');
const Wishlist = require('../models/Wishlist');

// Get personalized recommendations based on user activity
const getPersonalizedRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    // Get user's booking history
    const userBookings = await Booking.find({ 
      userId, 
      status: { $in: ['confirmed', 'completed'] } 
    }).populate('pgId');

    // Get user's wishlist
    const wishlist = await Wishlist.findOne({ userId }).populate('pgs');
    
    // Extract preferred cities from user activity
    const preferredCities = new Set();
    const preferredTypes = new Set();
    
    // Analyze bookings
    userBookings.forEach(booking => {
      if (booking.pgId) {
        if (booking.pgId.city) preferredCities.add(booking.pgId.city);
        if (booking.pgId.type) preferredTypes.add(booking.pgId.type);
      }
    });
    
    // Analyze wishlist
    if (wishlist?.pgs) {
      wishlist.pgs.forEach(pg => {
        if (pg.city) preferredCities.add(pg.city);
        if (pg.type) preferredTypes.add(pg.type);
      });
    }
    
    // Build recommendation query
    let query = { published: true };
    
    if (preferredCities.size > 0) {
      query.city = { $in: Array.from(preferredCities) };
    }
    
    // Get recommendations
    let recommendations = await PGListing.find(query)
      .sort({ featured: -1, rating: -1, createdAt: -1 })
      .limit(parseInt(limit));
    
    // If not enough recommendations, add top-rated PGs
    if (recommendations.length < limit) {
      const existingIds = recommendations.map(r => r._id);
      const additionalCount = parseInt(limit) - recommendations.length;
      
      const topRated = await PGListing.find({
        _id: { $nin: existingIds },
        published: true
      })
        .sort({ rating: -1, reviewCount: -1 })
        .limit(additionalCount);
      
      recommendations = [...recommendations, ...topRated];
    }

    res.json({
      success: true,
      recommendations: recommendations,
      userPreferences: {
        cities: Array.from(preferredCities),
        types: Array.from(preferredTypes)
      }
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    // Return default recommendations on error
    const defaultRecommendations = await PGListing.find({ published: true })
      .sort({ featured: -1, rating: -1 })
      .limit(parseInt(req.query.limit || 8));
      
    res.json({
      success: true,
      recommendations: defaultRecommendations,
      userPreferences: { cities: [], types: [] }
    });
  }
};

// Get trending PGs based on recent activity
const getTrendingPGs = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Get PGs with most bookings and high ratings
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Aggregate bookings from last 30 days
    const trendingPGs = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          status: { $in: ['confirmed', 'completed'] }
        }
      },
      {
        $group: {
          _id: '$pgId',
          bookingCount: { $sum: 1 }
        }
      },
      {
        $sort: { bookingCount: -1 }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $lookup: {
          from: 'pgl listings',
          localField: '_id',
          foreignField: '_id',
          as: 'pgDetails'
        }
      },
      {
        $unwind: '$pgDetails'
      },
      {
        $project: {
          _id: '$pgDetails._id',
          name: '$pgDetails.name',
          price: '$pgDetails.price',
          city: '$pgDetails.city',
          locality: '$pgDetails.locality',
          images: '$pgDetails.images',
          rating: '$pgDetails.rating',
          type: '$pgDetails.type',
          featured: '$pgDetails.featured',
          verified: '$pgDetails.verified',
          bookingCount: 1
        }
      }
    ]);
    
    // If no trending data, return featured PGs
    if (trendingPGs.length === 0) {
      const featuredPGs = await PGListing.find({ published: true, featured: true })
        .sort({ rating: -1 })
        .limit(parseInt(limit));
      
      return res.json({
        success: true,
        trending: featuredPGs
      });
    }
    
    res.json({
      success: true,
      trending: trendingPGs
    });
  } catch (error) {
    console.error('Error getting trending PGs:', error);
    // Return featured PGs on error
    const featuredPGs = await PGListing.find({ published: true, featured: true })
      .sort({ rating: -1 })
      .limit(parseInt(req.query.limit || 8));
      
    res.json({
      success: true,
      trending: featuredPGs
    });
  }
};

// Get admin-picked recommendations (admin-curated list)
const getAdminPicks = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    let adminPicks = await PGListing.find({ published: true, adminRecommended: true })
      .sort({ rating: -1, createdAt: -1 })
      .limit(parseInt(limit));

    // If not enough admin picks, fill with featured/top-rated
    if (adminPicks.length < limit) {
      const existingIds = adminPicks.map(r => r._id);
      const additionalCount = parseInt(limit) - adminPicks.length;

      const additional = await PGListing.find({
        _id: { $nin: existingIds },
        published: true
      })
        .sort({ featured: -1, rating: -1 })
        .limit(additionalCount);

      adminPicks = [...adminPicks, ...additional];
    }

    res.json({
      success: true,
      adminPicks: adminPicks,
      count: adminPicks.length
    });
  } catch (error) {
    console.error('Error getting admin picks:', error);
    const fallback = await PGListing.find({ published: true })
      .sort({ featured: -1, rating: -1 })
      .limit(parseInt(req.query.limit || 8));

    res.json({
      success: true,
      adminPicks: fallback,
      count: fallback.length
    });
  }
};

module.exports = {
  getPersonalizedRecommendations,
  getTrendingPGs,
  getAdminPicks
};
