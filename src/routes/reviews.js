const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const PGListing = require('../models/PGListing');
const { protect } = require('../middleware/authMiddleware');

// @desc    Create a review
// @route   POST /api/reviews
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { pgId, rating, title, comment } = req.body;

    // Check if user has already reviewed this PG
    const existingReview = await Review.findOne({
      user: req.user._id,
      pgListing: pgId
    });

    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this PG' });
    }

    // Check if user has booked this PG (optional validation)
    // const booking = await Booking.findOne({
    //   user: req.user._id,
    //   pgListing: pgId,
    //   status: 'completed'
    // });
    
    // if (!booking) {
    //   return res.status(400).json({ error: 'You must have booked this PG to leave a review' });
    // }

    const review = new Review({
      user: req.user._id,
      pgListing: pgId,
      rating,
      title,
      comment
    });

    const createdReview = await review.save();
    
    // Populate user info
    await createdReview.populate('user', 'name');

    res.status(201).json(createdReview);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Get reviews for a PG
// @route   GET /api/reviews/pg/:pgId
// @access  Public
router.get('/pg/:pgId', async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'recent' } = req.query;
    const skip = (page - 1) * limit;

    let sortOptions = {};
    if (sort === 'recent') {
      sortOptions = { createdAt: -1 };
    } else if (sort === 'helpful') {
      sortOptions = { likes: -1 };
    } else if (sort === 'rating') {
      sortOptions = { rating: -1 };
    }

    const reviews = await Review.find({ pgListing: req.params.pgId })
      .populate('user', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments({ pgListing: req.params.pgId });

    res.json({
      reviews,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Get user's reviews
// @route   GET /api/reviews/my-reviews
// @access  Private
router.get('/my-reviews', protect, async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.user._id })
      .populate('pgListing', 'name address images')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Update a review
// @route   PUT /api/reviews/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check if user is the review author
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    review.rating = req.body.rating || review.rating;
    review.title = req.body.title || review.title;
    review.comment = req.body.comment || review.comment;
    review.updatedAt = Date.now();

    const updatedReview = await review.save();
    res.json(updatedReview);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check if user is the review author or admin
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await review.deleteOne();
    res.json({ message: 'Review removed' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Like a review
// @route   POST /api/reviews/:id/like
// @access  Private
router.post('/:id/like', protect, async (req, res) => {
  try {
    // In a real app, you might want to track who liked what
    // For simplicity, we'll just increment the likes count
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json({ likes: review.likes });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Reply to a review (Owner/Admin only)
// @route   POST /api/reviews/:id/reply
// @access  Private/Owner/Admin
router.post('/:id/reply', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check if user is PG owner or admin
    const pg = await PGListing.findById(review.pgListing);
    if (pg.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const reply = {
      user: req.user._id,
      comment: req.body.comment
    };

    review.replies.push(reply);
    await review.save();

    res.json(review.replies);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;