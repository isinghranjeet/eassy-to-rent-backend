const mongoose = require('mongoose');

const socialLinkSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['website', 'twitter', 'linkedin', 'facebook', 'instagram', 'youtube'],
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
}, { _id: false });

const blogAuthorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Author name is required'],
    trim: true,
    maxLength: [100, 'Author name cannot exceed 100 characters'],
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    default: '',
  },
  bio: {
    type: String,
    trim: true,
    maxLength: [500, 'Bio cannot exceed 500 characters'],
    default: '',
  },
  avatar: {
    type: String,
    default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
  },
  socialLinks: {
    type: [socialLinkSchema],
    default: [],
  },
  role: {
    type: String,
    enum: ['admin', 'guest', 'contributor'],
    default: 'admin',
  },
  isActive: {
    type: Boolean,
    default: true,
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
blogAuthorSchema.pre('save', function (next) {
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
blogAuthorSchema.index({ isActive: 1, blogCount: -1 });

module.exports = mongoose.model('BlogAuthor', blogAuthorSchema);

