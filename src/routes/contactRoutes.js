const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { initiateContact, getContactHistory } = require('../controllers/contactController');

// @route   POST /api/contact/initiate
// @desc    Initiate a contact (call/whatsapp) - AUTH REQUIRED
// @access  Private
router.post('/initiate', protect, initiateContact);

// @route   GET /api/contact/history
// @desc    Get user's contact history
// @access  Private
router.get('/history', protect, getContactHistory);

module.exports = router;

