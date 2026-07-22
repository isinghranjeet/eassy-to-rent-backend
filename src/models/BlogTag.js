const mongoose = require('mongoose');

const blogTagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tag name is required'],
    trim: true,
    maxLength: [50, 'Tag name cannot exceed 50 characters'],
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  color: {
    type: String,
    default: '#8B5CF6', // Purple default
    match: [/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Invalid color hex code'],
  },
  blogCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Auto-generate slug from name
blogTagSchema.pre('save', function (next) {
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
blogTagSchema.index({ blogCount: -1 });

module.exports = mongoose.model('BlogTag', blogTagSchema);

