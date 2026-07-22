const mongoose = require('mongoose');

// ──────────────────────────────────────────────
// Schema for Table of Contents entries
// ──────────────────────────────────────────────
const tocEntrySchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  level: { type: Number, required: true, min: 1, max: 6 },
}, { _id: false });

// ──────────────────────────────────────────────
// Schema for SEO issues
// ──────────────────────────────────────────────
const seoIssueSchema = new mongoose.Schema({
  field: { type: String, default: '' },
  issue: { type: String, required: true },
  severity: {
    type: String,
    enum: ['error', 'warning', 'info'],
    required: true,
  },
  suggestion: { type: String, default: '' },
}, { _id: false });

// ──────────────────────────────────────────────
// Schema for version history
// ──────────────────────────────────────────────
const blogVersionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  shortDescription: { type: String, default: '' },
  seoTitle: { type: String, default: '' },
  metaDescription: { type: String, default: '' },
  featuredImage: { type: String, default: '' },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  version: { type: Number, required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, _id: false });

// ──────────────────────────────────────────────
// Schema for traffic source analytics
// ──────────────────────────────────────────────
const trafficSourceSchema = new mongoose.Schema({
  direct: { type: Number, default: 0, min: 0 },
  organic: { type: Number, default: 0, min: 0 },
  social: { type: Number, default: 0, min: 0 },
  referral: { type: Number, default: 0, min: 0 },
  email: { type: Number, default: 0, min: 0 },
}, { _id: false });

// ──────────────────────────────────────────────
// Schema for daily views analytics
// ──────────────────────────────────────────────
const dailyViewSchema = new mongoose.Schema({
  date: { type: String, required: true },
  count: { type: Number, default: 0, min: 0 },
}, { _id: false });

// ──────────────────────────────────────────────
// Schema for visitor tracking (rolling 30 days)
// ──────────────────────────────────────────────
const visitorEntrySchema = new mongoose.Schema({
  ip: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

// ──────────────────────────────────────────────
// Main Blog Schema
// ──────────────────────────────────────────────
const blogSchema = new mongoose.Schema({
  // ── CORE FIELDS ──
  title: {
    type: String,
    required: [true, 'Blog title is required'],
    trim: true,
    maxLength: [200, 'Title cannot exceed 200 characters'],
    index: 'text',
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  shortDescription: {
    type: String,
    required: [true, 'Short description is required'],
    trim: true,
    maxLength: [300, 'Short description cannot exceed 300 characters'],
  },
  content: {
    type: String,
    required: [true, 'Blog content is required'],
  },

  // ── BACKWARD COMPATIBLE FIELDS (existing data) ──
  excerpt: { type: String, default: '' }, // Mapped from old model
  coverImage: { type: String, default: '' }, // Mapped from old model, maps to featuredImage
  author: { type: String, default: 'EasyToRent Team' }, // Old string field
  authorImage: { type: String, default: '' },
  readTime: { type: Number, default: 5 }, // Mapped from old model, maps to readingTime
  published: { type: Boolean, default: false }, // Old boolean field
  publishedAt: { type: Date, default: null }, // Old date field

  // ── MEDIA ──
  featuredImage: {
    type: String,
    default: '',
  },
  featuredImageAlt: {
    type: String,
    default: '',
  },
  featuredImageWidth: {
    type: Number,
    default: 0,
  },
  featuredImageHeight: {
    type: Number,
    default: 0,
  },
  galleryImages: [{
    url: { type: String },
    alt: { type: String, default: '' },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    _id: false,
  }],

  // ── CLASSIFICATION ──
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlogCategory',
    default: null,
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlogTag',
  }],
  authorRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlogAuthor',
    default: null,
  },

  // ── STATUS & PUBLISHING ──
  status: {
    type: String,
    enum: ['draft', 'published', 'scheduled', 'archived'],
    default: 'draft',
    index: true,
  },
  publishDate: {
    type: Date,
    default: null,
  },
  scheduledDate: {
    type: Date,
    default: null,
  },
  featured: {
    type: Boolean,
    default: false,
    index: true,
  },

  // ── RELATIONS (EasyToRent-specific) ──
  relatedProperties: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PGListing',
  }],
  relatedCities: [{ type: String, trim: true }],
  relatedColleges: [{ type: String, trim: true }],
  relatedLocations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
  }],
  relatedAmenities: [{ type: String, trim: true }],
  internalLinks: [{
    text: { type: String },
    url: { type: String },
    _id: false,
  }],

  // ── SEO ──
  seoTitle: {
    type: String,
    trim: true,
    maxLength: [70, 'SEO title cannot exceed 70 characters'],
    default: '',
  },
  metaDescription: {
    type: String,
    trim: true,
    maxLength: [160, 'Meta description cannot exceed 160 characters'],
    default: '',
  },
  metaKeywords: [{ type: String, trim: true }],
  canonicalUrl: {
    type: String,
    default: '',
  },
  focusKeyword: {
    type: String,
    trim: true,
    default: '',
  },
  schemaMarkup: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  openGraphImage: {
    type: String,
    default: '',
  },
  twitterImage: {
    type: String,
    default: '',
  },
  noindex: {
    type: Boolean,
    default: false,
  },

  // ── AUTO-GENERATED ──
  readingTime: {
    type: Number,
    default: 0,
    min: 0,
  },
  tableOfContents: {
    type: [tocEntrySchema],
    default: [],
  },
  wordCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  popularityScore: {
    type: Number,
    default: 0,
    min: 0,
  },

  // ── ANALYTICS ──
  views: {
    type: Number,
    default: 0,
    min: 0,
  },
  uniqueVisitors: {
    type: Number,
    default: 0,
    min: 0,
  },
  visitorIPs: {
    type: [visitorEntrySchema],
    default: [],
  },
  averageScrollDepth: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  totalReadingTime: {
    type: Number,
    default: 0,
    min: 0,
  },
  likes: {
    type: Number,
    default: 0,
    min: 0,
  },
  shares: {
    type: Number,
    default: 0,
    min: 0,
  },
  clickThroughRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  trafficSource: {
    type: trafficSourceSchema,
    default: () => ({}),
  },
  dailyViews: {
    type: [dailyViewSchema],
    default: [],
  },

  // ── SEO SCORE ──
  seoScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  seoIssues: {
    type: [seoIssueSchema],
    default: [],
  },

  // ── VERSION HISTORY ──
  versions: {
    type: [blogVersionSchema],
    default: [],
  },
  currentVersion: {
    type: Number,
    default: 1,
  },

  // ── AUDIT ──
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ──────────────────────────────────────────────
// INDEXES
// ──────────────────────────────────────────────
blogSchema.index({ status: 1, publishDate: -1 });
blogSchema.index({ category: 1, status: 1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ authorRef: 1 });
blogSchema.index({ featured: 1, status: 1 });
blogSchema.index({ views: -1 });
blogSchema.index({ createdAt: -1 });
blogSchema.index({ updatedAt: -1 });
blogSchema.index({ title: 'text', shortDescription: 'text', content: 'text' });
blogSchema.index({ popularityScore: -1 });
blogSchema.index({ status: 1, scheduledDate: 1 }); // For scheduler query

// ──────────────────────────────────────────────
// PRE-SAVE HOOK: Auto-slug generation
// ──────────────────────────────────────────────
blogSchema.pre('save', async function (next) {
  if (this.isModified('title') || !this.slug) {
    let slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    // Ensure uniqueness by appending suffix if needed
    const existing = await mongoose.model('Blog').findOne({
      slug,
      _id: { $ne: this._id },
    });
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }
    this.slug = slug;
  }

  // Backward compatibility: sync old fields to new fields
  if (this.coverImage && !this.featuredImage) {
    this.featuredImage = this.coverImage;
  }
  if (this.excerpt && !this.shortDescription) {
    this.shortDescription = this.excerpt;
  }
  if (this.readTime && !this.readingTime) {
    this.readingTime = this.readTime;
  }

  next();
});

// ──────────────────────────────────────────────
// STATIC METHODS
// ──────────────────────────────────────────────

/**
 * Increment blog view count and track unique visitor
 * @param {string} blogId - Blog ObjectId
 * @param {string} ip - Visitor IP address
 */
blogSchema.statics.incrementViews = async function (blogId, ip) {
  const blog = await this.findById(blogId);
  if (!blog) return;

  blog.views = (blog.views || 0) + 1;

  // Track unique visitor (rolling 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentVisitors = blog.visitorIPs.filter(
    (v) => v.timestamp > thirtyDaysAgo
  );

  if (ip && !recentVisitors.some((v) => v.ip === ip)) {
    blog.visitorIPs.push({ ip, timestamp: new Date() });
    blog.uniqueVisitors = (blog.uniqueVisitors || 0) + 1;
  }

  await blog.save();
};

/**
 * Track scroll depth and reading time
 * @param {string} blogId - Blog ObjectId
 * @param {number} scrollDepth - Percentage (0-100)
 * @param {number} timeSpent - Time spent in seconds
 */
blogSchema.statics.trackReading = async function (blogId, scrollDepth, timeSpent) {
  const blog = await this.findById(blogId);
  if (!blog) return;

  // Weighted average for scroll depth
  const totalReads = blog.views || 1;
  blog.averageScrollDepth = (
    (blog.averageScrollDepth * (totalReads - 1) + scrollDepth) / totalReads
  );

  blog.totalReadingTime = (blog.totalReadingTime || 0) + (timeSpent || 0);

  await blog.save();
};

/**
 * Update daily view count
 * @param {string} blogId - Blog ObjectId
 */
blogSchema.statics.updateDailyViews = async function (blogId) {
  const blog = await this.findById(blogId);
  if (!blog) return;

  const today = new Date().toISOString().split('T')[0];
  const existingDay = blog.dailyViews.find((d) => d.date === today);

  if (existingDay) {
    existingDay.count += 1;
  } else {
    blog.dailyViews.push({ date: today, count: 1 });
    // Keep only last 90 days
    if (blog.dailyViews.length > 90) {
      blog.dailyViews = blog.dailyViews.slice(-90);
    }
  }

  await blog.save();
};

module.exports = mongoose.model('Blog', blogSchema);

