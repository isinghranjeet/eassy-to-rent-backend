/**
 * EasyToRent Email Template System
 * Production Ready - Advanced Edition
 * Version 2.0.0
 */

const BRAND_COLOR = '#f97316';
const BRAND_COLOR_DARK = '#ea580c';
const TEXT_PRIMARY = '#1f2937';
const TEXT_SECONDARY = '#6b7280';
const BG_BODY = '#f4f4f4';
const BG_CARD = '#ffffff';
const SUCCESS_COLOR = '#10b981';
const WARNING_COLOR = '#f59e0b';

/* =====================================================
   BASE TEMPLATE - Enhanced with better responsiveness
   and email client compatibility
===================================================== */
function buildBaseTemplate({ title, content, footer = '', previewText = '', headerLogo = '🏠 EasyToRent' }) {
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(title)}</title>
<!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  /* Email Client Reset */
  body, table, td, p, a {
    -webkit-text-size-adjust: 100%;
    -ms-text-size-adjust: 100%;
    mso-line-height-alt: 150%;
  }
  body {
    margin: 0;
    padding: 0;
    background-color: ${BG_BODY};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }
  .wrapper {
    width: 100%;
    padding: 20px 10px;
    background-color: ${BG_BODY};
  }
  .card {
    max-width: 600px;
    margin: 0 auto;
    background: ${BG_CARD};
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  }
  .header {
    background: linear-gradient(135deg, ${BRAND_COLOR}, ${BRAND_COLOR_DARK});
    padding: 32px 24px;
    text-align: center;
    color: #ffffff;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.3px;
  }
  .content {
    padding: 32px 28px;
    color: ${TEXT_PRIMARY};
    line-height: 1.5;
  }
  .footer {
    padding: 24px 20px;
    text-align: center;
    background: #fafafa;
    border-top: 1px solid #e5e7eb;
    color: ${TEXT_SECONDARY};
    font-size: 12px;
    line-height: 1.6;
  }
  .btn {
    display: inline-block;
    background: ${BRAND_COLOR};
    color: #ffffff !important;
    text-decoration: none;
    padding: 12px 28px;
    border-radius: 50px;
    font-weight: 600;
    font-size: 15px;
    text-align: center;
    transition: all 0.3s ease;
  }
  .btn-secondary {
    background: transparent;
    border: 2px solid ${BRAND_COLOR};
    color: ${BRAND_COLOR} !important;
  }
  @media only screen and (max-width: 600px) {
    .content {
      padding: 24px 20px;
    }
    .header {
      padding: 24px 16px;
      font-size: 22px;
    }
    .btn {
      display: block;
      width: 100%;
      box-sizing: border-box;
    }
  }
  @media only screen and (max-width: 480px) {
    .content {
      padding: 20px 16px;
    }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${BG_BODY};">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BG_BODY};">${previewText}</div>

<div class="wrapper">
  <div class="card">
    <div class="header">
      ${headerLogo}
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <strong>EasyToRent</strong> — Find your perfect PG<br/>
      📍 Chandigarh | Mohali | Panchkula | Zirakpur | Kharar<br/>
      ${footer ? `<br/>${footer}` : ''}
      <br/><br/>
      <span style="color:#9ca3af;">© ${year} EasyToRent. All rights reserved.</span><br/>
      <small><a href="#" style="color:${TEXT_SECONDARY};">Unsubscribe</a> | <a href="#" style="color:${TEXT_SECONDARY};">Privacy Policy</a></small>
    </div>
  </div>
</div>
</body>
</html>`;

  function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }
}

/* =====================================================
   REUSABLE BLOCKS - Enhanced Components
===================================================== */

/**
 * Primary CTA button
 */
function buttonBlock({ text, url, variant = 'primary' }) {
  const btnClass = variant === 'primary' ? 'btn' : 'btn btn-secondary';
  const bgColor = variant === 'primary' ? BRAND_COLOR : 'transparent';
  const border = variant === 'primary' ? 'none' : `2px solid ${BRAND_COLOR}`;
  const textColor = variant === 'primary' ? '#ffffff' : BRAND_COLOR;
  
  return `
  <div style="text-align:center;margin:28px 0 16px;">
    <a href="${url}" style="
      display:inline-block;
      background:${bgColor};
      color:${textColor};
      text-decoration:none;
      padding:13px 32px;
      border-radius:50px;
      font-weight:600;
      font-size:15px;
      border:${border};
      text-align:center;
    " class="${btnClass}">${text}</a>
  </div>
  `;
}

/**
 * OTP Display Block - Enhanced with better visual
 */
function otpBlock(otp, expiryMinutes = 10) {
  return `
  <div style="
    background: linear-gradient(135deg, #fff9f0 0%, #fff5e6 100%);
    border: 2px solid ${BRAND_COLOR}20;
    padding: 28px 20px;
    border-radius: 20px;
    text-align: center;
    margin: 28px 0;
  ">
    <div style="
      font-size: 42px;
      letter-spacing: 10px;
      font-weight: 800;
      color: ${BRAND_COLOR};
      font-family: 'Courier New', 'SF Mono', monospace;
      background: #ffffff;
      display: inline-block;
      padding: 12px 24px;
      border-radius: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    ">
      ${otp}
    </div>
    <p style="margin-top: 18px; color: ${TEXT_SECONDARY}; font-size: 13px;">
      ⏰ OTP valid for ${expiryMinutes} minutes • Never share this code
    </p>
  </div>
  `;
}

/**
 * PG Card - Enhanced with amenities and rating
 */
function pgCard(pg) {
  const rating = pg.rating || 4.5;
  const ratingStars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
  const amenitiesHtml = pg.amenities ? 
    `<div style="display:flex; flex-wrap:wrap; gap:6px; margin:12px 0;">
      ${pg.amenities.slice(0,3).map(amenity => `<span style="background:#f3f4f6; padding:4px 10px; border-radius:20px; font-size:11px; color:#4b5563;">${amenity}</span>`).join('')}
     </div>` : '';
  
  return `
  <div style="
    border: 1px solid #eef2f6;
    padding: 18px;
    border-radius: 18px;
    margin: 18px 0;
    background: #ffffff;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  ">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap;">
      <h3 style="margin:0 0 6px; font-size:18px; color:${TEXT_PRIMARY};">🏠 ${pg.name}</h3>
      <span style="color:#fbbf24; font-size:13px;">${ratingStars}</span>
    </div>
    <p style="margin:4px 0; color:${TEXT_SECONDARY}; font-size:14px;">📍 ${pg.address || pg.city || 'Location not specified'}</p>
    ${amenitiesHtml}
    <p style="margin:12px 0 0; font-weight:800; font-size:22px; color:${BRAND_COLOR};">
      ₹${Number(pg.price || 0).toLocaleString('en-IN')}<span style="font-size:13px; font-weight:normal;">/month</span>
    </p>
    ${pg.isVerified ? `<p style="margin:6px 0 0; color:${SUCCESS_COLOR}; font-size:12px;">✓ Verified Property</p>` : ''}
  </div>
  `;
}

/**
 * Info Banner - For alerts and promotions
 */
function infoBanner({ message, type = 'info' }) {
  const colors = {
    info: { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' },
    success: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
    warning: { bg: '#fed7aa', text: '#9a3412', border: '#fdba74' },
    error: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' }
  };
  const colorSet = colors[type] || colors.info;
  
  return `
  <div style="
    background: ${colorSet.bg};
    border-left: 4px solid ${colorSet.border};
    padding: 14px 18px;
    border-radius: 12px;
    margin: 20px 0;
    color: ${colorSet.text};
    font-size: 14px;
  ">
    ${message}
  </div>
  `;
}

/**
 * Price Comparison Block
 */
function priceComparisonBlock({ oldPrice, newPrice }) {
  const savings = oldPrice - newPrice;
  const savingsPercent = Math.round((savings / oldPrice) * 100);
  
  return `
  <div style="
    background: linear-gradient(135deg, #fef9e8 0%, #fff5e6 100%);
    border-radius: 20px;
    padding: 20px;
    text-align: center;
    margin: 24px 0;
  ">
    <span style="font-size: 14px; color: ${TEXT_SECONDARY}; text-decoration: line-through;">
      Was: ₹${oldPrice.toLocaleString('en-IN')}
    </span>
    <div style="font-size: 32px; font-weight: 800; color: ${SUCCESS_COLOR}; margin: 8px 0;">
      ₹${newPrice.toLocaleString('en-IN')}
      <span style="font-size: 14px; font-weight: normal;">/month</span>
    </div>
    <span style="background: ${SUCCESS_COLOR}; color: white; padding: 4px 12px; border-radius: 30px; font-size: 12px; font-weight: 600;">
      🔥 Save ${savingsPercent}% (₹${savings.toLocaleString('en-IN')})
    </span>
  </div>
  `;
}

/* =====================================================
   EMAIL TEMPLATES - Production Ready
===================================================== */

/**
 * OTP Verification Email
 */
function otpEmail({ otp, userName = '', email = '' }) {
  const content = `
    <h2 style="font-size:24px; margin-bottom:12px;">Hello ${escapeHtml(userName) || 'there'}! 👋</h2>
    <p style="font-size:16px; color:${TEXT_SECONDARY};">Use the verification code below to complete your login to <strong>EasyToRent</strong>.</p>
    ${otpBlock(otp, 10)}
    <p style="font-size:13px; color:${TEXT_SECONDARY}; text-align:center;">
      🔒 This is an automated message. If you didn't request this code, please ignore this email.
    </p>
  `;
  
  return {
    subject: `🔐 Your OTP Code - EasyToRent`,
    html: buildBaseTemplate({
      title: 'OTP Verification',
      previewText: `Your OTP code is ${otp} - Valid for 10 minutes`,
      content
    })
  };
}

/**
 * Welcome Email with onboarding steps
 */
function welcomeEmail({ userName = '', referralCode = 'WELCOME500' }) {
  const content = `
    <h2 style="font-size:26px;">Welcome to EasyToRent, ${escapeHtml(userName) || 'Renter'}! 🎉</h2>
    <p style="font-size:16px;">Your journey to finding the perfect PG starts now. Here's what you can do:</p>
    
    <div style="margin: 24px 0;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
        <span style="background:${BRAND_COLOR}20; width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold;">1</span>
        <span>🔍 Browse 500+ verified PGs in Tricity</span>
      </div>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
        <span style="background:${BRAND_COLOR}20; width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold;">2</span>
        <span>❤️ Save your favorite properties to wishlist</span>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <span style="background:${BRAND_COLOR}20; width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold;">3</span>
        <span>📅 Book directly and move in within 48 hours</span>
      </div>
    </div>
    
    ${infoBanner({ message: `🎁 Exclusive: Use code "${referralCode}" to get ₹500 off on your first booking!`, type: 'success' })}
    
    ${buttonBlock({ text: '✨ Start Exploring', url: 'https://easytorent.in/explore' })}
  `;
  
  return {
    subject: `🎉 Welcome to EasyToRent, ${userName || 'Renter'}!`,
    html: buildBaseTemplate({
      title: 'Welcome to EasyToRent',
      previewText: 'Your account is ready. Start finding your perfect PG today!',
      content
    })
  };
}

/**
 * Booking Confirmation Email
 */
function bookingConfirmationEmail({
  userName = '',
  pgName = 'Your Property',
  duration = 1,
  totalAmount = 0,
  checkInDate = 'As per agreement',
  bookingId = `ETR${Math.floor(Math.random() * 10000)}`,
  moveInInstructions = ''
}) {
  const content = `
    <div style="text-align:center; margin-bottom:16px;">
      <span style="background:${SUCCESS_COLOR}20; color:${SUCCESS_COLOR}; padding:6px 16px; border-radius:40px; font-size:13px; font-weight:600;">✓ BOOKING CONFIRMED</span>
    </div>
    
    <h2 style="text-align:center; margin-top:0;">Congratulations, ${escapeHtml(userName)}! 🎊</h2>
    <p>Your booking at <strong>${escapeHtml(pgName)}</strong> has been confirmed. Here are the details:</p>
    
    <table width="100%" cellpadding="12" style="background:#f8fafc; border-radius:20px; margin:24px 0; border-collapse:collapse;">
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="color:${TEXT_SECONDARY};">Booking ID</td>
        <td align="right"><strong>${bookingId}</strong></td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="color:${TEXT_SECONDARY};">Property</td>
        <td align="right"><strong>${escapeHtml(pgName)}</strong></td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="color:${TEXT_SECONDARY};">Duration</td>
        <td align="right"><strong>${duration} month${duration > 1 ? 's' : ''}</strong></td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="color:${TEXT_SECONDARY};">Check-in Date</td>
        <td align="right"><strong>${checkInDate}</strong></td>
      </tr>
      <tr>
        <td style="color:${TEXT_SECONDARY};">Total Amount</td>
        <td align="right"><strong style="color:${BRAND_COLOR}; font-size:20px;">₹${Number(totalAmount).toLocaleString('en-IN')}</strong></td>
      </tr>
    </table>
    
    ${moveInInstructions ? infoBanner({ message: moveInInstructions, type: 'info' }) : ''}
    
    ${buttonBlock({ text: '📄 View Booking Details', url: `https://easytorent.in/bookings/${bookingId}` })}
    
    <p style="font-size:13px; text-align:center; color:${TEXT_SECONDARY}; margin-top:20px;">
      Need help? Contact us at <a href="mailto:support@easytorent.in" style="color:${BRAND_COLOR};">support@easytorent.in</a>
    </p>
  `;
  
  return {
    subject: `✅ Booking Confirmed! Your stay at ${pgName} is ready`,
    html: buildBaseTemplate({
      title: 'Booking Confirmed',
      previewText: `Your booking at ${pgName} is confirmed. Booking ID: ${bookingId}`,
      content
    })
  };
}

/**
 * Wishlist Reminder Email
 */
function wishlistReminderEmail({ userName = '', items = [] }) {
  const cards = items.length ? items.map(pg => pgCard(pg)).join('') : '<p style="text-align:center; color:#9ca3af;">✨ Your wishlist is empty. Start exploring properties!</p>';
  
  const content = `
    <h2>Hey ${escapeHtml(userName) || 'there'}! 👋</h2>
    <p>You have <strong style="color:${BRAND_COLOR};">${items.length} saved propert${items.length === 1 ? 'y' : 'ies'}</strong> waiting for you. Don't miss out on these great options!</p>
    
    ${cards}
    
    ${items.length ? buttonBlock({ text: '❤️ View My Wishlist', url: 'https://easytorent.in/wishlist' }) : ''}
    
    ${infoBanner({ message: '🔥 Properties get booked quickly. Secure your favorite PG today!', type: 'warning' })}
  `;
  
  return {
    subject: `❤️ You have ${items.length} saved PG${items.length !== 1 ? 's' : ''} waiting!`,
    html: buildBaseTemplate({
      title: 'Wishlist Reminder',
      previewText: `You have ${items.length} properties saved in your wishlist`,
      content
    })
  };
}

/**
 * Offer/Promotion Email
 */
function offerEmail({ userName = '', message = '', discountCode = 'SAVE20', expiryDate = 'May 30, 2026' }) {
  const content = `
    <h2>🎁 Special Offer, ${escapeHtml(userName) || 'Renter'}!</h2>
    <p style="font-size:16px;">${message || 'Get an exclusive discount on your next booking with EasyToRent.'}</p>
    
    <div style="
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border-radius: 24px;
      padding: 28px 20px;
      text-align: center;
      margin: 28px 0;
    ">
      <div style="color: #fcd34d; font-size: 12px; letter-spacing: 2px; margin-bottom: 8px;">USE CODE</div>
      <div style="
        font-family: 'Courier New', monospace;
        font-size: 36px;
        font-weight: 800;
        letter-spacing: 6px;
        background: #ffffff;
        display: inline-block;
        padding: 12px 28px;
        border-radius: 50px;
        color: ${BRAND_COLOR};
      ">
        ${discountCode}
      </div>
      <p style="color: #94a3b8; margin-top: 16px; font-size: 13px;">
        ⏰ Valid until ${expiryDate}
      </p>
    </div>
    
    ${buttonBlock({ text: 'Claim Offer Now →', url: 'https://easytorent.in/offers' })}
    
    <p style="font-size:12px; text-align:center; color:#9ca3af;">*T&C apply. Limited period offer.</p>
  `;
  
  return {
    subject: `🎁 Exclusive Offer: ${discountCode} - Save Big on PG Rentals!`,
    html: buildBaseTemplate({
      title: 'Special Offer',
      previewText: `${discountCode} - Limited time offer just for you!`,
      content
    })
  };
}

/**
 * Price Drop Alert Email
 */
function priceDropEmail({ userName = '', pg = {}, oldPrice = 0, newPrice = 0 }) {
  const enhancedPG = {
    ...pg,
    price: newPrice,
    isVerified: pg.isVerified !== undefined ? pg.isVerified : true
  };
  
  const content = `
    <h2>💰 Price Drop Alert!</h2>
    <p>Hi ${escapeHtml(userName) || 'smart saver'}, good news! One of your watched properties just got cheaper.</p>
    
    ${pgCard(enhancedPG)}
    
    ${priceComparisonBlock({ oldPrice, newPrice })}
    
    ${buttonBlock({ text: '⚡ Book Now at Lower Price', url: `https://easytorent.in/property/${pg.id || 'featured'}` })}
    
    <p style="font-size:13px; text-align:center; color:${TEXT_SECONDARY};">This offer won't last long. Prices may change anytime.</p>
  `;
  
  return {
    subject: `💰 Price Drop! ${pg.name || 'A PG'} is now ₹${newPrice.toLocaleString('en-IN')}`,
    html: buildBaseTemplate({
      title: 'Price Drop Alert',
      previewText: `Price reduced from ₹${oldPrice.toLocaleString('en-IN')} to ₹${newPrice.toLocaleString('en-IN')}`,
      content
    })
  };
}

/**
 * Payment Receipt Email
 */
function paymentReceiptEmail({ userName = '', amount = 0, paymentId = '', bookingId = '', date = new Date().toLocaleDateString() }) {
  const content = `
    <div style="text-align:center; margin-bottom:16px;">
      <span style="background:${SUCCESS_COLOR}20; color:${SUCCESS_COLOR}; padding:6px 16px; border-radius:40px; font-size:13px; font-weight:600;">✓ PAYMENT RECEIVED</span>
    </div>
    
    <h2 style="text-align:center;">Thank you for your payment, ${escapeHtml(userName)}! 🎉</h2>
    <p style="text-align:center;">Your payment has been successfully processed.</p>
    
    <table width="100%" cellpadding="12" style="background:#f8fafc; border-radius:20px; margin:24px 0;">
      <tr><td style="color:${TEXT_SECONDARY};">Payment ID</td><td align="right"><strong>${paymentId}</strong></td></tr>
      <tr><td style="color:${TEXT_SECONDARY};">Booking ID</td><td align="right"><strong>${bookingId}</strong></td></tr>
      <tr><td style="color:${TEXT_SECONDARY};">Date</td><td align="right"><strong>${date}</strong></td></tr>
      <tr><td style="color:${TEXT_SECONDARY};">Amount</td><td align="right"><strong style="color:${BRAND_COLOR}; font-size:22px;">₹${Number(amount).toLocaleString('en-IN')}</strong></td></tr>
    </table>
    
    ${buttonBlock({ text: '📥 Download Receipt', url: `https://easytorent.in/receipt/${paymentId}` })}
  `;
  
  return {
    subject: `🧾 Payment Receipt - EasyToRent (${paymentId})`,
    html: buildBaseTemplate({
      title: 'Payment Receipt',
      previewText: `Payment of ₹${amount.toLocaleString('en-IN')} received successfully`,
      content
    })
  };
}

/* Helper function for escaping */
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

/* =====================================================
   EXPORTS - CommonJS and ESM compatible
===================================================== */

// For CommonJS (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Core functions
    buildBaseTemplate,
    buttonBlock,
    otpBlock,
    pgCard,
    infoBanner,
    priceComparisonBlock,
    // Email templates
    otpEmail,
    welcomeEmail,
    bookingConfirmationEmail,
    wishlistReminderEmail,
    offerEmail,
    priceDropEmail,
    paymentReceiptEmail,
    // Constants
    BRAND_COLOR,
    BRAND_COLOR_DARK,
    TEXT_PRIMARY,
    TEXT_SECONDARY,
    BG_BODY,
    BG_CARD
  };
}

// For ES modules
export {
  buildBaseTemplate,
  buttonBlock,
  otpBlock,
  pgCard,
  infoBanner,
  priceComparisonBlock,
  otpEmail,
  welcomeEmail,
  bookingConfirmationEmail,
  wishlistReminderEmail,
  offerEmail,
  priceDropEmail,
  paymentReceiptEmail,
  BRAND_COLOR,
  BRAND_COLOR_DARK,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  BG_BODY,
  BG_CARD
};