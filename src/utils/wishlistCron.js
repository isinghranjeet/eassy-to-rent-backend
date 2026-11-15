const cron = require('node-cron');
const Wishlist = require('../models/Wishlist');
const { sendWishlistReminder } = require('../utils/sendEmail');
const { logger } = require('../utils/logger');

/**
 * Daily Wishlist Reminder Cron Job
 * Runs every day at 9:00 AM: '0 9 * * *'
 * (For testing purposes, you can also change to '* * * * *' for every minute)
 */
const startWishlistReminderJob = () => {
  cron.schedule('0 9 * * *', async () => {
    logger.info('⏳ Running daily wishlist reminder cron job...');
    
    try {
      // ✅ FIX: Populate both userId and pgId to retrieve actual property & user details
      const wishlists = await Wishlist.find({})
        .populate('userId')
        .populate('pgId');

      if (!wishlists || wishlists.length === 0) {
        logger.info('ℹ️ No wishlist items found for reminders.');
        return;
      }

      // Group wishlist items by user
      const userWishlistMap = {};

      for (const entry of wishlists) {
        // Skip if user or PG reference is missing/deleted
        if (!entry.userId || !entry.userId.email || !entry.pgId) {
          continue;
        }

        const userIdStr = entry.userId._id.toString();

        if (!userWishlistMap[userIdStr]) {
          userWishlistMap[userIdStr] = {
            user: entry.userId,
            items: []
          };
        }

        // Push the fully populated PG object so email templates receive name, price, location, etc.
        userWishlistMap[userIdStr].items.push(entry.pgId);
      }

      // Send email reminder to each user
      for (const userId in userWishlistMap) {
        const { user, items } = userWishlistMap[userId];

        if (items && items.length > 0) {
          const result = await sendWishlistReminder(user, items);
          
          if (result && (result.success === true || result === true)) {
            logger.info(`📧 Wishlist reminder successfully sent to ${user.email} with ${items.length} items.`);
          } else {
            logger.error(`❌ Failed to send wishlist reminder to ${user.email}`);
          }
        }
      }

      logger.info('✅ Daily wishlist reminder job completed successfully.');
    } catch (error) {
      logger.error('❌ Error executing wishlist reminder cron job:', {
        message: error.message,
        stack: error.stack
      });
    }
  });

  logger.info('⏰ Wishlist reminder cron job initialized (Scheduled for 09:00 AM daily).');
};

module.exports = { startWishlistReminderJob };