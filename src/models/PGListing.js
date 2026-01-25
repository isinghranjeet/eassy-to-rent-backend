// models/PGListing.js
const mongoose = require('mongoose');

const PGListingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'PG name is required'],
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  locality: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  type: {
    type: String,
    enum: ['boys', 'girls', 'co-ed', 'family'],
    default: 'boys'
  },
  images: [{
    type: String
  }],
  amenities: [{
    type: String
  }],
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  published: {
    type: Boolean,
    default: false
  },
  verified: {
    type: Boolean,
    default: false
  },
  featured: {
    type: Boolean,
    default: false
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  ownerName: {
    type: String,
    default: ''
  },
  ownerPhone: {
    type: String,
    default: ''
  },
  ownerEmail: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Create index for location for geospatial queries
PGListingSchema.index({ location: '2dsphere' });

// Create index for text search
PGListingSchema.index({ 
  name: 'text', 
  description: 'text', 
  city: 'text', 
  address: 'text' 
});

// Export the model
module.exports = mongoose.models.PGListing || mongoose.model('PGListing', PGListingSchema);