// backend/routes/wishlistRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  checkInWishlist
} = require('../controllers/wishlistController');

// All routes require authentication
router.use(protect);

router.route('/')
  .get(getWishlist)
  .post(addToWishlist)
  .delete(clearWishlist);

router.route('/:pgId')
  .delete(removeFromWishlist)
  .get(checkInWishlist);

module.exports = router;