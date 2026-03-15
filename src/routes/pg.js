const express = require("express");
const router = express.Router();
const PGListing = require("../models/PGListing");
const { uploadImage } = require("../utils/cloudinary");
const { protect, ownerOrAdmin } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

// @desc    Get owner's own listings
// @route   GET /api/pg/my-listings
// @access  Private (owner/admin)
router.get("/my-listings", protect, ownerOrAdmin, async (req, res) => {
  try {
    const listings = await PGListing.find({
      ownerId: req.user._id.toString(),
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        items: listings,
        total: listings.length,
      },
    });
  } catch (error) {
    console.error("Error fetching owner listings:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
});

// @desc    Get all PG listings (public - only published)
// @route   GET /api/pg
// @access  Public
router.get("/", async (req, res) => {
  try {
    const {
      city,
      type,
      minPrice,
      maxPrice,
      search,
      limit = 20,
      page = 1,
    } = req.query;

    let query = { published: true };

    if (search) {
      query.$text = { $search: search };
    }

    if (city) {
      query.city = new RegExp(city, "i");
    }

    if (type) {
      query.type = type;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseInt(minPrice);
      if (maxPrice) query.price.$lte = parseInt(maxPrice);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const listings = await PGListing.find(query)
      .sort({ featured: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await PGListing.countDocuments(query);

    res.json({
      success: true,
      data: {
        items: listings,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching PGs:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @desc    Get all PG listings for admin (including unpublished)
// @route   GET /api/pg/admin
// @access  Public (for now - add auth later)
router.get("/admin", async (req, res) => {
  try {
    const listings = await PGListing.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        items: listings,
        total: listings.length,
      },
    });
  } catch (error) {
    console.error("Error fetching admin PGs:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @desc    Get single PG listing
// @route   GET /api/pg/:id
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const listing = await PGListing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "PG listing not found",
      });
    }

    res.json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error("Error fetching PG:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @desc    Get PG listing by slug
// @route   GET /api/pg/slug/:slug
// @access  Public
router.get("/slug/:slug", async (req, res) => {
  try {
    const listing = await PGListing.findOne({ slug: req.params.slug });

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "PG listing not found",
      });
    }

    res.json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error("Error fetching PG by slug:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// Helper: normalize array fields from FormData (handles both "field" and "field[]" keys)
function normalizeArrayFields(pgData, body) {
  const arrayFields = ["amenities", "roomTypes", "gallery", "images"];
  arrayFields.forEach((field) => {
    const values = pgData[field] || body[`${field}[]`];
    if (values) {
      pgData[field] = Array.isArray(values) ? values : [values];
    }
  });
}

// Helper: parse existingImages JSON string from FormData
function parseExistingImages(pgData, body) {
  if (body.existingImages) {
    try {
      pgData.images = JSON.parse(body.existingImages);
    } catch (e) {
      console.error("Failed to parse existingImages:", e.message);
    }
  }
}

// Helper: upload files from multer to Cloudinary
async function uploadFiles(files, folder) {
  const urls = [];
  if (!files || files.length === 0) return urls;

  for (const file of files) {
    try {
      const url = await uploadImage(file.buffer, { folder });
      urls.push(url);
    } catch (err) {
      console.error(`Failed to upload image to ${folder}:`, err.message);
    }
  }
  return urls;
}

// Helper: generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// @desc    Create new PG listing
// @route   POST /api/pg
// @access  Private (owner/admin)
router.post(
  "/",
  protect,
  ownerOrAdmin,
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "gallery", maxCount: 20 },
  ]),
  async (req, res) => {
    try {
      // Parse JSON data from 'data' field if sent as stringified JSON
      let pgData = { ...req.body };

      if (req.body.data) {
        try {
          const parsedData = JSON.parse(req.body.data);
          pgData = { ...pgData, ...parsedData };
        } catch (e) {
          console.error("Failed to parse data field:", e.message);
        }
      }

      // Normalize array fields and parse existingImages
      normalizeArrayFields(pgData, req.body);
      parseExistingImages(pgData, req.body);

      // Auto-set owner info from authenticated user
      pgData.ownerId = req.user._id.toString();
      if (!pgData.ownerName) pgData.ownerName = req.user.name;
      if (!pgData.ownerEmail) pgData.ownerEmail = req.user.email;
      if (!pgData.ownerPhone) pgData.ownerPhone = req.user.phone || "";

      // Upload files to Cloudinary
      const images = await uploadFiles(req.files?.images, "pg-listings/main");
      const gallery = await uploadFiles(
        req.files?.gallery,
        "pg-listings/gallery",
      );

      // Merge uploaded images with any URLs provided in body
      pgData.images = [...(pgData.images || []), ...images];
      pgData.gallery = [...(pgData.gallery || []), ...gallery];

      // Generate slug from name if not provided
      if (pgData.name && !pgData.slug) {
        pgData.slug = generateSlug(pgData.name);
      }

      // Set default values for required fields if missing
      if (!pgData.city) pgData.city = "Chandigarh";
      if (!pgData.type) pgData.type = "boys";
      if (!pgData.contactPhone)
        pgData.contactPhone = pgData.contactPhone || pgData.ownerPhone || "";

      // Create and save
      const listing = new PGListing(pgData);
      await listing.save();

      console.log("PG listing created:", listing._id);

      res.status(201).json({
        success: true,
        data: listing,
        message: "PG listing created successfully",
      });
    } catch (error) {
      console.error("Error creating PG:", error);

      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: messages,
        });
      }

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "A PG with this name already exists",
          error: "Duplicate slug",
        });
      }

      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  },
);

// @desc    Update PG listing
// @route   PUT /api/pg/:id
// @access  Private (owner/admin)
router.put(
  "/:id",
  protect,
  ownerOrAdmin,
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "gallery", maxCount: 20 },
  ]),
  async (req, res) => {
    try {
      let listing = await PGListing.findById(req.params.id);

      if (!listing) {
        return res
          .status(404)
          .json({ success: false, message: "PG listing not found" });
      }

      // Ownership check: user must own the listing or be admin
      if (
        listing.ownerId &&
        listing.ownerId !== req.user._id.toString() &&
        req.user.role !== "admin"
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message: "Not authorized to update this listing",
          });
      }

      let pgData = { ...req.body };
      if (req.body.data) {
        try {
          pgData = JSON.parse(req.body.data);
        } catch (e) {
          console.error("Failed to parse data field:", e.message);
        }
      }

      // Normalize array fields and parse existingImages
      normalizeArrayFields(pgData, req.body);
      parseExistingImages(pgData, req.body);

      // Upload files to Cloudinary
      const images = await uploadFiles(req.files?.images, "pg-listings/main");
      const gallery = await uploadFiles(
        req.files?.gallery,
        "pg-listings/gallery",
      );

      // Merge uploaded images with existing/provided URLs
      pgData.images = [...(pgData.images || []), ...images];
      pgData.gallery = [...(pgData.gallery || []), ...gallery];

      // Update slug if name changed
      if (pgData.name && pgData.name !== listing.name) {
        pgData.slug = generateSlug(pgData.name);
      }

      // Update the listing
      Object.assign(listing, pgData);
      listing.updatedAt = Date.now();

      await listing.save();

      console.log("PG listing updated:", listing._id);

      res.json({
        success: true,
        data: listing,
        message: "PG listing updated successfully",
      });
    } catch (error) {
      console.error("Error updating PG:", error);

      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: messages,
        });
      }

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "A PG with this name already exists",
          error: "Duplicate slug",
        });
      }

      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  },
);

// @desc    Partially update PG listing
// @route   PATCH /api/pg/:id
// @access  Public (for now - add auth later)
router.patch("/:id", async (req, res) => {
  try {
    const listing = await PGListing.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true },
    );

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "PG listing not found",
      });
    }

    res.json({
      success: true,
      data: listing,
      message: "PG listing updated successfully",
    });
  } catch (error) {
    console.error("Error patching PG:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// @desc    Delete PG listing
// @route   DELETE /api/pg/:id
// @access  Public (for now - add auth later)
router.delete("/:id", async (req, res) => {
  try {
    const listing = await PGListing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "PG listing not found",
      });
    }

    await listing.deleteOne();

    res.json({
      success: true,
      message: "PG listing deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting PG:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;
