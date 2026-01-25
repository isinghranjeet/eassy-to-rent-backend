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
  gallery: [{ // Add gallery field
    type: String
  }],
  googleMapLink: { // Add Google Maps link field
    type: String,
    default: ''
  },
  amenities: [{
    type: String
  }],
  roomTypes: [{ // Add room types field
    type: String,
    enum: ['Single', 'Double', 'Triple', 'Suite'],
    default: ['Single', 'Double']
  }],
  distance: { // Add distance field
    type: String,
    default: ''
  },
  availability: { // Add availability field
    type: String,
    enum: ['available', 'sold-out', 'coming-soon'],
    default: 'available'
  },
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
  },
  ownerId: { // Add owner ID field
    type: String,
    default: ''
  },
  contactEmail: { // Add separate contact email
    type: String,
    default: ''
  },
  contactPhone: { // Add separate contact phone
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