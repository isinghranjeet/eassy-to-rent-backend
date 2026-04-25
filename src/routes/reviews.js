const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const PGListing = require('../models/PGListing');
const Activity = require('../models/Activity');
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

    // ✅ Create review with pending status
    const review = new Review({
      user: req.user._id,
      pgListing: pgId,
      rating,
      title,
      comment,
      status: 'pending'  // ✅ Pending admin approval
    });

    const createdReview = await review.save();
    
    // Populate user info
    await createdReview.populate('user', 'name');

    // Log activity
    try {
      const pg = await PGListing.findById(pgId).select('name city').lean();
      await Activity.create({
        type: 'REVIEW_PENDING',
        message: `New ${rating}-star review submitted on ${pg?.name || 'a PG'}`,
        userId: req.user._id,
        userName: req.user.name,
        targetId: createdReview._id.toString(),
        targetName: pg?.name || 'Unknown PG',
        metadata: { rating, pgCity: pg?.city, comment: comment?.substring(0, 100) },
      });
    } catch (activityErr) {
      console.error('Activity log error:', activityErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully! It will be visible after admin approval.',
      data: createdReview
    });
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

    // ✅ Only fetch approved reviews for public
    const reviews = await Review.find({ 
      pgListing: req.params.pgId,
      status: 'approved'  // ✅ Only approved reviews
    })
      .populate('user', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments({ 
      pgListing: req.params.pgId,
      status: 'approved'  // ✅ Only count approved reviews
    });

    // ✅ Get pending count for admin (if authenticated)
    let pendingCount = 0;
    if (req.headers.authorization) {
      try {
        // You might want to check if user is admin here
        pendingCount = await Review.countDocuments({
          pgListing: req.params.pgId,
          status: 'pending'
        });
      } catch (error) {
        // Ignore error
      }
    }

    res.json({
      success: true,
      reviews,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total,
      pendingCount
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

    res.json({
      success: true,
      data: reviews
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Update a review (only if not approved yet)
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

    // ✅ Cannot edit approved reviews
    if (review.status === 'approved') {
      return res.status(400).json({ error: 'Approved reviews cannot be edited' });
    }

    review.rating = req.body.rating || review.rating;
    review.title = req.body.title || review.title;
    review.comment = req.body.comment || review.comment;
    review.updatedAt = Date.now();

    const updatedReview = await review.save();
    res.json({
      success: true,
      message: 'Review updated successfully',
      data: updatedReview
    });
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
    res.json({ 
      success: true,
      message: 'Review removed successfully' 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Like a review
// @route   POST /api/reviews/:id/like
// @access  Private
router.post('/:id/like', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // ✅ Only approved reviews can be liked
    if (review.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved reviews can be liked' });
    }

    review.likes = (review.likes || 0) + 1;
    await review.save();

    res.json({ 
      success: true,
      likes: review.likes 
    });
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

    // ✅ Only approved reviews can have replies
    if (review.status !== 'approved') {
      return res.status(400).json({ error: 'Cannot reply to pending reviews' });
    }

    // Check if user is PG owner or admin
    const pg = await PGListing.findById(review.pgListing);
    if (pg.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const reply = {
      user: req.user._id,
      comment: req.body.comment,
      createdAt: new Date()
    };

    review.replies.push(reply);
    await review.save();

    // Populate user info for reply
    await review.populate('replies.user', 'name');

    res.json({
      success: true,
      replies: review.replies
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== ADMIN ONLY ROUTES ====================

// @desc    Get all pending reviews (Admin only)
// @route   GET /api/reviews/admin/pending
// @access  Private/Admin
router.get('/admin/pending', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const pendingReviews = await Review.find({ status: 'pending' })
      .populate('user', 'name email')
      .populate('pgListing', 'name city address')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: pendingReviews.length,
      data: pendingReviews
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Approve a review (Admin only)
// @route   PUT /api/reviews/admin/:id/approve
// @access  Private/Admin
router.put('/admin/:id/approve', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    review.status = 'approved';
    review.approvedBy = req.user._id;
    review.approvedAt = new Date();
    await review.save();

    // PG rating will be updated via post-save hook

    res.json({
      success: true,
      message: 'Review approved successfully',
      data: review
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Reject a review (Admin only)
// @route   PUT /api/reviews/admin/:id/reject
// @access  Private/Admin
router.put('/admin/:id/reject', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { reason } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    review.status = 'rejected';
    review.adminNote = reason || 'No reason provided';
    await review.save();

    res.json({
      success: true,
      message: 'Review rejected',
      data: review
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Get all reviews with filters (Admin only)
// @route   GET /api/reviews/admin/all
// @access  Private/Admin
router.get('/admin/all', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    const sortQuery = req.query.sort ? req.query.sort : '-createdAt';

    const reviews = await Review.find(query)
      .populate('user', 'name email')
      .populate('pgListing', 'name city')
      .sort(sortQuery)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(query);

    res.json({
      success: true,
      data: {
        items: reviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Get review statistics (Admin only)
// @route   GET /api/reviews/admin/stats
// @access  Private/Admin
router.get('/admin/stats', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const pending = await Review.countDocuments({ status: 'pending' });
    const approved = await Review.countDocuments({ status: 'approved' });
    const rejected = await Review.countDocuments({ status: 'rejected' });
    const total = await Review.countDocuments();

    res.json({
      success: true,
      stats: {
        pending,
        approved,
        rejected,
        total
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;