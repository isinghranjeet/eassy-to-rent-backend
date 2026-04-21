const Wishlist = require('../models/Wishlist');
const asyncHandler = require('express-async-handler');

const getWishlist = asyncHandler(async (req, res) => {
  console.log('📝 Fetching wishlist for user:', req.user._id);
  
  const wishlist = await Wishlist.findOne({ user: req.user._id })
    .populate('items.pg');  // ✅ Ab kaam karega
  
  if (!wishlist) {
    return res.json({
      success: true,
      data: []
    });
  }
  
  const items = wishlist.items
    .map(item => item.pg)
    .filter(pg => pg !== null);
  
  res.json({
    success: true,
    data: items
  });
});

const addToWishlist = asyncHandler(async (req, res) => {
  const { pgId } = req.body;
  
  console.log('📝 Adding to wishlist:', { userId: req.user._id, pgId });
  
  let wishlist = await Wishlist.findOne({ user: req.user._id });
  
  if (!wishlist) {
    wishlist = await Wishlist.create({
      user: req.user._id,
      items: [{ pg: pgId }]
    });
  } else {
    const alreadyExists = wishlist.items.some(item => item.pg.toString() === pgId);
    
    if (!alreadyExists) {
      wishlist.items.push({ pg: pgId });
      await wishlist.save();
    } else {
      return res.status(400).json({
        success: false,
        message: 'PG already in wishlist'
      });
    }
  }
  
  res.json({
    success: true,
    message: 'Added to wishlist'
  });
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  const { pgId } = req.params;
  
  console.log('📝 Removing from wishlist:', { userId: req.user._id, pgId });
  
  const wishlist = await Wishlist.findOne({ user: req.user._id });
  
  if (wishlist) {
    wishlist.items = wishlist.items.filter(
      item => item.pg.toString() !== pgId
    );
    await wishlist.save();
  }
  
  res.json({
    success: true,
    message: 'Removed from wishlist'
  });
});

const clearWishlist = asyncHandler(async (req, res) => {
  await Wishlist.findOneAndDelete({ user: req.user._id });
  
  res.json({
    success: true,
    message: 'Wishlist cleared'
  });
});

const checkInWishlist = asyncHandler(async (req, res) => {
  const { pgId } = req.params;
  
  const wishlist = await Wishlist.findOne({ user: req.user._id });
  
  const exists = wishlist ? wishlist.items.some(
    item => item.pg.toString() === pgId
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