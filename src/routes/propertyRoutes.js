const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');

// Public endpoints
router.get('/', propertyController.getProperties);
router.get('/:slug', propertyController.getPropertyBySlug);

module.exports = router;

