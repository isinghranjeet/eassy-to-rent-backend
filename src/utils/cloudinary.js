const cloudinary = require("cloudinary").v2;

// Configure Cloudinary (always run configuration)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Check if Cloudinary is properly configured
 * @throws {Error} If environment variables are missing
 */
const ensureConfigured = () => {
  const missing = [];

  if (!process.env.CLOUDINARY_CLOUD_NAME) missing.push("CLOUDINARY_CLOUD_NAME");
  if (!process.env.CLOUDINARY_API_KEY) missing.push("CLOUDINARY_API_KEY");
  if (!process.env.CLOUDINARY_API_SECRET) missing.push("CLOUDINARY_API_SECRET");

  if (missing.length > 0) {
    throw new Error(`Cloudinary configuration missing: ${missing.join(", ")}`);
  }
};

/**
 * Check if a string is a valid URL
 * @param {string} str - String to check
 * @returns {boolean} True if valid URL
 */
const isValidUrl = (str) => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

/**
 * Check if string is base64 image
 * @param {string} str - String to check
 * @returns {boolean} True if base64 image
 */
const isBase64Image = (str) => {
  return (
    typeof str === "string" &&
    (str.startsWith("data:image") ||
      str.startsWith("data:application/octet-stream") ||
      /^[A-Za-z0-9+/=]+$/.test(str))
  );
};

/**
 * Upload a single image to Cloudinary
 * @param {string|Buffer} image - Image URL, base64 string, or file buffer
 * @param {Object} options - Upload options
 * @param {string} options.folder - Folder name in Cloudinary (default: 'pg-listings')
 * @param {string} options.public_id - Custom public ID (optional)
 * @param {boolean} options.overwrite - Overwrite existing file (default: false)
 * @param {Object} options.transformation - Custom transformation params (optional)
 * @returns {Promise<string|null>} Secure URL of uploaded image or null
 */
const uploadImage = async (
  image,
  {
    folder = "pg-listings",
    public_id = null,
    overwrite = false,
    transformation = null,
  } = {},
) => {
  // Return null if no image provided
  if (!image) return null;

  // If it's already a Cloudinary URL (from our domain), return as-is
  if (
    typeof image === "string" &&
    image.includes("cloudinary.com") &&
    isValidUrl(image)
  ) {
    return image;
  }

  // If it's a valid external URL, return as-is (except for base64 data URLs)
  if (typeof image === "string" && isValidUrl(image) && !isBase64Image(image)) {
    return image;
  }

  // Ensure Cloudinary is configured
  ensureConfigured();

  // Prepare upload options
  const uploadOptions = {
    folder,
    overwrite,
    resource_type: "auto",
    transformation: transformation || [
      {
        width: 1200,
        height: 800,
        crop: "fill",
        gravity: "auto",
        quality: "auto",
        fetch_format: "auto",
      },
    ],
  };

  // Add public_id if provided
  if (public_id) {
    uploadOptions.public_id = public_id;
  }

  // Add filename as display name if possible
  if (typeof image === "string" && !isBase64Image(image)) {
    try {
      const filename = image.split("/").pop().split("?")[0];
      if (filename) {
        uploadOptions.display_name = filename;
      }
    } catch {
      // Ignore errors in filename extraction
    }
  }

  try {
    // Convert Buffer to base64 data URI for Cloudinary upload
    let uploadSource = image;
    if (Buffer.isBuffer(image)) {
      uploadSource = `data:image/jpeg;base64,${image.toString("base64")}`;
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(
      uploadSource,
      uploadOptions,
    );

    return result.secure_url;
  } catch (error) {
    console.error("❌ Cloudinary upload error:", {
      message: error.message,
      folder,
      imageType:
        typeof image === "string"
          ? image.startsWith("data:")
            ? "base64"
            : "path/url"
          : "buffer",
    });

    throw new Error(`Image upload failed: ${error.message}`);
  }
};

/**
 * Upload multiple images to Cloudinary gallery
 * @param {Array} images - Array of images (URLs, base64 strings, or buffers)
 * @param {string} folder - Folder name in Cloudinary (default: 'pg-listings/gallery')
 * @param {Object} options - Additional upload options
 * @returns {Promise<Array>} Array of secure URLs
 */
const uploadGalleryImages = async (
  images = [],
  folder = "pg-listings/gallery",
  options = {},
) => {
  // Return empty array if no images
  if (!Array.isArray(images) || images.length === 0) {
    return [];
  }

  // Filter out invalid images
  const validImages = images.filter((img) => img != null && img !== "");

  if (validImages.length === 0) {
    return [];
  }

  try {
    // Upload all images in parallel
    const uploadPromises = validImages.map((img, index) => {
      return uploadImage(img, {
        folder,
        ...options,
      }).catch((error) => {
        console.error(`Failed to upload image ${index + 1}:`, error.message);
        return null; // Return null for failed uploads
      });
    });

    const uploaded = await Promise.all(uploadPromises);

    // Filter out failed uploads (null values)
    const successfulUploads = uploaded.filter(Boolean);

    console.log(
      `✅ Uploaded ${successfulUploads.length}/${validImages.length} images to ${folder}`,
    );

    return successfulUploads;
  } catch (error) {
    console.error("❌ Gallery upload error:", error);
    throw new Error(`Gallery upload failed: ${error.message}`);
  }
};

/**
 * Delete an image from Cloudinary
 * @param {string} imageUrl - Cloudinary URL of the image
 * @returns {Promise<boolean>} True if deleted successfully
 */
const deleteImage = async (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== "string") {
    return false;
  }

  try {
    // Extract public_id from Cloudinary URL
    // URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567/folder/public_id.jpg
    const urlParts = imageUrl.split("/");
    const versionIndex = urlParts.findIndex((part) => /^v\d+$/.test(part));

    if (versionIndex === -1 || versionIndex === urlParts.length - 1) {
      return false;
    }

    // Get everything after version as public_id (without extension)
    const publicIdWithExt = urlParts.slice(versionIndex + 1).join("/");
    const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ""); // Remove extension

    ensureConfigured();

    const result = await cloudinary.uploader.destroy(publicId);

    return result.result === "ok";
  } catch (error) {
    console.error("❌ Image deletion error:", error);
    return false;
  }
};

module.exports = {
  uploadImage,
  uploadGalleryImages,
  deleteImage,
  ensureConfigured,
};
