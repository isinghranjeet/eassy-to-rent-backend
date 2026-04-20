// backend/src/routes/index.js
import express from 'express';
import authRoutes from './authRoutes.js';
import pgRoutes from './pgRoutes.js';
import bookingRoutes from './bookingRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import recommendationRoutes from './recommendationRoutes.js';
import reviewRoutes from './reviews.js';
import userRoutes from './userRoutes.js';
import locationRoutes from './locationRoutes.js';
import wishlistRoutes from './wishlistRoutes.js';
import priceAlertRoutes from './priceAlertRoutes.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.use('/auth', authRoutes);
router.use('/pg', pgRoutes);
router.use('/locations', locationRoutes);

// Protected routes (require authentication)
router.use('/bookings', protect, bookingRoutes);
router.use('/payments', protect, paymentRoutes);
router.use('/recommendations', protect, recommendationRoutes);
router.use('/reviews', protect, reviewRoutes);
router.use('/users', protect, userRoutes);
router.use('/wishlist', protect, wishlistRoutes);
router.use('/price-alerts', protect, priceAlertRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

export default router;