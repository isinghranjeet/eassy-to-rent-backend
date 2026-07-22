const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { generateSitemapEntry, generateCanonicalUrl } = require('../utils/blogSeo');
const { logger } = require('../utils/logger');

const SITEMAP_DIR = path.join(__dirname, '..', '..', 'public');
const BLOG_SITEMAP_FILE = path.join(SITEMAP_DIR, 'sitemap-blog.xml');
const MAIN_SITEMAP_FILE = path.join(SITEMAP_DIR, 'sitemap.xml');

/**
 * Generate blog sitemap XML
 * Fetches all published blogs and generates XML entries
 * @returns {Promise<string>} Generated XML content
 */
async function generateBlogSitemap() {
  try {
    const Blog = mongoose.model('Blog');

    const blogs = await Blog.find({
      status: 'published',
    })
      .select('title slug featured updatedAt publishedAt status')
      .sort({ updatedAt: -1 })
      .lean();

    const entries = blogs.map((blog) => generateSitemapEntry(blog)).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${entries}
</urlset>`;

    return xml;
  } catch (error) {
    logger.error('Failed to generate blog sitemap:', error.message);
    throw error;
  }
}

/**
 * Generate the main sitemap index that includes blog sitemap
 * @returns {Promise<string>} Generated XML content
 */
async function generateMainSitemapIndex() {
  try {
    const Blog = mongoose.model('Blog');

    const latestBlog = await Blog.findOne({ status: 'published' })
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .lean();

    const lastmod = latestBlog?.updatedAt
      ? new Date(latestBlog.updatedAt).toISOString()
      : new Date().toISOString();

    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${generateCanonicalUrl('/sitemap-blog.xml')}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
</sitemapindex>`;
  } catch (error) {
    logger.error('Failed to generate main sitemap index:', error.message);
    throw error;
  }
}

/**
 * Regenerate both blog sitemap and main sitemap index
 * Called on: publish, update, unpublish, delete blog
 * @returns {Promise<boolean>} Whether regeneration was successful
 */
async function regenerateSitemap() {
  try {
    // Ensure directory exists
    if (!fs.existsSync(SITEMAP_DIR)) {
      fs.mkdirSync(SITEMAP_DIR, { recursive: true });
    }

    // Generate blog sitemap
    const blogSitemapXml = await generateBlogSitemap();
    fs.writeFileSync(BLOG_SITEMAP_FILE, blogSitemapXml, 'utf-8');
    logger.info(`✅ Blog sitemap written: ${BLOG_SITEMAP_FILE}`);

    // Generate main sitemap index
    const mainSitemapXml = await generateMainSitemapIndex();
    fs.writeFileSync(MAIN_SITEMAP_FILE, mainSitemapXml, 'utf-8');
    logger.info(`✅ Main sitemap written: ${MAIN_SITEMAP_FILE}`);

    return true;
  } catch (error) {
    logger.error('❌ Sitemap regeneration failed:', error.message);
    return false;
  }
}

/**
 * Schedule periodic sitemap regeneration using node-cron
 * @param {object} cron - node-cron instance
 */
function scheduleSitemapRegeneration(cron) {
  // Regenerate every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    logger.info('⏰ Running scheduled sitemap regeneration...');
    await regenerateSitemap();
  });
  logger.info('📅 Scheduled sitemap regeneration (every 6 hours)');
}

module.exports = {
  generateBlogSitemap,
  generateMainSitemapIndex,
  regenerateSitemap,
  scheduleSitemapRegeneration,
};

