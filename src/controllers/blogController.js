const Blog = require('../models/Blog');
const { successResponse, errorResponse } = require('../utils/response');

// @desc    Get all blogs
// @route   GET /api/blogs
// @access  Public
const getBlogs = async (req, res) => {
  try {
    let { page = 1, limit = 9, category, search } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    // ✅ FIX: handle missing published field
    let query = {
      $or: [
        { published: true },
        { published: { $exists: false } } // 🔥 important fix
      ]
    };

    // ✅ Category filter (case-insensitive)
    if (category && category !== 'all') {
      query.category = { $regex: `^${category}$`, $options: 'i' };
    }

    // ✅ Search filter (title + excerpt)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } }
      ];
    }

    const blogs = await Blog.find(query)
      .sort({ publishedAt: -1, createdAt: -1 }) // better sorting
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Blog.countDocuments(query);

    successResponse(res, {
      data: {
        blogs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });

  } catch (error) {
    errorResponse(res, { statusCode: 500, message: error.message });
  }
};

// @desc    Get single blog by slug
const getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({
      slug: req.params.slug,
      $or: [
        { published: true },
        { published: { $exists: false } }
      ]
    });

    if (!blog) {
      return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
    }

    // ✅ Increment views safely
    blog.views = (blog.views || 0) + 1;
    await blog.save();

    // ✅ Related blogs
    const relatedBlogs = await Blog.find({
      _id: { $ne: blog._id },
      category: blog.category,
      published: true
    })
      .limit(3)
      .select('title slug coverImage publishedAt');

    successResponse(res, {
      data: { blog, relatedBlogs }
    });

  } catch (error) {
    errorResponse(res, { statusCode: 500, message: error.message });
  }
};

// @desc    Create blog (Admin only)
const createBlog = async (req, res) => {
  try {
    // ✅ default values fix
    const blogData = {
      ...req.body,
      published: req.body.published ?? true,
      views: 0,
      likes: 0,
      publishedAt: req.body.publishedAt || new Date()
    };

    const blog = await Blog.create(blogData);

    successResponse(res, {
      statusCode: 201,
      data: blog
    });

  } catch (error) {
    errorResponse(res, { statusCode: 500, message: error.message });
  }
};

// @desc    Update blog
const updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!blog) {
      return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
    }

    successResponse(res, { data: blog });

  } catch (error) {
    errorResponse(res, { statusCode: 500, message: error.message });
  }
};

// @desc    Delete blog
const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);

    if (!blog) {
      return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
    }

    successResponse(res, { message: 'Blog deleted successfully' });

  } catch (error) {
    errorResponse(res, { statusCode: 500, message: error.message });
  }
};

// @desc    Like blog
const likeBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
    }

    blog.likes = (blog.likes || 0) + 1;
    await blog.save();

    successResponse(res, {
      data: { likes: blog.likes }
    });

  } catch (error) {
    errorResponse(res, { statusCode: 500, message: error.message });
  }
};

module.exports = {
  getBlogs,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
  likeBlog
};