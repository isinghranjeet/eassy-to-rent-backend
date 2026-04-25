const express = require('express');
const {
  getPersonalizedRecommendations,
  getTrendingPGs,
  getAdminPicks
} = require('../controllers/recommendationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.get('/personalized', getPersonalizedRecommendations);
router.get('/trending', getTrendingPGs);
router.get('/admin-picks', getAdminPicks);

module.exports = router;
