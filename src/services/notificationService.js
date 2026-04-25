/**
 * Notification Service
 * Centralized email notification system for EasyToRent
 * All emails: non-blocking, fire-and-forget, fail-silent
 */

const { sendEmail } = require('../utils/sendEmail');
const User = require('../models/User');
const PGListing = require('../models/PGListing');

// ─────────────────────────────────────────────
// 1. LOGIN SUCCESS EMAIL
// ─────────────────────────────────────────────
const sendLoginSuccessEmail = async (user, ipAddress = '') => {
  try {
    const loginTime = new Date().toLocaleString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login Successful - EasyToRent</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .info-box { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info-row { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .info-row:last-child { border-bottom: none; }
          .label { color: #6b7280; font-size: 14px; }
          .value { color: #1f2937; font-weight: 600; }
          .alert-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 12px 30px; text-decoration: none; border-radius: 50px; font-weight: bold; margin-top: 15px; }
          .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
            <h1>Login Successful</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">Welcome back to EasyToRent!</p>
          </div>
          
          <div class="content">
            <h2 style="color: #1f2937; margin-top: 0;">Hi ${user.name} 👋</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">You have successfully logged in to your EasyToRent account.</p>
            
            <div class="info-box">
              <div class="info-row">
                <span class="label">Name</span><br>
                <span class="value">${user.name}</span>
              </div>
              <div class="info-row">
                <span class="label">Email</span><br>
                <span class="value">${user.email}</span>
              </div>
              <div class="info-row">
                <span class="label">Login Time</span><br>
                <span class="value">${loginTime}</span>
              </div>
              ${ipAddress ? `
              <div class="info-row">
                <span class="label">IP Address</span><br>
                <span class="value">${ipAddress}</span>
              </div>` : ''}
            </div>
            
            <div class="alert-box">
              <p style="margin: 0; color: #92400e; font-size: 14px; display: flex; align-items: center;">
                <span style="font-size: 20px; margin-right: 10px;">🔒</span>
                <strong>Security Notice:</strong> If this wasn't you, please reset your password immediately.
              </p>
              <div style="text-align: center; margin-top: 15px;">
                <a href="https://easytorent.in/forgot-password" class="button">Reset Password</a>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p>EasyToRent - Find your perfect PG accommodation</p>
            <p>📍 Chandigarh | Mohali | Panchkula | Zirakpur</p>
            <p>© ${new Date().getFullYear()} EasyToRent. All rights reserved.</p>
            <p style="font-size: 11px;">This is an automated security notification.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Login Successful - EasyToRent\n\nHi ${user.name},\n\nYou have successfully logged in.\n\nLogin Time: ${loginTime}\n${ipAddress ? `IP Address: ${ipAddress}\n` : ''}\nIf this wasn't you, please reset your password at https://easytorent.in/forgot-password`;

    const sent = await sendEmail({
      email: user.email,
      subject: 'Login Successful - EasyToRent',
      html,
      text,
    });

    if (sent) {
      console.log(`✅ Login success email sent to ${user.email}`);
    }
    return sent;
  } catch (error) {
    console.error('❌ sendLoginSuccessEmail error:', error.message);
    return false;
  }
};

// ─────────────────────────────────────────────
// 2. ADMIN OFFER EMAIL
// ─────────────────────────────────────────────
const sendOfferEmail = async (userId, pgId, offerMessage, discount = null) => {
  try {
    // Validate inputs
    if (!userId || !pgId) {
      console.error('❌ sendOfferEmail: userId and pgId are required');
      return false;
    }

    // Fetch user
    const user = await User.findById(userId);
    if (!user) {
      console.error(`❌ sendOfferEmail: User not found (${userId})`);
      return false;
    }

    // Fetch PG
    const pg = await PGListing.findById(pgId);
    if (!pg) {
      console.error(`❌ sendOfferEmail: PG not found (${pgId})`);
      return false;
    }

    const discountText = discount ? `${discount}% OFF` : 'Special Offer';
    const discountBadge = discount
      ? `<div style="background: #ffd700; color: #333; padding: 8px 16px; border-radius: 50px; display: inline-block; font-weight: bold; margin-top: 15px;">🔥 ${discount}% OFF 🔥</div>`
      : `<div style="background: #ffd700; color: #333; padding: 8px 16px; border-radius: 50px; display: inline-block; font-weight: bold; margin-top: 15px;">🔥 SPECIAL OFFER 🔥</div>`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Exclusive Offer - EasyToRent</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .pg-card { background: #f9f9f9; border-radius: 15px; padding: 20px; margin: 20px 0; }
          .pg-image { width: 100%; max-width: 300px; height: 180px; object-fit: cover; border-radius: 12px; }
          .pg-name { font-size: 20px; font-weight: bold; color: #1f2937; margin: 10px 0; }
          .pg-detail { color: #6b7280; font-size: 14px; margin: 5px 0; }
          .price { font-size: 24px; font-weight: bold; color: #f97316; }
          .offer-message { background: #fff7ed; border-left: 4px solid #f97316; padding: 20px; border-radius: 8px; margin: 20px 0; font-size: 16px; color: #7c2d12; }
          .button { display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 14px 35px; text-decoration: none; border-radius: 50px; font-weight: bold; margin-top: 20px; transition: transform 0.3s; }
          .button:hover { transform: scale(1.05); }
          .features { background: #f9f9f9; padding: 20px; border-radius: 15px; margin: 20px 0; }
          .feature { padding: 8px 0; border-bottom: 1px solid #eee; }
          .feature:last-child { border-bottom: none; }
          .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 EasyToRent</h1>
            <p>Exclusive Offer Just For You!</p>
            ${discountBadge}
          </div>
          
          <div class="content">
            <h2 style="text-align: center;">Hi ${user.name}! 👋</h2>
            <p style="text-align: center; font-size: 18px; color: #4b5563;">We have a special offer on a PG you might love!</p>
            
            <div class="pg-card">
              <div style="text-align: center;">
                <img src="${pg.images?.[0] || 'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=400'}" 
                     alt="${pg.name}" 
                     class="pg-image">
              </div>
              <div class="pg-name">${pg.name}</div>
              <div class="pg-detail">📍 ${pg.address}, ${pg.city}</div>
              <div class="pg-detail">🏠 ${pg.type?.toUpperCase() || 'PG'} | ${pg.roomTypes?.join(', ') || 'Shared Rooms'}</div>
              <div class="price" style="text-align: center; margin-top: 10px;">₹${pg.price.toLocaleString()}/month</div>
            </div>
            
            <div class="offer-message">
              <strong>🎁 Message from Admin:</strong><br>
              ${offerMessage.replace(/\n/g, '<br>')}
            </div>
            
            <div class="features">
              <div class="feature">✅ <strong>Verified Property</strong> - 100% genuine listing</div>
              <div class="feature">✅ <strong>No Brokerage</strong> - Direct owner contact</div>
              <div class="feature">✅ <strong>Easy Booking</strong> - Just a few clicks</div>
              <div class="feature">✅ <strong>24/7 Support</strong> - We're here to help</div>
            </div>
            
            <div style="text-align: center;">
              <a href="https://easytorent.in/pg/${pg._id}" class="button">🔍 View Property & Claim Offer</a>
            </div>
            
            <p style="text-align: center; font-size: 12px; color: #888; margin-top: 20px;">
              ⏰ Limited time offer. Don't miss out!
            </p>
          </div>
          
          <div class="footer">
            <p>EasyToRent - Find your perfect PG accommodation</p>
            <p>📍 Chandigarh | Mohali | Panchkula | Zirakpur</p>
            <p>© ${new Date().getFullYear()} EasyToRent. All rights reserved.</p>
            <p style="font-size: 11px;">You're receiving this email because you're a valued EasyToRent user.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Exclusive Offer - EasyToRent\n\nHi ${user.name},\n\nWe have a special offer for you on:\n\n${pg.name}\n📍 ${pg.address}, ${pg.city}\n💰 ₹${pg.price.toLocaleString()}/month\n\nMessage: ${offerMessage}\n${discount ? `\nDiscount: ${discount}% OFF` : ''}\n\nView: https://easytorent.in/pg/${pg._id}`;

    const sent = await sendEmail({
      email: user.email,
      subject: `🎉 Exclusive Offer: ${pg.name} - EasyToRent`,
      html,
      text,
    });

    if (sent) {
      console.log(`✅ Offer email sent to ${user.email} for PG: ${pg.name}`);
    }
    return sent;
  } catch (error) {
    console.error('❌ sendOfferEmail error:', error.message);
    return false;
  }
};

// ─────────────────────────────────────────────
// 3. WISHLIST REMINDER EMAIL
// ─────────────────────────────────────────────
const sendWishlistReminderEmail = async (user, pg, changeType = 'update') => {
  try {
    if (!user || !pg) {
      console.error('❌ sendWishlistReminderEmail: user and pg are required');
      return false;
    }

    let changeMessage = '';
    let changeIcon = '🔔';
    let headerColor = '#3b82f6';

    switch (changeType) {
      case 'price_drop':
        changeMessage = '💰 Price Drop Alert! This PG just became more affordable.';
        changeIcon = '💰';
        headerColor = '#22c55e';
        break;
      case 'available':
        changeMessage = '🏠 Great News! This PG is now available for booking.';
        changeIcon = '🏠';
        headerColor = '#22c55e';
        break;
      case 'unavailable':
        changeMessage = '⚠️ Hurry! Rooms are filling up fast in this PG.';
        changeIcon = '⚠️';
        headerColor = '#f59e0b';
        break;
      default:
        changeMessage = '🔔 There are updates on a PG in your wishlist!';
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Wishlist Update - EasyToRent</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, ${headerColor}, ${headerColor}cc); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .pg-card { background: #f9f9f9; border-radius: 15px; padding: 20px; margin: 20px 0; }
          .pg-image { width: 100%; max-width: 300px; height: 180px; object-fit: cover; border-radius: 12px; }
          .pg-name { font-size: 20px; font-weight: bold; color: #1f2937; margin: 10px 0; }
          .pg-detail { color: #6b7280; font-size: 14px; margin: 5px 0; }
          .price { font-size: 24px; font-weight: bold; color: #f97316; }
          .button { display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 14px 35px; text-decoration: none; border-radius: 50px; font-weight: bold; margin-top: 20px; transition: transform 0.3s; }
          .button:hover { transform: scale(1.05); }
          .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="font-size: 48px; margin-bottom: 10px;">${changeIcon}</div>
            <h1>Wishlist Update</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">${changeMessage}</p>
          </div>
          
          <div class="content">
            <h2 style="text-align: center; color: #1f2937;">Hi ${user.name}! 👋</h2>
            <p style="text-align: center; font-size: 16px; color: #4b5563;">A PG in your wishlist has been updated:</p>
            
            <div class="pg-card">
              <div style="text-align: center;">
                <img src="${pg.images?.[0] || 'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=400'}" 
                     alt="${pg.name}" 
                     class="pg-image">
              </div>
              <div class="pg-name" style="text-align: center;">${pg.name}</div>
              <div class="pg-detail" style="text-align: center;">📍 ${pg.address}, ${pg.city}</div>
              <div class="pg-detail" style="text-align: center;">🏠 ${pg.type?.toUpperCase() || 'PG'}</div>
              <div class="price" style="text-align: center; margin-top: 10px;">₹${pg.price?.toLocaleString() || 'N/A'}/month</div>
              <div class="pg-detail" style="text-align: center; margin-top: 5px;">Status: <strong>${pg.availability === 'available' ? '✅ Available' : '⏳ Limited Availability'}</strong></div>
            </div>
            
            <div style="text-align: center;">
              <a href="https://easytorent.in/pg/${pg._id}" class="button">🔍 View Property & Book Now</a>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
              <a href="https://easytorent.in/wishlist" style="color: #3b82f6; text-decoration: none; font-size: 14px;">→ View My Wishlist</a>
            </div>
            
            <p style="text-align: center; font-size: 12px; color: #888; margin-top: 20px;">
              ⏰ Updates are based on the latest information from property owners.
            </p>
          </div>
          
          <div class="footer">
            <p>EasyToRent - Find your perfect PG accommodation</p>
            <p>📍 Chandigarh | Mohali | Panchkula | Zirakpur</p>
            <p>© ${new Date().getFullYear()} EasyToRent. All rights reserved.</p>
            <p style="font-size: 11px;">You received this because this PG is in your wishlist.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Wishlist Update - EasyToRent\n\nHi ${user.name},\n\n${changeMessage}\n\n${pg.name}\n📍 ${pg.address}, ${pg.city}\n💰 ₹${pg.price?.toLocaleString() || 'N/A'}/month\nStatus: ${pg.availability}\n\nView: https://easytorent.in/pg/${pg._id}\nWishlist: https://easytorent.in/wishlist`;

    const sent = await sendEmail({
      email: user.email,
      subject: `${changeIcon} Wishlist Update: ${pg.name} - EasyToRent`,
      html,
      text,
    });

    if (sent) {
      console.log(`✅ Wishlist reminder sent to ${user.email} for PG: ${pg.name}`);
    }
    return sent;
  } catch (error) {
    console.error('❌ sendWishlistReminderEmail error:', error.message);
    return false;
  }
};

module.exports = {
  sendLoginSuccessEmail,
  sendOfferEmail,
  sendWishlistReminderEmail,
};

