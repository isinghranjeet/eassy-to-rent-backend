const Blog = require('../models/Blog');
const { successResponse, errorResponse } = require('../utils/response');

// @desc    Get all blogs
// @route   GET /api/blogs
// @access  Public
const getBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 9, category, search } = req.query;
    
    let query = { published: true };
    if (category && category !== 'all') query.category = category;
    if (search) query.title = { $regex: search, $options: 'i' };
    
    const blogs = await Blog.find(query)
      .sort('-publishedAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Blog.countDocuments(query);
    
    successResponse(res, {
      data: {
        blogs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    errorResponse(res, { statusCode: 500, message: error.message });
  }
};

// @desc    Get single blog by slug
// @route   GET /api/blogs/:slug
// @access  Public
const getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug, published: true });
    
    if (!blog) {
      return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
    }
    
    // Increment views
    blog.views += 1;
    await blog.save();
    
    // Get related blogs
    const relatedBlogs = await Blog.find({
      _id: { $ne: blog._id },
      category: blog.category,
      published: true
    }).limit(3).select('title slug coverImage publishedAt');
    
    successResponse(res, {
      data: { blog, relatedBlogs }
    });
  } catch (error) {
    errorResponse(res, { statusCode: 500, message: error.message });
  }
};

// @desc    Create blog (Admin only)
// @route   POST /api/blogs
// @access  Private/Admin
const createBlog = async (req, res) => {
  try {
    const blog = await Blog.create(req.body);
    successResponse(res, { statusCode: 201, data: blog });
  } catch (error) {
    errorResponse(res, { statusCode: 500, message: error.message });
  }
};

// @desc    Update blog (Admin only)
// @route   PUT /api/blogs/:id
// @access  Private/Admin
const updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!blog) {
      return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
    }
    successResponse(res, { data: blog });
  } catch (error) {
    errorResponse(res, { statusCode: 500, message: error.message });
  }
};

// @desc    Delete blog (Admin only)
// @route   DELETE /api/blogs/:id
// @access  Private/Admin
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
// @route   POST /api/blogs/:id/like
// @access  Public
const likeBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
    }
    blog.likes += 1;
    await blog.save();
    successResponse(res, { data: { likes: blog.likes } });
  } catch (error) {
    errorResponse(res, { statusCode: 500, message: error.message });
  }
};

module.exports = { getBlogs, getBlogBySlug, createBlog, updateBlog, deleteBlog, likeBlog };