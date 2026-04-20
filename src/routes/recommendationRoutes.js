const express = require('express');
const {
  getPersonalizedRecommendations,
  getTrendingPGs
} = require('../controllers/recommendationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.get('/personalized', getPersonalizedRecommendations);
router.get('/trending', getTrendingPGs);

module.exports = router;