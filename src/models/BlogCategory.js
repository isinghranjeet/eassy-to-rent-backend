const mongoose = require('mongoose');

const blogCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxLength: [100, 'Category name cannot exceed 100 characters'],
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    maxLength: [500, 'Description cannot exceed 500 characters'],
    default: '',
  },
  color: {
    type: String,
    default: '#6366F1', // Indigo default
    match: [/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Invalid color hex code'],
  },
  icon: {
    type: String,
    default: '',
  },
  image: {
    type: String,
    default: '',
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlogCategory',
    default: null,
  },
  order: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  blogCount: {
    type: Number,
    default: 0,
  },
  // SEO fields
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
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Auto-generate slug from name
blogCategorySchema.pre('save', function (next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  next();
});

// Indexes (slug unique index is auto-created from field definition)
blogCategorySchema.index({ isActive: 1, order: 1 });
blogCategorySchema.index({ parent: 1 });

module.exports = mongoose.model('BlogCategory', blogCategorySchema);

