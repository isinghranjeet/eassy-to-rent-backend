require('dotenv').config();

const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const BlogCategory = require('../models/BlogCategory');
const BlogTag = require('../models/BlogTag');

const isObjectId = (value) => mongoose.isValidObjectId(value);

const migrateBlogReferences = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const [categories, tags, blogs] = await Promise.all([
    BlogCategory.find({}).select('_id slug').lean(),
    BlogTag.find({}).select('_id slug').lean(),
    Blog.collection.find({}).project({ category: 1, tags: 1 }).toArray(),
  ]);

  const categoryBySlug = new Map(categories.map((category) => [category.slug, category._id]));
  const tagBySlug = new Map(tags.map((tag) => [tag.slug, tag._id]));
  let updated = 0;
  let unresolvedCategories = 0;
  let unresolvedTags = 0;

  for (const blog of blogs) {
    const update = {};

    if (typeof blog.category === 'string') {
      const categoryId = isObjectId(blog.category)
        ? new mongoose.Types.ObjectId(blog.category)
        : categoryBySlug.get(blog.category) || null;
      update.category = categoryId;
      if (!categoryId) unresolvedCategories += 1;
    }

    if (Array.isArray(blog.tags)) {
      const tagIds = blog.tags.map((tag) => {
        if (isObjectId(tag)) return new mongoose.Types.ObjectId(tag);
        const tagId = tagBySlug.get(tag);
        if (!tagId) unresolvedTags += 1;
        return tagId;
      }).filter(Boolean);

      if (blog.tags.some((tag) => !isObjectId(tag))) {
        update.tags = tagIds;
      }
    }

    if (Object.keys(update).length > 0) {
      await Blog.collection.updateOne({ _id: blog._id }, { $set: update });
      updated += 1;
    }
  }

  console.log(JSON.stringify({ updated, unresolvedCategories, unresolvedTags }));
};

migrateBlogReferences()
  .catch((error) => {
    console.error(JSON.stringify({ name: error.name, message: error.message }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });