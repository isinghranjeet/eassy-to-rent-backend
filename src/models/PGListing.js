const mongoose = require('mongoose');

const PGListingSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'PG name is required'],
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  
  // Location Details
  city: {
    type: String,
    required: true,
    default: 'Chandigarh'
  },
  locality: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    required: true
  },
  distance: {
    type: String,
    default: ''
  },
  googleMapLink: {
    type: String,
    default: ''
  },
  
  // MAP COORDINATES
  coordinates: {
    lat: {
      type: Number,
      default: null
    },
    lng: {
      type: Number,
      default: null
    }
  },
  
  // GeoJSON format for MongoDB geospatial queries
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
  
  // Pricing
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  type: {
    type: String,
    enum: ['boys', 'girls', 'co-ed', 'family'],
    default: 'boys'
  },
  
  // Media
  images: [{
    type: String
  }],
  gallery: [{
    type: String
  }],
  
  // ✅ NEW: Virtual Tour Fields
  videoUrl: {
    type: String,
    default: '',
    validate: {
      validator: function(v) {
        if (!v) return true;
        // Validate YouTube, Vimeo URLs
        return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\/.+$/.test(v);
      },
      message: 'Invalid video URL. Please provide a valid YouTube or Vimeo URL'
    }
  },
  virtualTour: {
    type: String,
    default: '',
    validate: {
      validator: function(v) {
        if (!v) return true;
        // Validate Matterport, Kuula, or other 3D tour URLs
        return /^(https?:\/\/).+\.(com|org|net)\/.+$/.test(v);
      },
      message: 'Invalid virtual tour URL'
    }
  },
  
  // Features
  amenities: [{
    type: String
  }],
  roomTypes: [{
    type: String
  }],
  availability: {
    type: String,
    default: 'available'
  },
  
  // Status Flags
  published: {
    type: Boolean,
    default: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  featured: {
    type: Boolean,
    default: false
  },
  
  // Ratings & Reviews
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
  
  // DEMAND METER FIELDS
  views: {
    type: Number,
    default: 0
  },
  weeklyBookings: {
    type: Number,
    default: 0
  },
  monthlyBookings: {
    type: Number,
    default: 0
  },
  lastViewUpdate: {
    type: Date,
    default: Date.now
  },
  
  // Owner Information
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
  ownerId: {
    type: String,
    default: ''
  },
  
  // Contact Information
  contactEmail: {
    type: String,
    default: ''
  },
  contactPhone: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create slug before saving
PGListingSchema.pre('save', function(next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
  }
  
  // Auto-sync coordinates with location field for geospatial queries
  if (this.coordinates && this.coordinates.lat && this.coordinates.lng) {
    this.location = {
      type: 'Point',
      coordinates: [this.coordinates.lng, this.coordinates.lat]
    };
  }
  
  next();
});

// Virtual to get lat/lng easily
PGListingSchema.virtual('lat').get(function() {
  return this.coordinates?.lat || this.location?.coordinates?.[1] || null;
});

PGListingSchema.virtual('lng').get(function() {
  return this.coordinates?.lng || this.location?.coordinates?.[0] || null;
});

// ✅ NEW: Virtual to get video embed URL
PGListingSchema.virtual('videoEmbedUrl').get(function() {
  if (!this.videoUrl) return null;
  
  let embedUrl = this.videoUrl;
  
  // Convert YouTube URLs to embed format
  if (embedUrl.includes('youtube.com/watch?v=')) {
    embedUrl = embedUrl.replace('watch?v=', 'embed/');
  } else if (embedUrl.includes('youtu.be/')) {
    const videoId = embedUrl.split('youtu.be/')[1]?.split('?')[0];
    embedUrl = `https://www.youtube.com/embed/${videoId}`;
  } else if (embedUrl.includes('vimeo.com/') && !embedUrl.includes('player.vimeo.com')) {
    const videoId = embedUrl.split('vimeo.com/')[1]?.split('?')[0];
    embedUrl = `https://player.vimeo.com/video/${videoId}`;
  }
  
  return embedUrl;
});

// ✅ NEW: Virtual to check if virtual tour exists
PGListingSchema.virtual('hasVirtualTour').get(function() {
  return !!(this.videoUrl || this.virtualTour);
});

// ✅ NEW: Virtual to get virtual tour type
PGListingSchema.virtual('virtualTourType').get(function() {
  if (this.videoUrl) {
    if (this.videoUrl.includes('youtube') || this.videoUrl.includes('youtu.be')) {
      return 'youtube';
    }
    if (this.videoUrl.includes('vimeo')) {
      return 'vimeo';
    }
    return 'video';
  }
  if (this.virtualTour) {
    if (this.virtualTour.includes('matterport')) {
      return 'matterport';
    }
    if (this.virtualTour.includes('kuula')) {
      return 'kuula';
    }
    return '3d-tour';
  }
  return null;
});

// Helper method to get formatted coordinates for frontend
PGListingSchema.methods.getMapCoordinates = function() {
  const lat = this.coordinates?.lat || this.location?.coordinates?.[1];
  const lng = this.coordinates?.lng || this.location?.coordinates?.[0];
  
  if (lat && lng) {
    return { lat, lng };
  }
  return null;
};

// Method to increment view count
PGListingSchema.methods.incrementViews = async function() {
  this.views += 1;
  this.lastViewUpdate = new Date();
  return await this.save();
};

// Method to increment booking count
PGListingSchema.methods.incrementBookings = async function() {
  this.weeklyBookings += 1;
  this.monthlyBookings += 1;
  return await this.save();
};

// ✅ NEW: Method to update virtual tour
PGListingSchema.methods.setVirtualTour = async function(videoUrl, virtualTour) {
  if (videoUrl !== undefined) this.videoUrl = videoUrl;
  if (virtualTour !== undefined) this.virtualTour = virtualTour;
  return await this.save();
};

// Indexes for faster queries
PGListingSchema.index({ slug: 1 });
PGListingSchema.index({ name: 1 });
PGListingSchema.index({ city: 1 });
PGListingSchema.index({ type: 1 });
PGListingSchema.index({ price: 1 });
PGListingSchema.index({ published: 1 });
PGListingSchema.index({ rating: -1 });
PGListingSchema.index({ createdAt: -1 });
PGListingSchema.index({ views: -1 });
PGListingSchema.index({ weeklyBookings: -1 });
PGListingSchema.index({ location: '2dsphere' });
PGListingSchema.index({ videoUrl: 1 });
PGListingSchema.index({ virtualTour: 1 });

// Compound indexes for common queries
PGListingSchema.index({ city: 1, published: 1, price: 1 });
PGListingSchema.index({ type: 1, city: 1, published: 1 });
PGListingSchema.index({ published: 1, views: -1 });

// ✅ NEW: Compound index for virtual tour filter
PGListingSchema.index({ published: 1, videoUrl: 1 });
PGListingSchema.index({ featured: 1, videoUrl: 1 });

// Text search index
PGListingSchema.index({ 
  name: 'text', 
  description: 'text', 
  address: 'text', 
  city: 'text' 
});

const PGListing = mongoose.model('PGListing', PGListingSchema);

// ✅ CRITICAL FIX: Export both names - PG for wishlist compatibility
module.exports = PGListing;
module.exports.PG = PGListing;