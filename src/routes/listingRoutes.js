const express = require('express');
const router = express.Router();
const cacheMiddleware = require('../middleware/cache');

// Import your existing controller functions
// const { getAllListings } = require('../controllers/listingController');

// Example route with Redis Caching (Expires in 600 seconds)
// router.get('/public-listings', cacheMiddleware(600), getAllListings);

module.exports = router;