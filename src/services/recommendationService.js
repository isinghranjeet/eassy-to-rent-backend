const PGListing = require('../models/PGListing');

exports.getSmartRecommendations = async (userPreferences) => {
  try {
    const { city, maxBudget, preferredLocality } = userPreferences;
    
    let query = { published: true };
    if (city) query.city = new RegExp(city, 'i');
    if (maxBudget) query.price = { $lte: Number(maxBudget) };
    if (preferredLocality) query.locality = new RegExp(preferredLocality, 'i');

    // Fetch top matching listings sorted by rating or views
    const matchedPgs = await PGListing.find(query)
      .sort({ rating: -1, views: -1 })
      .limit(5)
      .lean();

    return matchedPgs;
  } catch (error) {
    throw error;
  }
};