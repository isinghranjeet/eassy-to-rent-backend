// backend/src/controllers/reviewController.js

// Create review - status = 'pending'
const createReview = async (req, res) => {
  try {
    const { pgId, rating, comment, title } = req.body;
    const userId = req.user._id;

    // Check if already reviewed
    const existingReview = await Review.findOne({
      pgListing: pgId,
      user: userId
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this PG'
      });
    }

    const review = new Review({
      pgListing: pgId,
      user: userId,
      rating,
      title: title || `Review for PG`,
      comment,
      status: 'pending',  // ✅ Pending approval
      verifiedBooking: false
    });

    await review.save();

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully! It will be visible after admin approval.',
      data: review
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get reviews for a PG - only approved reviews
const getReviewsByPG = async (req, res) => {
  try {
    const { pgId } = req.params;
    
    // ✅ Only show approved reviews to public
    const reviews = await Review.find({
      pgListing: pgId,
      status: 'approved'
    })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    // Get pending count for admin
    const pendingCount = await Review.countDocuments({
      pgListing: pgId,
      status: 'pending'
    });

    res.json({
      success: true,
      reviews,
      pendingCount,
      message: 'Only approved reviews are shown'
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get pending reviews (Admin only)
const getPendingReviews = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const pendingReviews = await Review.find({ status: 'pending' })
      .populate('user', 'name email')
      .populate('pgListing', 'name city')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: pendingReviews.length,
      data: pendingReviews
    });
  } catch (error) {
    console.error('Get pending reviews error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Approve review (Admin only)
const approveReview = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const { reviewId } = req.params;
    
    const review = await Review.findByIdAndUpdate(
      reviewId,
      { 
        status: 'approved',
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Update PG rating
    await updatePGRating(review.pgListing);

    res.json({
      success: true,
      message: 'Review approved successfully',
      data: review
    });
  } catch (error) {
    console.error('Approve review error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Reject review (Admin only)
const rejectReview = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const { reviewId } = req.params;
    
    const review = await Review.findByIdAndUpdate(
      reviewId,
      { 
        status: 'rejected',
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Review rejected successfully',
      data: review
    });
  } catch (error) {
    console.error('Reject review error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update PG rating helper function
const updatePGRating = async (pgId) => {
  const approvedReviews = await Review.find({
    pgListing: pgId,
    status: 'approved'
  });

  const totalRating = approvedReviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = approvedReviews.length > 0 ? totalRating / approvedReviews.length : 0;
  const reviewCount = approvedReviews.length;

  await PGListing.findByIdAndUpdate(pgId, {
    rating: averageRating.toFixed(1),
    reviewCount
  });
};

module.exports = {
  createReview,
  getReviewsByPG,
  getPendingReviews,
  approveReview,
  rejectReview,
  updatePGRating
};