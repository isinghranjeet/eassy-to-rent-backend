// backend/controllers/wishlistController.js
const Wishlist = require('../models/Wishlist');
const asyncHandler = require('express-async-handler');

// @desc    Get user's wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = asyncHandler(async (req, res) => {
  // ✅ CHANGE: req.user.id → req.user._id
  const wishlist = await Wishlist.findOne({ user: req.user._id })
    .populate('items.pg', 'name price images city rating reviews address amenities type');
  
  if (!wishlist) {
    return res.json({
      success: true,
      data: []
    });
  }
  
  res.json({
    success: true,
    data: wishlist.items.map(item => item.pg)
  });
});

// @desc    Add to wishlist
// @route   POST /api/wishlist
// @access  Private
const addToWishlist = asyncHandler(async (req, res) => {
  const { pgId } = req.body;
  
  // ✅ CHANGE: req.user.id → req.user._id
  let wishlist = await Wishlist.findOne({ user: req.user._id });
  
  if (!wishlist) {
    wishlist = await Wishlist.create({
      user: req.user._id,  // ✅ CHANGE: req.user.id → req.user._id
      items: [{ pg: pgId }]
    });
  } else {
    const alreadyExists = wishlist.items.some(item => item.pg.toString() === pgId);
    
    if (!alreadyExists) {
      wishlist.items.push({ pg: pgId });
      await wishlist.save();
    }
  }
  
  res.json({
    success: true,
    message: 'Added to wishlist'
  });
});

// @desc    Remove from wishlist
// @route   DELETE /api/wishlist/:pgId
// @access  Private
const removeFromWishlist = asyncHandler(async (req, res) => {
  // ✅ CHANGE: req.user.id → req.user._id
  const wishlist = await Wishlist.findOne({ user: req.user._id });
  
  if (wishlist) {
    wishlist.items = wishlist.items.filter(
      item => item.pg.toString() !== req.params.pgId
    );
    await wishlist.save();
  }
  
  res.json({
    success: true,
    message: 'Removed from wishlist'
  });
});

// @desc    Clear wishlist
// @route   DELETE /api/wishlist
// @access  Private
const clearWishlist = asyncHandler(async (req, res) => {
  // ✅ CHANGE: req.user.id → req.user._id
  await Wishlist.findOneAndDelete({ user: req.user._id });
  
  res.json({
    success: true,
    message: 'Wishlist cleared'
  });
});

// @desc    Check if PG is in wishlist
// @route   GET /api/wishlist/check/:pgId
// @access  Private
const checkInWishlist = asyncHandler(async (req, res) => {
  // ✅ CHANGE: req.user.id → req.user._id
  const wishlist = await Wishlist.findOne({ user: req.user._id });
  
  const exists = wishlist ? wishlist.items.some(
    item => item.pg.toString() === req.params.pgId
  ) : false;
  
  res.json({
    success: true,
    inWishlist: exists
  });
});

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  checkInWishlist
};