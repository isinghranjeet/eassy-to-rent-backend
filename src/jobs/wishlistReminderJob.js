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
    // Find all wishlists with at least one item and populate user & nested PG listing
    const wishlists = await Wishlist.find({ 'items.0': { $exists: true } })
      .populate('user', 'name email wishlistEmailEnabled')
      .populate({
        path: 'items.pg', // Adjust to 'items.pgId' if your schema uses pgId instead of pg
        select: 'name address city locality price rating images availability'
      })
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

            // PG is already populated via .populate('items.pg'), but fallback to findById if unpopulated
            let pg = item.pg;
            if (!pg || typeof pg !== 'object' || !pg.name) {
              pg = await PGListing.findById(item.pg || item.pgId).lean();
            }

            if (!pg) {
              console.log(`PG not found for wishlist item, skipping.`);
              continue;
            }

            const currentPrice = pg.price || 0;
            const currentAvailability = pg.availability || 'available';

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

            // Send email if a significant change was detected (or force/test trigger if needed)
            // Passing fully populated real PG object so templates receive real name, price, address
            const sent = await sendWishlistReminderEmail(user, pg, changeType || 'update');

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
              console.log(`✅ Sent wishlist update email to ${user.email} for PG: ${pg.name}`);
            } else {
              console.log(`❌ Failed to send email to ${user.email} for PG: ${pg.name}`);
              errors++;
            }
          } catch (itemError) {
            console.error(`Error processing item in wishlist:`, itemError.message);
            errors++;
          }
        }
      } catch (wishlistError) {
        console.error(`Error processing wishlist ${wishlist._id}:`, wishlistError.message);
        errors++;
      }
    }

    const jobEndTime = new Date();
    const durationMs = jobEndTime - jobStartTime;
    console.log(
      `[${jobEndTime.toISOString()}] ✅ Wishlist reminder job completed in ${durationMs}ms | Sent: ${emailsSent} | Skipped: ${emailsSkipped} | Errors: ${errors}`
    );
  } catch (error) {
    console.error('❌ Wishlist reminder job fatal error:', error.message);
  }
};

// Schedule: every 1 hour
const task = cron.schedule('0 * * * *', processWishlistNotifications, {
  scheduled: true,
  timezone: 'Asia/Kolkata',
});

console.log('📅 Wishlist reminder cron job scheduled (every 1 hour)');

module.exports = { task, processWishlistNotifications };