const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'djqfyb7si',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

/**
 * Upload a file to Cloudinary with optimization
 * @param {object} file - Multer file object {buffer, mimetype, originalname, size}
 * @param {object} options - Upload options
 * @param {string} options.folder - Cloudinary folder (default: 'blog')
 * @param {string} options.alt - Alt text for the image
 * @param {string} options.caption - Caption for the image
 * @param {string} options.uploadedBy - User ID who uploaded
 * @returns {Promise<object>} Saved BlogMedia document
 */
async function uploadAndOptimize(file, options = {}) {
  const {
    folder = 'blog',
    alt = '',
    caption = '',
    uploadedBy = null,
  } = options;

  try {
    if (!file || !file.buffer) {
      throw new Error('No file buffer provided');
    }

    // Upload original to Cloudinary with transformations
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          // Generate WebP version
          format: 'webp',
          // Optimize quality
          quality: 'auto:good',
          // Fetch format for auto-detection
          fetch_format: 'auto',
          // Responsive breakpoints
          responsive_breakpoints: [
            {
              create_derived: true,
              bytes_step: 20000,
              min_width: 200,
              max_width: 1920,
              max_images: 6,
            },
          ],
          // Generate thumbnail
          eager: [
            { width: 150, height: 150, crop: 'thumb', gravity: 'auto' },
            { width: 320, height: 240, crop: 'fill', gravity: 'auto' },
            { width: 640, height: 480, crop: 'fill', gravity: 'auto' },
            { width: 1024, height: 768, crop: 'fill', gravity: 'auto' },
            { width: 1920, height: 1080, crop: 'fill', gravity: 'auto' },
          ],
          eager_async: false,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      uploadStream.end(file.buffer);
    });

    // Build responsive URLs from Cloudinary result
    const publicId = result.public_id;
    const baseUrl = result.secure_url.replace('/upload/', '/upload/');

    // Save to BlogMedia collection
    const BlogMedia = mongoose.model('BlogMedia');

    const mediaDoc = await BlogMedia.create({
      filename: publicId.split('/').pop(),
      originalName: file.originalname || 'unnamed',
      mimeType: file.mimetype || 'image/jpeg',
      size: file.size || result.bytes || 0,
      url: result.secure_url,
      thumbnailUrl: result.eager?.[0]?.secure_url || '',
      responsiveUrls: {
        webp: result.secure_url.replace('/image/upload/', '/image/upload/f_webp/'),
        avif: result.secure_url.replace('/image/upload/', '/image/upload/f_avif/'),
        '320w': result.eager?.[1]?.secure_url || '',
        '640w': result.eager?.[2]?.secure_url || '',
        '1024w': result.eager?.[3]?.secure_url || '',
        '1920w': result.eager?.[4]?.secure_url || '',
      },
      width: result.width || 0,
      height: result.height || 0,
      alt,
      caption,
      folder,
      uploadedBy,
      cloudinaryPublicId: publicId,
    });

    logger.info(`✅ Image uploaded to Cloudinary: ${publicId}`);

    return mediaDoc;
  } catch (error) {
    logger.error('❌ Cloudinary upload failed:', error.message);
    throw new Error(`Image upload failed: ${error.message}`);
  }
}

/**
 * Delete a file from Cloudinary and database
 * @param {string} mediaId - BlogMedia document ID
 * @returns {Promise<boolean>}
 */
async function deleteMedia(mediaId) {
  try {
    const BlogMedia = mongoose.model('BlogMedia');
    const media = await BlogMedia.findById(mediaId);

    if (!media) {
      throw new Error('Media not found');
    }

    // Delete from Cloudinary
    if (media.cloudinaryPublicId) {
      await new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(media.cloudinaryPublicId, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });
      logger.info(`🗑️ Deleted from Cloudinary: ${media.cloudinaryPublicId}`);
    }

    // Delete from database
    await BlogMedia.findByIdAndDelete(mediaId);
    logger.info(`🗑️ Deleted media from database: ${mediaId}`);

    return true;
  } catch (error) {
    logger.error('❌ Media deletion failed:', error.message);
    throw new Error(`Media deletion failed: ${error.message}`);
  }
}

/**
 * Get paginated media library
 * @param {object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 30)
 * @param {string} options.folder - Filter by folder
 * @param {string} options.search - Search by filename
 * @returns {Promise<{items: Array, total: number, page: number, limit: number, totalPages: number}>}
 */
async function getMediaLibrary(options = {}) {
  const { page = 1, limit = 30, folder = '', search = '' } = options;

  const query = {};

  if (folder) {
    query.folder = folder;
  }

  if (search) {
    query.filename = { $regex: search, $options: 'i' };
  }

  const BlogMedia = mongoose.model('BlogMedia');
  const total = await BlogMedia.countDocuments(query);
  const items = await BlogMedia.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('uploadedBy', 'name email')
    .lean();

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = {
  uploadAndOptimize,
  deleteMedia,
  getMediaLibrary,
};

