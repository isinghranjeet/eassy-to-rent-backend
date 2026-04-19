const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  excerpt: {
    type: String,
    required: true,
    maxLength: 200
  },
  content: {
    type: String,
    required: true
  },
  coverImage: {
    type: String,
    default: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800'
  },
  category: {
    type: String,
    enum: ['guide', 'tips', 'student-life', 'area-guide', 'news'],
    default: 'guide'
  },
  author: {
    type: String,
    default: 'EasyToRent Team'
  },
  authorImage: {
    type: String,
    default: ''
  },
  readTime: {
    type: Number,
    default: 5
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  published: {
    type: Boolean,
    default: true
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  tags: [{
    type: String
  }]
}, {
  timestamps: true
});

// Create slug from title
blogSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/ /g, '-')
      .replace(/[^\w-]+/g, '');
  }
  next();
});

module.exports = mongoose.model('Blog', blogSchema);