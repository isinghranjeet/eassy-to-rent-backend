const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const validate = require('../middleware/validate');
const {
  // Public
  getBlogs,
  getFeaturedBlogs,
  getPopularBlogs,
  searchBlogs,
  getBlogsByCategory,
  getBlogsByTag,
  getBlogBySlug,
  getRelatedBlogs,
  likeBlog,
  trackReadingProgress,
  // Admin - Blog CRUD
  getAdminBlogs,
  getAdminBlogById,
  createBlog,
  updateBlog,
  publishBlog,
  restoreBlogVersion,
  deleteBlog,
  // Admin - Analytics
  getBlogAnalyticsOverview,
  getTrafficAnalytics,
  getBlogAnalytics,
  // Admin - SEO
  getBulkSeoStatus,
  getSeoScore,
  getSeoSuggestions,
  // Categories
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  // Tags
  getTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
  mergeTags,
  // Authors
  getAuthors,
  getAuthorById,
  createAuthor,
  updateAuthor,
  deleteAuthor,
  // Media
  uploadMedia,
  getMediaList,
  deleteMediaItem,
} = require('../controllers/blogController');

const {
  createBlogSchema,
  updateBlogSchema,
  updateBlogStatusSchema,
  createCategorySchema,
  updateCategorySchema,
  createTagSchema,
  updateTagSchema,
  mergeTagsSchema,
  createAuthorSchema,
  updateAuthorSchema,
  trackReadingSchema,
} = require('../validations/blogValidation');

// ═══════════════════════════════════════════════
// PUBLIC ROUTES (No auth required)
// ═══════════════════════════════════════════════

router.get('/', getBlogs);
router.get('/featured', getFeaturedBlogs);
router.get('/popular', getPopularBlogs);
router.get('/search', searchBlogs);
router.get('/category/:slug', getBlogsByCategory);
router.get('/tag/:slug', getBlogsByTag);
router.get('/:slug', getBlogBySlug);
router.get('/:slug/related', getRelatedBlogs);
router.post('/:id/like', likeBlog);
router.post('/:id/track-reading', validate(trackReadingSchema), trackReadingProgress);

// ═══════════════════════════════════════════════
// ADMIN ROUTES (Auth + Admin Only)
// ═══════════════════════════════════════════════

// Category CRUD (must be BEFORE /admin/:id to avoid route conflict)
router.get('/admin/categories', protect, adminOnly, getCategories);
router.get('/admin/categories/:id', protect, adminOnly, getCategoryById);
router.post('/admin/categories', protect, adminOnly, validate(createCategorySchema), createCategory);
router.put('/admin/categories/:id', protect, adminOnly, validate(updateCategorySchema), updateCategory);
router.delete('/admin/categories/:id', protect, adminOnly, deleteCategory);

// Tag CRUD (must be BEFORE /admin/:id to avoid route conflict)
router.get('/admin/tags', protect, adminOnly, getTags);
router.get('/admin/tags/:id', protect, adminOnly, getTagById);
router.post('/admin/tags', protect, adminOnly, validate(createTagSchema), createTag);
router.put('/admin/tags/:id', protect, adminOnly, validate(updateTagSchema), updateTag);
router.delete('/admin/tags/:id', protect, adminOnly, deleteTag);
router.post('/admin/tags/merge', protect, adminOnly, validate(mergeTagsSchema), mergeTags);

// Author CRUD (must be BEFORE /admin/:id to avoid route conflict)
router.get('/admin/authors', protect, adminOnly, getAuthors);
router.get('/admin/authors/:id', protect, adminOnly, getAuthorById);
router.post('/admin/authors', protect, adminOnly, validate(createAuthorSchema), createAuthor);
router.put('/admin/authors/:id', protect, adminOnly, validate(updateAuthorSchema), updateAuthor);
router.delete('/admin/authors/:id', protect, adminOnly, deleteAuthor);

// Media (must be BEFORE /admin/:id to avoid route conflict)
router.get('/admin/media', protect, adminOnly, getMediaList);
router.post('/admin/media/upload', protect, adminOnly, upload.single('file'), uploadMedia);
router.delete('/admin/media/:id', protect, adminOnly, deleteMediaItem);

// Blog CRUD (parameterized /admin/:id routes must come AFTER static routes)
router.get('/admin/all', protect, adminOnly, getAdminBlogs);
router.get('/admin/analytics/overview', protect, adminOnly, getBlogAnalyticsOverview);
router.get('/admin/analytics/traffic', protect, adminOnly, getTrafficAnalytics);
router.get('/admin/seo/bulk', protect, adminOnly, getBulkSeoStatus);
router.get('/admin/:id', protect, adminOnly, getAdminBlogById);
router.get('/admin/:id/analytics', protect, adminOnly, getBlogAnalytics);
router.get('/admin/:id/seo-score', protect, adminOnly, getSeoScore);
router.post('/admin', protect, adminOnly, validate(createBlogSchema), createBlog);
router.post('/admin/:id/seo-suggestions', protect, adminOnly, getSeoSuggestions);
router.put('/admin/:id', protect, adminOnly, validate(updateBlogSchema), updateBlog);
router.put('/admin/:id/publish', protect, adminOnly, validate(updateBlogStatusSchema), publishBlog);
router.put('/admin/:id/restore/:version', protect, adminOnly, restoreBlogVersion);
router.delete('/admin/:id', protect, adminOnly, deleteBlog);

module.exports = router;

