// backend/models/Location.js
const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  pgCount: {
    type: Number,
    default: 0
  },
  image: {
    type: String,
    default: 'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=500'
  },
  gallery: [{
    type: String
  }],
  coordinates: {
    lat: { type: Number },
    lng: { type: Number }
  },
  description: {
    type: String,
    maxLength: 500
  },
  isActive: {
    type: Boolean,
    default: true
  },
  popularity: {
    type: Number,
    default: 0
  },
  searchCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Create slug from name before saving
locationSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
  }
  next();
});

// Index for search
locationSchema.index({ name: 'text', slug: 'text' });

module.exports = mongoose.model('Location', locationSchema);