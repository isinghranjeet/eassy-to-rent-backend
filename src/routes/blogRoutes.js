const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { getBlogs, getBlogBySlug, createBlog, updateBlog, deleteBlog, likeBlog } = require('../controllers/blogController');

// Public routes
router.get('/', getBlogs);
router.get('/:slug', getBlogBySlug);
router.post('/:id/like', likeBlog);

// Admin routes
router.post('/', protect, adminOnly, createBlog);
router.put('/:id', protect, adminOnly, updateBlog);
router.delete('/:id', protect, adminOnly, deleteBlog);

module.exports = router;