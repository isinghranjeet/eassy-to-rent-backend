const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  city: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  metaTitle: {
    type: String,
    trim: true,
    default: '',
  },
  metaDescription: {
    type: String,
    trim: true,
    default: '',
  },
  totalActiveListings: {
    type: Number,
    default: 0,
    min: 0,
  },
  averageRent: {
    type: Number,
    default: 0,
    min: 0,
  },
  isIndexed: {
    type: Boolean,
    default: true,
  },
  // Retained for existing location cards and older API consumers.
  pgCount: {
    type: Number,
    default: 0,
  },
  image: {
    type: String,
    default: 'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=500',
  },
  gallery: [{
    type: String,
  }],
  coordinates: {
    lat: { type: Number },
    lng: { type: Number },
  },
  description: {
    type: String,
    maxLength: 500,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  popularity: {
    type: Number,
    default: 0,
  },
  searchCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

locationSchema.index({ name: 1, city: 1 });
locationSchema.index({ name: 'text', slug: 'text' });

module.exports = mongoose.model('Location', locationSchema);
