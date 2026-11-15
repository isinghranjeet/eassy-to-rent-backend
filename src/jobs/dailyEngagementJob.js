// src/jobs/dailyEngagementJob.js
const cron = require('node-cron');
const User = require('../models/User');
const { logger } = require('../utils/logger');

// Safely require Notification model if it exists
let Notification;
try {
  Notification = require('../models/Notification');
} catch (err) {
  try {
    Notification = require('../models/AdminNotification');
  } catch (e) {
    Notification = null;
  }
}

const startDailyEngagementJob = () => {
  cron.schedule('0 */4 * * *', async () => {
    try {
      logger.info('🔔 Running daily engagement notification dispatcher...');

      const users = await User.find({});
      if (!users.length) {
        logger.info('⚠️ No users found for engagement notifications.');
        return;
      }

      const engagementMessages = [
        { title: '🔥 New PGs Near Chandigarh University!', body: 'Check out newly added single-room PGs with modern amenities.' },
        { title: '💡 Looking for a flatmate?', body: 'Browse verified student listings near Sector 115 today.' },
        { title: '⭐ Rate your experience', body: 'How was your stay? Drop a review for your recent property.' },
        { title: '🏷️ Special Rental Discounts', body: 'Explore properties with zero brokerage fees this week.' },
        { title: '📍 Explore Ropar & Mohali Rentals', body: 'Find the best budget accommodations right now on EasyToRent.' }
      ];

      const randomMsg = engagementMessages[Math.floor(Math.random() * engagementMessages.length)];

      let count = 0;
      for (const user of users) {
        if (Notification && typeof Notification.create === 'function') {
          await Notification.create({
            userId: user._id,
            title: randomMsg.title,
            message: randomMsg.body,
            type: 'engagement',
            read: false
          }).catch(() => {});
        }
        count++;
      }

      logger.info(`✅ Successfully processed engagement notifications for ${count} users.`);
    } catch (error) {
      logger.error('❌ Error in daily engagement cron job:', error);
    }
  });

  logger.info('🚀 Daily Engagement Notification Job initialized.');
};

module.exports = { startDailyEngagementJob };