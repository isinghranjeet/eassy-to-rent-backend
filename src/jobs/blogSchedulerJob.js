const cron = require('node-cron');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const { regenerateSitemap } = require('../services/sitemapService');

/**
 * Blog Scheduler Job
 * Runs every minute to check for scheduled blogs that need publishing
 */
function startBlogScheduler() {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const Blog = mongoose.model('Blog');

      const now = new Date();
      const result = await Blog.updateMany(
        {
          status: 'scheduled',
          scheduledDate: { $lte: now },
        },
        {
          $set: {
            status: 'published',
            publishDate: now,
            publishedAt: now,
          },
        }
      );

      if (result.modifiedCount > 0) {
        logger.info(
          `📰 Blog scheduler: Published ${result.modifiedCount} scheduled blog(s)`
        );

        // Regenerate sitemap for published blogs
        await regenerateSitemap();
      }
    } catch (error) {
      logger.error('❌ Blog scheduler error:', error.message);
    }
  });

  logger.info('📅 Blog scheduler started (checks every minute)');
}

module.exports = { startBlogScheduler };

