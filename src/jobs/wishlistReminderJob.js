/**
 * Wishlist Reminder Job
 * Runs every 1 hour to check for PG updates and notify users
 * Non-blocking, fail-silent, no server crash on errors
 */

const cron = require('node-cron');
const Wishlist = require('../models/Wishlist');
const User = require('../models/User');
const PGListing = require('../models/PGListing');
const { sendWishlistReminderEmail } = require('../services/notificationService');

// Minimum hours between notifications for the same item
const NOTIFICATION_COOLDOWN_HOURS = 1;

/**
 * Check wishlist items and send notifications for changes
 */
const processWishlistNotifications = async () => {
  const jobStartTime = new Date();
  console.log(`[${jobStartTime.toISOString()}] ⏰ Wishlist reminder job started`);

  try {
    // Find all wishlists with at least one item
    const wishlists = await Wishlist.find({ 'items.0': { $exists: true } })
      .populate('user', 'name email')
      .lean();

    if (!wishlists || wishlists.length === 0) {
      console.log('No wishlists found. Skipping.');
      return;
    }

    console.log(`Processing ${wishlists.length} wishlists...`);

    let emailsSent = 0;
    let emailsSkipped = 0;
    let errors = 0;

    for (const wishlist of wishlists) {
      try {
        const user = wishlist.user;
        if (!user || !user.email) {
          console.log(`Skipping wishlist ${wishlist._id}: user or email missing`);
          continue;
        }

        // Respect user's wishlist email preference
        if (user.wishlistEmailEnabled === false) {
          console.log(`Skipping wishlist ${wishlist._id}: user disabled wishlist emails`);
          continue;
        }

        for (const item of wishlist.items) {
          try {
            // Check cooldown
            const lastNotified = item.lastNotifiedAt;
            const cooldownMs = NOTIFICATION_COOLDOWN_HOURS * 60 * 60 * 1000;
            if (lastNotified && (Date.now() - new Date(lastNotified).getTime()) < cooldownMs) {
              emailsSkipped++;
              continue;
            }

            // Fetch current PG data
            const pg = await PGListing.findById(item.pg).lean();
            if (!pg) {
              console.log(`PG ${item.pg} not found, skipping.`);
              continue;
            }

            const currentPrice = pg.price;
            const currentAvailability = pg.availability;

            // First-time tracking: set baseline without sending email
            if (item.lastKnownPrice === null || item.lastKnownPrice === undefined) {
              await Wishlist.updateOne(
                { _id: wishlist._id, 'items._id': item._id },
                {
                  $set: {
                    'items.$.lastKnownPrice': currentPrice,
                    'items.$.lastKnownAvailability': currentAvailability,
                  },
                }
              );
              console.log(`Set baseline for user ${user.email} / PG ${pg.name}`);
              continue;
            }

            let changeType = null;

            // Detect price drop
            if (currentPrice < item.lastKnownPrice) {
              changeType = 'price_drop';
            }
            // Detect availability change to available
            else if (currentAvailability === 'available' && item.lastKnownAvailability !== 'available') {
              changeType = 'available';
            }
            // Detect availability change to limited/unavailable
            else if (currentAvailability !== 'available' && item.lastKnownAvailability === 'available') {
              changeType = 'unavailable';
            }

            // Send email if a significant change was detected
            if (changeType) {
              const sent = await sendWishlistReminderEmail(user, pg, changeType);

              if (sent) {
                emailsSent++;
                // Update tracking fields after successful send
                await Wishlist.updateOne(
                  { _id: wishlist._id, 'items._id': item._id },
                  {
                    $set: {
                      'items.$.lastNotifiedAt': new Date(),
                      'items.$.lastKnownPrice': currentPrice,
                      'items.$.lastKnownAvailability': currentAvailability,
                    },
                  }
                );
                console.log(`✅ Sent ${changeType} email to ${user.email} for ${pg.name}`);
              } else {
                console.log(`❌ Failed to send email to ${user.email} for ${pg.name}`);
                errors++;
              }
            } else {
              // No change detected, just update known values silently
              await Wishlist.updateOne(
                { _id: wishlist._id, 'items._id': item._id },
                {
                  $set: {
                    'items.$.lastKnownPrice': currentPrice,
                    'items.$.lastKnownAvailability': currentAvailability,
                  },
                }
              );
            }
          } catch (itemError) {
            console.error(`Error processing item ${item._id}:`, itemError.message);
            errors++;
            // Continue to next item, don't crash
          }
        }
      } catch (wishlistError) {
        console.error(`Error processing wishlist ${wishlist._id}:`, wishlistError.message);
        errors++;
        // Continue to next wishlist, don't crash
      }
    }

    const jobEndTime = new Date();
    const durationMs = jobEndTime - jobStartTime;
    console.log(
      `[${jobEndTime.toISOString()}] ✅ Wishlist reminder job completed in ${durationMs}ms | Sent: ${emailsSent} | Skipped: ${emailsSkipped} | Errors: ${errors}`
    );
  } catch (error) {
    console.error('❌ Wishlist reminder job fatal error:', error.message);
    // Fail silently - do not crash server
  }
};

// Schedule: every 1 hour
// Cron format: minute hour day month day-of-week
const task = cron.schedule('0 * * * *', processWishlistNotifications, {
  scheduled: true,
  timezone: 'Asia/Kolkata', // Indian timezone
});

console.log('📅 Wishlist reminder cron job scheduled (every 1 hour)');

module.exports = { task, processWishlistNotifications };

