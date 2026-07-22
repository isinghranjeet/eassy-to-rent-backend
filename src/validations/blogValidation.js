const Joi = require('joi');

// ──────────────────────────────────────────────
// Blog Category Validation
// ──────────────────────────────────────────────
const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]+$/).optional(),
  description: Joi.string().trim().max(500).allow('').default(''),
  color: Joi.string().pattern(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/).default('#6366F1'),
  icon: Joi.string().allow('').default(''),
  image: Joi.string().uri().allow('').default(''),
  parent: Joi.string().allow(null).default(null),
  order: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
  seoTitle: Joi.string().trim().max(70).allow('').default(''),
  metaDescription: Joi.string().trim().max(160).allow('').default(''),
});

const updateCategorySchema = createCategorySchema.fork(
  ['name'],
  (schema) => schema.optional()
);

// ──────────────────────────────────────────────
// Blog Tag Validation
// ──────────────────────────────────────────────
const createTagSchema = Joi.object({
  name: Joi.string().trim().min(1).max(50).required(),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]+$/).optional(),
  color: Joi.string().pattern(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/).default('#8B5CF6'),
});

const updateTagSchema = createTagSchema.fork(
  ['name'],
  (schema) => schema.optional()
);

const mergeTagsSchema = Joi.object({
  sourceId: Joi.string().required(),
  targetId: Joi.string().required(),
}).custom((value, helpers) => {
  if (value.sourceId === value.targetId) {
    return helpers.error('any.custom', {
      message: 'Source and target tags must be different',
    });
  }
  return value;
});

// ──────────────────────────────────────────────
// Blog Author Validation
// ──────────────────────────────────────────────
const createAuthorSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]+$/).optional(),
  email: Joi.string().email().allow('').default(''),
  bio: Joi.string().trim().max(500).allow('').default(''),
  avatar: Joi.string().uri().allow('').default(''),
  socialLinks: Joi.array().items(
    Joi.object({
      platform: Joi.string().valid('website', 'twitter', 'linkedin', 'facebook', 'instagram', 'youtube').required(),
      url: Joi.string().uri().required(),
    })
  ).default([]),
  role: Joi.string().valid('admin', 'guest', 'contributor').default('admin'),
  isActive: Joi.boolean().default(true),
});

const updateAuthorSchema = createAuthorSchema.fork(
  ['name'],
  (schema) => schema.optional()
);

// ──────────────────────────────────────────────
// Blog Post Validation
// ──────────────────────────────────────────────
const createBlogSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]+$/).optional(),
  shortDescription: Joi.string().trim().min(1).max(300).required(),
  content: Joi.string().min(1).required(),

  // Media
  featuredImage: Joi.string().uri().allow('').default(''),
  featuredImageAlt: Joi.string().allow('').default(''),
  featuredImageWidth: Joi.number().integer().min(0).default(0),
  featuredImageHeight: Joi.number().integer().min(0).default(0),
  galleryImages: Joi.array().items(
    Joi.object({
      url: Joi.string().uri().required(),
      alt: Joi.string().allow('').default(''),
      width: Joi.number().integer().min(0).default(0),
      height: Joi.number().integer().min(0).default(0),
    })
  ).default([]),

// Classification
  category: Joi.string().allow('', null).default(null),
  tags: Joi.array().items(Joi.string()).default([]),
  authorRef: Joi.string().allow('', null).default(null),

  // Status
  status: Joi.string().valid('draft', 'published', 'scheduled', 'archived').default('draft'),
  publishDate: Joi.date().allow(null).default(null),
  scheduledDate: Joi.date().allow(null).default(null),
  featured: Joi.boolean().default(false),

  // Relations
  relatedProperties: Joi.array().items(Joi.string()).default([]),
  relatedCities: Joi.array().items(Joi.string()).default([]),
  relatedColleges: Joi.array().items(Joi.string()).default([]),
  relatedLocations: Joi.array().items(Joi.string()).default([]),
  relatedAmenities: Joi.array().items(Joi.string()).default([]),
  internalLinks: Joi.array().items(
    Joi.object({
      text: Joi.string().required(),
      url: Joi.string().uri().required(),
    })
  ).default([]),

  // SEO
  seoTitle: Joi.string().trim().max(70).allow('').default(''),
  metaDescription: Joi.string().trim().max(160).allow('').default(''),
  metaKeywords: Joi.array().items(Joi.string()).default([]),
  canonicalUrl: Joi.string().uri().allow('').default(''),
  focusKeyword: Joi.string().trim().allow('').default(''),
  schemaMarkup: Joi.object().allow(null).default(null),
  openGraphImage: Joi.string().uri().allow('').default(''),
  twitterImage: Joi.string().uri().allow('').default(''),
  noindex: Joi.boolean().default(false),
}).custom((value, helpers) => {
  // Validate scheduled date
  if (value.status === 'scheduled') {
    if (!value.scheduledDate) {
      return helpers.error('any.custom', {
        message: 'scheduledDate is required when status is "scheduled"',
      });
    }
    if (new Date(value.scheduledDate) <= new Date()) {
      return helpers.error('any.custom', {
        message: 'scheduledDate must be in the future',
      });
    }
  }

  // Auto-set publishDate if status is published
  if (value.status === 'published' && !value.publishDate) {
    value.publishDate = new Date();
  }

  return value;
});

const updateBlogSchema = createBlogSchema.fork(
  ['title', 'shortDescription', 'content'],
  (schema) => schema.optional()
);

// ──────────────────────────────────────────────
// Blog Status Update Validation
// ──────────────────────────────────────────────
const updateBlogStatusSchema = Joi.object({
  status: Joi.string().valid('draft', 'published', 'scheduled', 'archived').required(),
  scheduledDate: Joi.date().allow(null).when('status', {
    is: 'scheduled',
    then: Joi.date().greater('now').required().messages({
      'date.greater': 'Scheduled date must be in the future',
    }),
  }),
});

// ──────────────────────────────────────────────
// Media Upload Validation
// ──────────────────────────────────────────────
const mediaUploadSchema = Joi.object({
  alt: Joi.string().trim().max(200).allow('').default(''),
  caption: Joi.string().trim().max(500).allow('').default(''),
  folder: Joi.string().trim().default('blog'),
});

// ──────────────────────────────────────────────
// Reading Tracking Validation
// ──────────────────────────────────────────────
const trackReadingSchema = Joi.object({
  scrollDepth: Joi.number().min(0).max(100).required(),
  timeSpent: Joi.number().min(0).required(),
  source: Joi.string().valid('direct', 'organic', 'social', 'referral', 'email').default('direct'),
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  createTagSchema,
  updateTagSchema,
  mergeTagsSchema,
  createAuthorSchema,
  updateAuthorSchema,
  createBlogSchema,
  updateBlogSchema,
  updateBlogStatusSchema,
  mediaUploadSchema,
  trackReadingSchema,
};

