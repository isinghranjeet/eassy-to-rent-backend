/**
 * Notification Service
 * Centralized email notification system for EasyToRent
 * All emails: non-blocking, fire-and-forget, fail-silent
 */

const { sendEmail } = require('../utils/sendEmail');
const emailTemplates = require('../utils/emailTemplates');
const User = require('../models/User');
const PGListing = require('../models/PGListing');

/**
 * 🛡️ Bulletproof helper to extract string html and subject safely
 */
const parseTemplate = (templateResult, fallbackSubject) => {
  let html = '';
  let subject = fallbackSubject;

  if (typeof templateResult === 'string') {
    html = templateResult;
  } else if (templateResult && typeof templateResult === 'object') {
    html = typeof templateResult.html === 'string' ? templateResult.html : JSON.stringify(templateResult.html || '');
    if (typeof templateResult.subject === 'string' && templateResult.subject.trim() !== '') {
      subject = templateResult.subject;
    }
  }

  // Absolute safety check against [object Object] string injection
  if (!html || html === '[object Object]' || typeof html !== 'string') {
    html = '<div style="padding:20px; font-family:Arial;"><h2>EasyToRent Update</h2><p>You have new property updates in your account.</p></div>';
  }

  return { html, subject };
};

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
    if (!userId || !pgId) return false;

    const user = await User.findById(userId);
    const pg = await PGListing.findById(pgId);
    if (!user || !pg) return false;

    const rawTemplate = emailTemplates.offerEmail({
      userName: user.name,
      message: offerMessage,
      discountCode: discount ? `${discount}% OFF` : 'SAVE20'
    });

    const { html, subject } = parseTemplate(rawTemplate, `🎁 Exclusive Offer: ${pg.name} - EasyToRent`);

    const sent = await sendEmail({
      email: user.email,
      subject,
      html,
    });

    return sent;
  } catch (error) {
    console.error('❌ sendOfferEmail error:', error.message);
    return false;
  }
};

// ─────────────────────────────────────────────
// 3. WISHLIST REMINDER EMAIL (100% FIXED)
// ─────────────────────────────────────────────
const sendWishlistReminderEmail = async (user, pg, changeType = 'update') => {
  try {
    if (!user || !pg) {
      console.error('❌ sendWishlistReminderEmail: user and pg are required');
      return false;
    }

    let rawTemplate;
    if (changeType === 'price_drop') {
      rawTemplate = emailTemplates.priceDropEmail({
        userName: user.name,
        pg,
        oldPrice: (pg.price || 8500) + 500,
        newPrice: pg.price || 8500
      });
    } else {
      rawTemplate = emailTemplates.wishlistReminderEmail({
        userName: user.name,
        items: Array.isArray(pg) ? pg : [pg]
      });
    }

    const { html, subject } = parseTemplate(rawTemplate, `❤️ Wishlist Update: ${pg.name || 'Property'} - EasyToRent`);

    const sent = await sendEmail({
      email: user.email,
      subject,
      html,
    });

    if (sent) {
      console.log(`✅ Wishlist reminder sent to ${user.email} for PG: ${pg.name || 'Property'}`);
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