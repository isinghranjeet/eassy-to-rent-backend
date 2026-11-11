const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');

// Public endpoints
router.get('/', propertyController.getProperties);
router.get('/location/:slug', propertyController.getPropertiesByLocation);
router.get('/:slug', propertyController.getPropertyBySlug);

module.exports = router;

