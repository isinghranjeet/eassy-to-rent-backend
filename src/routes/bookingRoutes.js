const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { createBookingSchema, updateBookingStatusSchema } = require('../validations/bookingValidation');
const {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
  canReview,
  getAllBookings,
  updateBookingStatus,
  getBookingStats,
} = require('../controllers/bookingController');

router.post('/', protect, validate(createBookingSchema), createBooking);
router.get('/mybookings', protect, getUserBookings);
router.get('/can-review/:pgId', protect, canReview);
router.get('/stats/all', protect, getBookingStats);
router.get('/:id', protect, getBookingById);
router.put('/:id/cancel', protect, cancelBooking);
router.put('/:id/status', protect, validate(updateBookingStatusSchema), updateBookingStatus);
router.get('/', protect, getAllBookings);

module.exports = router;