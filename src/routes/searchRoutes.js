const express = require('express');
const router = express.Router();
const PGListing = require('../models/PGListing');
const User = require('../models/User');

router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === '') {
      return res.status(200).json({ 
        success: true, 
        message: 'Empty search query', 
        data: { pgs: [], users: [] } 
      });
    }

    // Case-insensitive regex search
    const regex = new RegExp(q.trim(), 'i');

    const [pgs, users] = await Promise.all([
      PGListing.find({ 
        $or: [
          { name: regex }, 
          { city: regex }, 
          { locality: regex },
          { address: regex }
        ] 
      }).limit(5).lean(),
      
      User.find({ 
        $or: [
          { name: regex }, 
          { email: regex }
        ] 
      }).limit(5).lean()
    ]);

    return res.status(200).json({
      success: true,
      message: 'Global search results fetched successfully',
      data: { pgs, users }
    });
  } catch (error) {
    console.error('❌ Global search error:', error);
    return next(error);
  }
});

module.exports = router;