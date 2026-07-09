const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

// Top locations by live database aggregation
router.get('/top', locationController.getTopLocations);

module.exports = router;

