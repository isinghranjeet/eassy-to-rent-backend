const mongoose = require('mongoose');

const responsiveUrlsSchema = new mongoose.Schema({
  webp: { type: String, default: '' },
  avif: { type: String, default: '' },
  '320w': { type: String, default: '' },
  '640w': { type: String, default: '' },
  '1024w': { type: String, default: '' },
  '1920w': { type: String, default: '' },
}, { _id: false });

const blogMediaSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true,
  },
  originalName: {
    type: String,
    required: true,
    trim: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
    min: 0,
  },
  url: {
    type: String,
    required: true,
  },
  thumbnailUrl: {
    type: String,
    default: '',
  },
  responsiveUrls: {
    type: responsiveUrlsSchema,
    default: () => ({}),
  },
  width: {
    type: Number,
    default: 0,
  },
  height: {
    type: Number,
    default: 0,
  },
  alt: {
    type: String,
    trim: true,
    default: '',
  },
  caption: {
    type: String,
    trim: true,
    default: '',
  },
  folder: {
    type: String,
    default: 'blog',
    trim: true,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  cloudinaryPublicId: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
blogMediaSchema.index({ folder: 1, createdAt: -1 });
blogMediaSchema.index({ uploadedBy: 1 });
blogMediaSchema.index({ mimeType: 1 });

module.exports = mongoose.model('BlogMedia', blogMediaSchema);

