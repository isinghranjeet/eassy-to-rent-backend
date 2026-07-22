const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const BlogCategory = require('../models/BlogCategory');
const BlogTag = require('../models/BlogTag');
const BlogAuthor = require('../models/BlogAuthor');
const BlogMedia = require('../models/BlogMedia');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { asyncHandler } = require('../middleware/asyncHandler');
const {
  generateSlug,
  calculateReadingTime,
  countWords,
  generateTableOfContents,
  generateCanonicalUrl,
  generateBreadcrumbSchema,
  generateArticleSchema,
  generateFaqSchema,
  generateOpenGraphTags,
  generateTwitterCard,
  calculateSeoScore,
  suggestInternalLinks,
  extractFaqs,
} = require('../utils/blogSeo');
const { regenerateSitemap } = require('../services/sitemapService');
const { uploadAndOptimize, deleteMedia, getMediaLibrary } = require('../services/mediaService');
const validate = require('../middleware/validate');
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
  mediaUploadSchema,
  trackReadingSchema,
} = require('../validations/blogValidation');

// ──────────────────────────────────────────────
// PUBLIC ENDPOINTS
// ──────────────────────────────────────────────

/**
 * GET /api/blogs
 * Get paginated published blogs with filters
 * Query: page, limit, category (slug), tag (slug), author (id), search, sort
 */
const getBlogs = asyncHandler(async (req, res) => {
  let { page = 1, limit = 9, category, tag, author, search, sort = '-publishDate' } = req.query;

  page = parseInt(page);
  limit = Math.min(parseInt(limit), 50);

  const query = { status: 'published' };

  // Filter by category slug
  if (category && category !== 'all') {
    const categoryDoc = await BlogCategory.findOne({ slug: category, isActive: true }).lean();
    if (categoryDoc) {
      query.category = categoryDoc._id;
    } else {
      return paginatedResponse(res, { data: [], total: 0, page, limit });
    }
  }

  // Filter by tag slug
  if (tag) {
    const tagDoc = await BlogTag.findOne({ slug: tag }).lean();
    if (tagDoc) {
      query.tags = tagDoc._id;
    } else {
      return paginatedResponse(res, { data: [], total: 0, page, limit });
    }
  }

  // Filter by author
  if (author) {
    query.authorRef = author;
  }

  // Full-text search
  if (search) {
    query.$text = { $search: search };
  }

  // Build sort
  let sortOption = {};
  if (sort.startsWith('-')) {
    sortOption[sort.substring(1)] = -1;
  } else {
    sortOption[sort] = 1;
  }

  const [blogs, total] = await Promise.all([
    Blog.find(query)
      .select('-content -versions -visitorIPs -dailyViews -schemaMarkup')
      .populate('category', 'name slug color')
      .populate('tags', 'name slug color')
      .populate('authorRef', 'name slug avatar')
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Blog.countDocuments(query),
  ]);

  paginatedResponse(res, { data: blogs, total, page, limit });
});

/**
 * GET /api/blogs/featured
 * Get featured blogs for homepage display
 * Query: limit (default: 3)
 */
const getFeaturedBlogs = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 3, 10);

  const blogs = await Blog.find({ status: 'published', featured: true })
    .select('-content -versions -visitorIPs -dailyViews -schemaMarkup')
    .populate('category', 'name slug color')
    .populate('authorRef', 'name slug avatar')
    .sort({ publishDate: -1 })
    .limit(limit)
    .lean();

  successResponse(res, { data: blogs });
});

/**
 * GET /api/blogs/popular
 * Get most viewed blogs in last 30 days
 * Query: limit (default: 5)
 */
const getPopularBlogs = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 5, 20);

  const blogs = await Blog.find({ status: 'published' })
    .select('-content -versions -visitorIPs -dailyViews -schemaMarkup')
    .populate('category', 'name slug color')
    .sort({ views: -1 })
    .limit(limit)
    .lean();

  successResponse(res, { data: blogs });
});

/**
 * GET /api/blogs/search
 * Full-text search across blogs
 * Query: q (search term), page, limit, category, tag
 */
const searchBlogs = asyncHandler(async (req, res) => {
  let { q = '', page = 1, limit = 9, category, tag } = req.query;

  if (!q.trim()) {
    return getBlogs(req, res);
  }

  page = parseInt(page);
  limit = Math.min(parseInt(limit), 50);

  const query = {
    status: 'published',
    $or: [
      { title: { $regex: q, $options: 'i' } },
      { shortDescription: { $regex: q, $options: 'i' } },
      { content: { $regex: q, $options: 'i' } },
    ],
  };

  if (category && category !== 'all') {
    const categoryDoc = await BlogCategory.findOne({ slug: category, isActive: true }).lean();
    if (categoryDoc) query.category = categoryDoc._id;
  }

  if (tag) {
    const tagDoc = await BlogTag.findOne({ slug: tag }).lean();
    if (tagDoc) query.tags = tagDoc._id;
  }

  const [blogs, total] = await Promise.all([
    Blog.find(query)
      .select('-content -versions -visitorIPs -dailyViews -schemaMarkup')
      .populate('category', 'name slug color')
      .populate('tags', 'name slug color')
      .populate('authorRef', 'name slug avatar')
      .sort({ views: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Blog.countDocuments(query),
  ]);

  paginatedResponse(res, { data: blogs, total, page, limit });
});

/**
 * GET /api/blogs/category/:slug
 * Get blogs by category slug
 */
const getBlogsByCategory = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  let { page = 1, limit = 9 } = req.query;
  page = parseInt(page);
  limit = Math.min(parseInt(limit), 50);

  const categoryDoc = await BlogCategory.findOne({ slug, isActive: true }).lean();
  if (!categoryDoc) {
    return errorResponse(res, { statusCode: 404, message: 'Category not found' });
  }

  const query = { status: 'published', category: categoryDoc._id };

  const [blogs, total] = await Promise.all([
    Blog.find(query)
      .select('-content -versions -visitorIPs -dailyViews -schemaMarkup')
      .populate('category', 'name slug color')
      .populate('tags', 'name slug color')
      .populate('authorRef', 'name slug avatar')
      .sort({ publishDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Blog.countDocuments(query),
  ]);

  paginatedResponse(res, { data: blogs, total, page, limit, meta: { category: categoryDoc } });
});

/**
 * GET /api/blogs/tag/:slug
 * Get blogs by tag slug
 */
const getBlogsByTag = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  let { page = 1, limit = 9 } = req.query;
  page = parseInt(page);
  limit = Math.min(parseInt(limit), 50);

  const tagDoc = await BlogTag.findOne({ slug }).lean();
  if (!tagDoc) {
    return errorResponse(res, { statusCode: 404, message: 'Tag not found' });
  }

  const query = { status: 'published', tags: tagDoc._id };

  const [blogs, total] = await Promise.all([
    Blog.find(query)
      .select('-content -versions -visitorIPs -dailyViews -schemaMarkup')
      .populate('category', 'name slug color')
      .populate('tags', 'name slug color')
      .populate('authorRef', 'name slug avatar')
      .sort({ publishDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Blog.countDocuments(query),
  ]);

  paginatedResponse(res, { data: blogs, total, page, limit, meta: { tag: tagDoc } });
});

/**
 * GET /api/blogs/:slug
 * Get single blog by slug with view tracking
 */
const getBlogBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const blog = await Blog.findOne({ slug, status: 'published' })
    .populate('category', 'name slug color seoTitle metaDescription')
    .populate('tags', 'name slug')
    .populate('authorRef', 'name slug avatar bio')
    .populate('createdBy', 'name')
    .populate('updatedBy', 'name')
    .lean();

  if (!blog) {
    return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
  }

  // Increment views asynchronously
  const clientIp = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress;
  Blog.incrementViews(blog._id, clientIp).catch(() => {});
  Blog.updateDailyViews(blog._id).catch(() => {});

  // Generate SEO schemas
  const canonicalUrl = blog.canonicalUrl || generateCanonicalUrl(blog.slug);
  const breadcrumbSchema = generateBreadcrumbSchema(blog.category, blog.title);
  const articleSchema = generateArticleSchema(blog, blog.authorRef);
  const faqs = extractFaqs(blog.content);
  const faqSchema = faqs.length > 0 ? generateFaqSchema(faqs) : null;

  successResponse(res, {
    data: {
      ...blog,
      canonicalUrl,
      schemas: {
        breadcrumb: breadcrumbSchema,
        article: articleSchema,
        faq: faqSchema,
      },
      openGraph: generateOpenGraphTags(blog),
      twitterCard: generateTwitterCard(blog),
    },
  });
});

/**
 * GET /api/blogs/:slug/related
 * Get related blogs by category/tags
 */
const getRelatedBlogs = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 3, 6);

  const blog = await Blog.findOne({ slug }).select('category tags').lean();
  if (!blog) {
    return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
  }

  const query = {
    _id: { $ne: blog._id },
    status: 'published',
    $or: [
      { category: blog.category },
      { tags: { $in: blog.tags } },
    ],
  };

  const relatedBlogs = await Blog.find(query)
    .select('-content -versions -visitorIPs -dailyViews -schemaMarkup')
    .populate('category', 'name slug color')
    .populate('authorRef', 'name slug avatar')
    .sort({ publishDate: -1, views: -1 })
    .limit(limit)
    .lean();

  successResponse(res, { data: relatedBlogs });
});

/**
 * POST /api/blogs/:id/like
 * Like a blog post
 */
const likeBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findByIdAndUpdate(
    req.params.id,
    { $inc: { likes: 1 } },
    { new: true, select: 'likes' }
  );

  if (!blog) {
    return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
  }

  successResponse(res, { data: { likes: blog.likes } });
});

/**
 * POST /api/blogs/:id/track-reading
 * Track reading progress (scroll depth, time spent, source)
 */
const trackReadingProgress = asyncHandler(async (req, res) => {
  const { scrollDepth, timeSpent, source } = req.body;

  await Blog.trackReading(req.params.id, scrollDepth, timeSpent);

  // Track traffic source
  if (source) {
    const sourceField = `trafficSource.${source}`;
    await Blog.findByIdAndUpdate(req.params.id, { $inc: { [sourceField]: 1 } });
  }

  successResponse(res, { message: 'Reading progress tracked' });
});

// ──────────────────────────────────────────────
// ADMIN ENDPOINTS - BLOG CRUD
// ──────────────────────────────────────────────

/**
 * GET /api/admin/blogs
 * Get all blogs including drafts/scheduled/archived
 */
const getAdminBlogs = asyncHandler(async (req, res) => {
  let { page = 1, limit = 20, status, category, author, featured, search, sort = '-createdAt' } = req.query;

  page = parseInt(page);
  limit = Math.min(parseInt(limit), 100);

  const query = {};

  if (status && status !== 'all') query.status = status;
  if (category) query.category = category;
  if (author) query.authorRef = author;
  if (featured === 'true') query.featured = true;
  if (featured === 'false') query.featured = false;

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { shortDescription: { $regex: search, $options: 'i' } },
    ];
  }

  let sortOption = {};
  if (sort.startsWith('-')) {
    sortOption[sort.substring(1)] = -1;
  } else {
    sortOption[sort] = 1;
  }

  const [blogs, total] = await Promise.all([
    Blog.find(query)
      .select('-content -versions -visitorIPs -dailyViews -schemaMarkup')
      .populate('category', 'name slug color')
      .populate('tags', 'name slug color')
      .populate('authorRef', 'name slug avatar')
      .populate('createdBy', 'name email')
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Blog.countDocuments(query),
  ]);

  paginatedResponse(res, { data: blogs, total, page, limit });
});

/**
 * GET /api/admin/blogs/:id
 * Get single blog with all data including version history
 */
const getAdminBlogById = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id)
    .populate('category', 'name slug')
    .populate('tags', 'name slug')
    .populate('authorRef', 'name slug avatar')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('publishedBy', 'name email')
    .populate('versions.updatedBy', 'name email')
    .lean();

  if (!blog) {
    return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
  }

  // Calculate SEO score
  const { score, issues } = calculateSeoScore(blog);

  successResponse(res, {
    data: {
      ...blog,
      seoScore: score,
      seoIssues: issues,
    },
  });
});

/**
 * POST /api/admin/blogs
 * Create a new blog with auto-generated SEO fields
 */
const createBlog = asyncHandler(async (req, res) => {
  const data = req.body;

  // Auto-generate slug if not provided
  if (!data.slug) {
    data.slug = generateSlug(data.title);
  }

  // Calculate reading time and word count
  const readingTime = calculateReadingTime(data.content || '');
  const wordCount = countWords(data.content || '');

  // Generate Table of Contents
  const { toc, updatedHtml } = generateTableOfContents(data.content || '');

  // Generate canonical URL
  const canonicalUrl = data.canonicalUrl || generateCanonicalUrl(data.slug);

  // Generate SEO schemas
  let categoryDoc = null;
  if (data.category) {
    categoryDoc = await BlogCategory.findById(data.category).lean();
  }

  let authorDoc = null;
  if (data.authorRef) {
    authorDoc = await BlogAuthor.findById(data.authorRef).lean();
  }

  const breadcrumbSchema = generateBreadcrumbSchema(categoryDoc, data.title);
  const articleSchema = generateArticleSchema(
    { ...data, readingTime, wordCount, slug: data.slug },
    authorDoc
  );

  // Calculate SEO score
  const { score, issues } = calculateSeoScore({
    ...data,
    readingTime,
    wordCount,
    content: data.content || '',
  });

  // Build the blog document
  const blogData = {
    ...data,
    content: updatedHtml, // Use HTML with heading IDs
    slug: data.slug,
    readingTime,
    wordCount,
    tableOfContents: toc,
    canonicalUrl,
    schemaMarkup: {
      breadcrumb: breadcrumbSchema,
      article: articleSchema,
    },
    seoScore: score,
    seoIssues: issues,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  };

  // Set publish date if status is published
  if (data.status === 'published') {
    blogData.publishDate = data.publishDate || new Date();
    blogData.publishedAt = data.publishDate || new Date();
    blogData.publishedBy = req.user._id;
  }

  // Backward compatibility
  blogData.coverImage = data.featuredImage || data.coverImage || '';
  blogData.excerpt = data.shortDescription || data.excerpt || '';
  blogData.author = authorDoc?.name || data.author || 'EasyToRent Team';
  blogData.readTime = readingTime;
  blogData.published = data.status === 'published';

  const blog = await Blog.create(blogData);

  // Update denormalized counts
  if (data.category) {
    await BlogCategory.findByIdAndUpdate(data.category, { $inc: { blogCount: 1 } });
  }
  if (data.tags && data.tags.length > 0) {
    await BlogTag.updateMany({ _id: { $in: data.tags } }, { $inc: { blogCount: 1 } });
  }
  if (data.authorRef) {
    await BlogAuthor.findByIdAndUpdate(data.authorRef, { $inc: { blogCount: 1 } });
  }

  // Regenerate sitemap if published
  if (data.status === 'published') {
    regenerateSitemap().catch(() => {});
  }

  successResponse(res, { statusCode: 201, data: blog });
});

/**
 * PUT /api/admin/blogs/:id
 * Update a blog with version snapshot
 */
const updateBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) {
    return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
  }

  const data = req.body;

  // Create version snapshot before updating
  const newVersion = (blog.currentVersion || 0) + 1;
  const versionSnapshot = {
    title: blog.title,
    content: blog.content,
    shortDescription: blog.shortDescription,
    seoTitle: blog.seoTitle,
    metaDescription: blog.metaDescription,
    featuredImage: blog.featuredImage,
    updatedBy: req.user._id,
    version: newVersion,
    createdAt: new Date(),
  };

  // Auto-generate slug if title changed
  if (data.title && data.title !== blog.title) {
    data.slug = generateSlug(data.title);
  }

  // Recalculate reading time if content changed
  if (data.content && data.content !== blog.content) {
    data.readingTime = calculateReadingTime(data.content);
    data.wordCount = countWords(data.content);
    const { toc, updatedHtml } = generateTableOfContents(data.content);
    data.tableOfContents = toc;
    data.content = updatedHtml;
  }

  // Recalculate SEO score
  const mergedData = { ...blog.toObject(), ...data };
  const { score, issues } = calculateSeoScore(mergedData);
  data.seoScore = score;
  data.seoIssues = issues;

  // Update canonical URL if slug changed
  if (data.slug && data.slug !== blog.slug) {
    data.canonicalUrl = generateCanonicalUrl(data.slug);
  }

  // Set publish info if publishing
  if (data.status === 'published' && blog.status !== 'published') {
    data.publishDate = data.publishDate || new Date();
    data.publishedAt = data.publishDate || new Date();
    data.publishedBy = req.user._id;
  }

  data.updatedBy = req.user._id;
  data.currentVersion = newVersion;

  // Push version snapshot
  await Blog.findByIdAndUpdate(req.params.id, {
    ...data,
    $push: { versions: versionSnapshot },
  });

  // Fetch updated blog
  const updatedBlog = await Blog.findById(req.params.id)
    .populate('category', 'name slug')
    .populate('tags', 'name slug')
    .populate('authorRef', 'name slug avatar')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .lean();

  // Regenerate sitemap if status changed to published
  if (data.status === 'published' && blog.status !== 'published') {
    regenerateSitemap().catch(() => {});
  }

  // Regenerate sitemap if blog was unpublished
  if (data.status === 'draft' && blog.status === 'published') {
    regenerateSitemap().catch(() => {});
  }

  successResponse(res, { data: updatedBlog });
});

/**
 * PUT /api/admin/blogs/:id/publish
 * Publish or schedule a blog
 */
const publishBlog = asyncHandler(async (req, res) => {
  const { status, scheduledDate } = req.body;

  const updateData = {
    status,
    updatedBy: req.user._id,
  };

  if (status === 'published') {
    updateData.publishDate = new Date();
    updateData.publishedAt = new Date();
    updateData.publishedBy = req.user._id;
    updateData.scheduledDate = null;
  } else if (status === 'scheduled') {
    updateData.scheduledDate = scheduledDate;
    updateData.publishDate = null;
  }

  const blog = await Blog.findByIdAndUpdate(req.params.id, updateData, { new: true })
    .populate('category', 'name slug')
    .populate('tags', 'name slug')
    .populate('authorRef', 'name slug avatar')
    .lean();

  if (!blog) {
    return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
  }

  // Regenerate sitemap on publish
  if (status === 'published') {
    regenerateSitemap().catch(() => {});
  }

  successResponse(res, { data: blog });
});

/**
 * PUT /api/admin/blogs/:id/restore/:version
 * Restore a previous version
 */
const restoreBlogVersion = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) {
    return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
  }

  const versionNumber = parseInt(req.params.version);
  const version = blog.versions.find((v) => v.version === versionNumber);

  if (!version) {
    return errorResponse(res, { statusCode: 404, message: 'Version not found' });
  }

  // Create a new version of current state before restoring
  const newVersion = (blog.currentVersion || 0) + 1;
  blog.versions.push({
    title: blog.title,
    content: blog.content,
    shortDescription: blog.shortDescription,
    seoTitle: blog.seoTitle,
    metaDescription: blog.metaDescription,
    featuredImage: blog.featuredImage,
    updatedBy: req.user._id,
    version: newVersion,
  });

  // Restore from version
  blog.title = version.title;
  blog.content = version.content;
  blog.shortDescription = version.shortDescription;
  blog.seoTitle = version.seoTitle;
  blog.metaDescription = version.metaDescription;
  blog.featuredImage = version.featuredImage;
  blog.currentVersion = newVersion;
  blog.updatedBy = req.user._id;

  // Recalculate SEO
  const { score, issues } = calculateSeoScore(blog);
  blog.seoScore = score;
  blog.seoIssues = issues;

  await blog.save();

  successResponse(res, { data: blog });
});

/**
 * DELETE /api/admin/blogs/:id
 * Soft delete (archive) a blog
 */
const deleteBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findByIdAndUpdate(
    req.params.id,
    { status: 'archived', updatedBy: req.user._id },
    { new: true }
  );

  if (!blog) {
    return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
  }

  // Update denormalized counts
  if (blog.category) {
    await BlogCategory.findByIdAndUpdate(blog.category, { $inc: { blogCount: -1 } });
  }
  if (blog.tags && blog.tags.length > 0) {
    await BlogTag.updateMany({ _id: { $in: blog.tags } }, { $inc: { blogCount: -1 } });
  }
  if (blog.authorRef) {
    await BlogAuthor.findByIdAndUpdate(blog.authorRef, { $inc: { blogCount: -1 } });
  }

  // Regenerate sitemap
  regenerateSitemap().catch(() => {});

  successResponse(res, { message: 'Blog archived successfully' });
});

// ──────────────────────────────────────────────
// ADMIN ENDPOINTS - ANALYTICS
// ──────────────────────────────────────────────

/**
 * GET /api/admin/blogs/analytics/overview
 * Get blog analytics overview for dashboard
 */
const getBlogAnalyticsOverview = asyncHandler(async (req, res) => {
  const [totalBlogs, publishedBlogs, draftBlogs, scheduledBlogs, mostViewed, topCategories] =
    await Promise.all([
      Blog.countDocuments({}),
      Blog.countDocuments({ status: 'published' }),
      Blog.countDocuments({ status: 'draft' }),
      Blog.countDocuments({ status: 'scheduled' }),
      Blog.find({ status: 'published' })
        .select('title slug views uniqueVisitors averageScrollDepth totalReadingTime seoScore')
        .sort({ views: -1 })
        .limit(5)
        .lean(),
      BlogCategory.find({})
        .select('name slug color blogCount')
        .sort({ blogCount: -1 })
        .limit(10)
        .lean(),
    ]);

  // Aggregate total views and unique visitors
  const [viewsAgg] = await Blog.aggregate([
    { $group: { _id: null, totalViews: { $sum: '$views' }, totalUnique: { $sum: '$uniqueVisitors' }, totalLikes: { $sum: '$likes' } } },
  ]);

  // Top tags
  const topTags = await BlogTag.find({})
    .select('name slug color blogCount')
    .sort({ blogCount: -1 })
    .limit(10)
    .lean();

  // Top authors
  const topAuthors = await BlogAuthor.find({})
    .select('name slug avatar blogCount')
    .sort({ blogCount: -1 })
    .limit(10)
    .lean();

  successResponse(res, {
    data: {
      totals: {
        totalBlogs,
        publishedBlogs,
        draftBlogs,
        scheduledBlogs,
        totalViews: viewsAgg?.totalViews || 0,
        totalUniqueVisitors: viewsAgg?.totalUnique || 0,
        totalLikes: viewsAgg?.totalLikes || 0,
        averageSeoScore: 0, // Will be calculated below
      },
      mostViewed,
      topCategories,
      topTags,
      topAuthors,
    },
  });
});

/**
 * GET /api/admin/blogs/analytics/traffic
 * Get traffic source analytics for all blogs
 */
const getTrafficAnalytics = asyncHandler(async (req, res) => {
  const trafficAgg = await Blog.aggregate([
    { $match: { status: 'published' } },
    {
      $group: {
        _id: null,
        direct: { $sum: '$trafficSource.direct' },
        organic: { $sum: '$trafficSource.organic' },
        social: { $sum: '$trafficSource.social' },
        referral: { $sum: '$trafficSource.referral' },
        email: { $sum: '$trafficSource.email' },
      },
    },
  ]);

  const traffic = trafficAgg[0] || { direct: 0, organic: 0, social: 0, referral: 0, email: 0 };
  const total = traffic.direct + traffic.organic + traffic.social + traffic.referral + traffic.email;

  successResponse(res, {
    data: {
      sources: traffic,
      percentages: {
        direct: total ? Math.round((traffic.direct / total) * 100) : 0,
        organic: total ? Math.round((traffic.organic / total) * 100) : 0,
        social: total ? Math.round((traffic.social / total) * 100) : 0,
        referral: total ? Math.round((traffic.referral / total) * 100) : 0,
        email: total ? Math.round((traffic.email / total) * 100) : 0,
      },
      total,
    },
  });
});

/**
 * GET /api/admin/blogs/:id/analytics
 * Get per-blog analytics
 */
const getBlogAnalytics = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id)
    .select('views uniqueVisitors averageScrollDepth totalReadingTime likes shares clickThroughRate trafficSource dailyViews seoScore seoIssues popularityScore')
    .lean();

  if (!blog) {
    return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
  }

  successResponse(res, { data: blog });
});

// ──────────────────────────────────────────────
// ADMIN ENDPOINTS - SEO
// ──────────────────────────────────────────────

/**
 * GET /api/admin/blogs/seo/bulk
 * Get bulk SEO status for all blogs
 */
const getBulkSeoStatus = asyncHandler(async (req, res) => {
  let { page = 1, limit = 50, minScore, maxScore } = req.query;
  page = parseInt(page);
  limit = Math.min(parseInt(limit), 100);

  const query = {};
  if (minScore) query.seoScore = { $gte: parseInt(minScore) };
  if (maxScore) query.seoScore = { ...query.seoScore, $lte: parseInt(maxScore) };

  const [blogs, total] = await Promise.all([
    Blog.find(query)
      .select('title slug seoScore seoIssues status featured')
      .populate('category', 'name slug')
      .sort({ seoScore: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Blog.countDocuments(query),
  ]);

  const summary = {
    excellent: blogs.filter((b) => b.seoScore >= 80).length,
    good: blogs.filter((b) => b.seoScore >= 60 && b.seoScore < 80).length,
    needsWork: blogs.filter((b) => b.seoScore >= 40 && b.seoScore < 60).length,
    poor: blogs.filter((b) => b.seoScore < 40).length,
  };

  paginatedResponse(res, { data: { blogs, summary }, total, page, limit });
});

/**
 * GET /api/admin/blogs/:id/seo-score
 * Get real-time SEO score and issues
 */
const getSeoScore = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id)
    .select('title slug seoTitle metaDescription focusKeyword content featuredImage canonicalUrl schemaMarkup openGraphImage seoScore seoIssues readingTime')
    .lean();

  if (!blog) {
    return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
  }

  const { score, issues } = calculateSeoScore(blog);

  successResponse(res, {
    data: {
      score,
      issues,
      suggestions: suggestInternalLinks(blog.content, []),
    },
  });
});

/**
 * POST /api/admin/blogs/:id/seo-suggestions
 * Get internal linking suggestions
 */
const getSeoSuggestions = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id).select('title content').lean();
  if (!blog) {
    return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
  }

  const allBlogs = await Blog.find({
    _id: { $ne: blog._id },
    status: 'published',
  })
    .select('title slug shortDescription')
    .limit(50)
    .lean();

  const suggestions = suggestInternalLinks(blog.content, allBlogs);

  successResponse(res, { data: suggestions });
});

// ──────────────────────────────────────────────
// CATEGORY ENDPOINTS
// ──────────────────────────────────────────────

const getCategories = asyncHandler(async (req, res) => {
  const categories = await BlogCategory.find({})
    .sort({ order: 1, name: 1 })
    .populate('parent', 'name slug')
    .lean();
  successResponse(res, { data: categories });
});

const getCategoryById = asyncHandler(async (req, res) => {
  const category = await BlogCategory.findById(req.params.id)
    .populate('parent', 'name slug')
    .lean();
  if (!category) return errorResponse(res, { statusCode: 404, message: 'Category not found' });
  successResponse(res, { data: category });
});

const createCategory = asyncHandler(async (req, res) => {
  const data = req.body;
  if (!data.slug) data.slug = generateSlug(data.name);
  const category = await BlogCategory.create(data);
  successResponse(res, { statusCode: 201, data: category });
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await BlogCategory.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!category) return errorResponse(res, { statusCode: 404, message: 'Category not found' });
  successResponse(res, { data: category });
});

const deleteCategory = asyncHandler(async (req, res) => {
  const blogCount = await Blog.countDocuments({ category: req.params.id });
  if (blogCount > 0) {
    return errorResponse(res, {
      statusCode: 400,
      message: `Cannot delete category with ${blogCount} blog(s). Reassign blogs first.`,
    });
  }
  const category = await BlogCategory.findByIdAndDelete(req.params.id);
  if (!category) return errorResponse(res, { statusCode: 404, message: 'Category not found' });
  successResponse(res, { message: 'Category deleted' });
});

// ──────────────────────────────────────────────
// TAG ENDPOINTS
// ──────────────────────────────────────────────

const getTags = asyncHandler(async (req, res) => {
  const tags = await BlogTag.find({}).sort({ blogCount: -1 }).lean();
  successResponse(res, { data: tags });
});

const getTagById = asyncHandler(async (req, res) => {
  const tag = await BlogTag.findById(req.params.id).lean();
  if (!tag) return errorResponse(res, { statusCode: 404, message: 'Tag not found' });
  successResponse(res, { data: tag });
});

const createTag = asyncHandler(async (req, res) => {
  const data = req.body;
  if (!data.slug) data.slug = generateSlug(data.name);
  const tag = await BlogTag.create(data);
  successResponse(res, { statusCode: 201, data: tag });
});

const updateTag = asyncHandler(async (req, res) => {
  const tag = await BlogTag.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!tag) return errorResponse(res, { statusCode: 404, message: 'Tag not found' });
  successResponse(res, { data: tag });
});

const deleteTag = asyncHandler(async (req, res) => {
  const blogCount = await Blog.countDocuments({ tags: req.params.id });
  if (blogCount > 0) {
    return errorResponse(res, {
      statusCode: 400,
      message: `Cannot delete tag used by ${blogCount} blog(s). Merge or reassign first.`,
    });
  }
  const tag = await BlogTag.findByIdAndDelete(req.params.id);
  if (!tag) return errorResponse(res, { statusCode: 404, message: 'Tag not found' });
  successResponse(res, { message: 'Tag deleted' });
});

const mergeTags = asyncHandler(async (req, res) => {
  const { sourceId, targetId } = req.body;

  // Replace source tag with target tag in all blogs
  await Blog.updateMany(
    { tags: sourceId },
    { $addToSet: { tags: targetId }, $pull: { tags: sourceId } }
  );

  // Update blog counts
  const sourceBlogCount = await Blog.countDocuments({ tags: targetId });
  await BlogTag.findByIdAndUpdate(targetId, { blogCount: sourceBlogCount });

  // Delete source tag
  await BlogTag.findByIdAndDelete(sourceId);

  successResponse(res, { message: 'Tags merged successfully' });
});

// ──────────────────────────────────────────────
// AUTHOR ENDPOINTS
// ──────────────────────────────────────────────

const getAuthors = asyncHandler(async (req, res) => {
  const authors = await BlogAuthor.find({}).sort({ blogCount: -1 }).lean();
  successResponse(res, { data: authors });
});

const getAuthorById = asyncHandler(async (req, res) => {
  const author = await BlogAuthor.findById(req.params.id).lean();
  if (!author) return errorResponse(res, { statusCode: 404, message: 'Author not found' });
  successResponse(res, { data: author });
});

const createAuthor = asyncHandler(async (req, res) => {
  const data = req.body;
  if (!data.slug) data.slug = generateSlug(data.name);
  const author = await BlogAuthor.create(data);
  successResponse(res, { statusCode: 201, data: author });
});

const updateAuthor = asyncHandler(async (req, res) => {
  const author = await BlogAuthor.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!author) return errorResponse(res, { statusCode: 404, message: 'Author not found' });
  successResponse(res, { data: author });
});

const deleteAuthor = asyncHandler(async (req, res) => {
  const blogCount = await Blog.countDocuments({ authorRef: req.params.id });
  if (blogCount > 0) {
    return errorResponse(res, {
      statusCode: 400,
      message: `Cannot delete author with ${blogCount} blog(s). Reassign blogs first.`,
    });
  }
  const author = await BlogAuthor.findByIdAndDelete(req.params.id);
  if (!author) return errorResponse(res, { statusCode: 404, message: 'Author not found' });
  successResponse(res, { message: 'Author deleted' });
});

// ──────────────────────────────────────────────
// MEDIA ENDPOINTS
// ──────────────────────────────────────────────

const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) {
    return errorResponse(res, { statusCode: 400, message: 'No file uploaded' });
  }

  const { alt, caption, folder } = req.body;
  const media = await uploadAndOptimize(req.file, {
    folder: folder || 'blog',
    alt: alt || '',
    caption: caption || '',
    uploadedBy: req.user._id,
  });

  successResponse(res, { statusCode: 201, data: media });
});

const getMediaList = asyncHandler(async (req, res) => {
  const { page = 1, limit = 30, folder, search } = req.query;
  const result = await getMediaLibrary({
    page: parseInt(page),
    limit: Math.min(parseInt(limit), 100),
    folder,
    search,
  });
  paginatedResponse(res, result);
});

const deleteMediaItem = asyncHandler(async (req, res) => {
  await deleteMedia(req.params.id);
  successResponse(res, { message: 'Media deleted' });
});

// ──────────────────────────────────────────────
// EXPORTS
// ──────────────────────────────────────────────

module.exports = {
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
};

