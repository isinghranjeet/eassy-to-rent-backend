// backend/utils/sendEmail.js
const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Gmail App Password Required - https://myaccount.google.com/apppasswords
if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
  console.error('🚨 EMAIL CONFIG MISSING: Add SMTP_EMAIL & SMTP_PASSWORD to .env');
}

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Connection FAILED:', {
      code: error.code,
      message: error.message,
      response: error.response?.message,
      stack: error.stack
    });
  } else {
    console.log('✅ SMTP Connected Successfully');
  }
});

// Shared email styles (modern glassmorphism design)
const getEmailStyles = () => `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: radial-gradient(circle at 20% 30%, #0f1923 0%, #0a0f14 100%);
      line-height: 1.6;
      padding: 20px;
    }
    
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 32px;
      overflow: hidden;
      box-shadow: 0 30px 40px -20px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.05);
      animation: slideUp 0.5s ease-out;
    }
    
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .header {
      padding: 40px 30px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    
    .header h1 {
      font-size: 32px;
      margin-bottom: 8px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    
    .header p {
      font-size: 15px;
      opacity: 0.9;
    }
    
    .content {
      padding: 40px 30px;
      background: #ffffff;
    }
    
    .button {
      display: inline-block;
      background: linear-gradient(105deg, #FF7A2F, #EA580C);
      color: white !important;
      padding: 14px 35px;
      text-decoration: none;
      border-radius: 60px;
      font-weight: 600;
      font-size: 15px;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      text-align: center;
      cursor: pointer;
    }
    
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.15);
    }
    
    .feature-card {
      background: linear-gradient(135deg, #F8FAFE 0%, #F1F5F9 100%);
      padding: 20px;
      border-radius: 20px;
      margin: 20px 0;
    }
    
    .price-tag {
      background: linear-gradient(105deg, #10b981, #059669);
      color: white;
      padding: 4px 12px;
      border-radius: 50px;
      display: inline-block;
      font-size: 13px;
      font-weight: 600;
    }
    
    .urgent-badge {
      background: #FEF3C7;
      border-left: 4px solid #F59E0B;
      padding: 15px;
      border-radius: 12px;
      margin: 20px 0;
    }
    
    .footer {
      background: #F9FAFB;

      text-align: center;
      font-size: 12px;
      color: #6B7280;
      border-top: 1px solid #E5E7EB;
    }
    
    .otp-box {
      background: linear-gradient(135deg, #F8FAFE 0%, #F1F5F9 100%);
      border-radius: 28px;
      text-align: center;
      padding: 25px;
      margin: 24px 0;
    }
    
    .otp-code {
      font-size: 48px;
      font-weight: 700;
      letter-spacing: 12px;
      background: linear-gradient(135deg, #FF7A2F, #EA580C);
      background-clip: text;
      -webkit-background-clip: text;
      color: transparent;
    }
    
    .price-comparison {
      background: #F8FAFE;
      border-radius: 20px;
      padding: 20px;
      text-align: center;
      margin: 20px 0;
    }
    
    .old-price {
      text-decoration: line-through;
      color: #94A3B8;
      font-size: 16px;
    }
    
    .new-price {
      font-size: 36px;
      font-weight: 800;
      color: #22C55E;
      margin: 8px 0;
    }
    
    .savings-chip {
      background: #DCFCE7;
      color: #15803D;
      border-radius: 40px;
      padding: 6px 16px;
      font-size: 13px;
      font-weight: 600;
      display: inline-block;
    }
    
    .wishlist-item {
      background: #F9FAFB;
      border-radius: 16px;
      padding: 15px;
      margin-bottom: 12px;
      transition: transform 0.2s;
    }
    
    .property-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #E5E7EB;
    }
    
    .property-row:last-child {
      border-bottom: none;
    }
    
    .discount-badge {
      display: inline-block;
      background: #FEF3C7;
      color: #92400E;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 8px;
    }
    
    @media (max-width: 600px) {
      .content {
        padding: 30px 20px;
      }
      .header h1 {
        font-size: 24px;
      }
      .otp-code {
        font-size: 32px;
        letter-spacing: 6px;
      }
      .new-price {
        font-size: 28px;
      }
    }
  </style>
`;

// Main sendEmail function
const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: `"EasyToRent" <${process.env.SMTP_EMAIL}>`,
      to: options.email,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${options.email}: ${info.messageId}`);
    logger.info(`✅ Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Send Email FAILED to', options.email, {
      code: error.code,
      message: error.message,
      response: error.response,
      stack: error.stack?.split('\\n')[0]
    });
    logger.error(`Send Email error for ${options.email}: ${error.message}`, { error });
    return false;
  }
};

// Send OTP Email (Enhanced UI)
const sendOtpEmail = async (email, otp) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email - EasyToRent</title>
      ${getEmailStyles()}
    </head>
    <body>
      <div class="email-wrapper">
        <div class="header" style="background: linear-gradient(105deg, #FF7A2F, #EA580C); color: white;">
          <h1>🔐 Verify Your Access</h1>
          <p>Secure one-time passcode</p>
        </div>
        
        <div class="content">
          <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 12px;">Hello there! 👋</h2>
          <p style="color: #475569; margin-bottom: 20px;">Please use the following verification code to complete your sign-in. This code expires in <strong>10 minutes</strong>.</p>
          
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div style="font-size: 13px; margin-top: 12px; color: #6B7280;">⏱️ Valid for 10 minutes · Do not share</div>
          </div>
          
          <div class="feature-card">
            <div style="font-size: 14px; color: #9B2C0C;">
              🔒 <strong>Security Tip:</strong> EasyToRent will never ask for this code outside the login page. Keep it confidential.
            </div>
          </div>
          
          <p style="color: #6B7280; font-size: 13px; margin-top: 20px;">If you didn't request this, please ignore this email. Your account remains secure.</p>
        </div>
        
        <div class="footer">
          <p>EasyToRent - Find your perfect PG accommodation</p>
          <p>📍 Chandigarh | Mohali | Panchkula | Zirakpur</p>
          <p>Need help? <a href="mailto:support@easytorent.in" style="color: #FF7A2F;">Contact Support</a></p>
          <p>© 2025 EasyToRent. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email,
    subject: '🔐 Your OTP Verification Code - EasyToRent',
    html,
  });
};

// Send Wishlist Reminder (Enhanced)
const sendWishlistReminder = async (user, wishlistItems) => {
  const itemsList = wishlistItems.map((item, index) => `
    <div class="property-row">
      <div>
        <strong style="color: #1F2937;">${item.pg.name}</strong>
        <div style="font-size: 12px; color: #6B7280; margin-top: 2px;">📍 ${item.pg.address}</div>
      </div>
      <div style="color: #FF7A2F; font-weight: 700;">₹${item.pg.price.toLocaleString()}<span style="font-size: 12px;">/mo</span></div>
    </div>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Wishlist - EasyToRent</title>
      ${getEmailStyles()}
    </head>
    <body>
      <div class="email-wrapper">
        <div class="header" style="background: linear-gradient(105deg, #C241FF, #9333EA); color: white;">
          <h1>❤️ Your Wishlist Awaits!</h1>
          <p>Don't miss out on your favorite properties</p>
        </div>
        
        <div class="content">
          <h2 style="font-size: 22px; font-weight: 600; margin-bottom: 8px;">Hi ${user.name} 👋</h2>
          <p>You have <strong style="color: #C241FF;">${wishlistItems.length}</strong> propert${wishlistItems.length === 1 ? 'y' : 'ies'} waiting for you in your wishlist!</p>
          
          <div style="background: #F9FAFB; border-radius: 20px; padding: 16px; margin: 24px 0;">
            ${itemsList}
          </div>
          
          <div class="urgent-badge">
            <strong>🔥 Hot Deal:</strong> Properties in wishlists get booked 3x faster! Book within 24 hours and get 10% off on your first month.
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://easytorent.in/wishlist" class="button">View My Wishlist →</a>
          </div>
          
          <p style="font-size: 13px; color: #6B7280;">💡 <strong>Pro Tip:</strong> Enable price alerts to get notified when your saved PGs go on sale.</p>
        </div>
        
        <div class="footer">
          <p>EasyToRent - Find your perfect PG accommodation</p>
          <p>© 2025 EasyToRent. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email: user.email,
    subject: `❤️ ${wishlistItems.length} propert${wishlistItems.length === 1 ? 'y is' : 'ies are'} waiting for you!`,
    html,
  });
};

// Send Booking Confirmation (Enhanced)
const sendBookingConfirmation = async (user, bookingDetails) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmed - EasyToRent</title>
      ${getEmailStyles()}
    </head>
    <body>
      <div class="email-wrapper">
        <div class="header" style="background: linear-gradient(105deg, #22C55E, #15803D); color: white;">
          <h1>🎉 Booking Confirmed!</h1>
          <p>Welcome to your new home 🏡</p>
        </div>
        
        <div class="content">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
            <span style="font-size: 40px;">✅</span>
            <h2 style="font-size: 24px; font-weight: 600;">Congratulations ${user.name}! 🎊</h2>
          </div>
          
          <p>Your booking has been successfully confirmed. Here are your booking details:</p>
          
          <div class="feature-card">
            <div style="margin-bottom: 15px;">
              <strong>🏠 Property:</strong> ${bookingDetails.pgName}
            </div>
            <div style="margin-bottom: 15px;">
              <strong>📅 Duration:</strong> ${bookingDetails.duration} months
            </div>
            <div style="margin-bottom: 15px;">
              <strong>💰 Total Amount:</strong> 
              <span style="color: #22C55E; font-size: 28px; font-weight: 700;">₹${bookingDetails.totalAmount.toLocaleString()}</span>
            </div>
            <div>
              <strong>📞 Owner Contact:</strong> Available in your dashboard
            </div>
          </div>
          
          <div class="urgent-badge">
            <strong>📋 Next Steps:</strong>
            <ul style="margin-top: 10px; margin-left: 20px;">
              <li>✓ Complete your profile for better service</li>
              <li>✓ Connect with property owner</li>
              <li>✓ Schedule a visit or move-in date</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://easytorent.in/dashboard" class="button">Go to Dashboard →</a>
          </div>
        </div>
        
        <div class="footer">
          <p>Have questions? We're here to help 24/7</p>
          <p><a href="mailto:support@easytorent.in" style="color: #22C55E;">support@easytorent.in</a> | +91 12345 67890</p>
          <p>© 2025 EasyToRent. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email: user.email,
    subject: '🎉 Booking Confirmed! Welcome to EasyToRent',
    html,
  });
};

// Send Offer Email (Enhanced)
const sendOfferEmail = async (userEmail, userName, customMessage, discountCode) => {
  const message = customMessage && customMessage.trim()
    ? customMessage.trim().replace(/\n/g, '<br>')
    : "Book your dream PG today and get a special discount!";
  
  const discount = discountCode && discountCode.trim()
    ? discountCode.trim()
    : '25% OFF';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Special Offer - EasyToRent</title>
      ${getEmailStyles()}
    </head>
    <body>
      <div class="email-wrapper">
        <div class="header" style="background: linear-gradient(105deg, #FFB347, #FF6B6B); color: white;">
          <h1>🎁 EXCLUSIVE OFFER</h1>
          <p>Limited time deal just for you</p>
          <div class="discount-badge" style="background: rgba(255,255,255,0.2); color: white;">🔥 FLASH SALE 🔥</div>
        </div>
        
        <div class="content">
          <h2 style="text-align: center; font-size: 28px; font-weight: 700; margin-bottom: 20px;">Hey ${userName || 'there'}! 👋</h2>
          
          <div class="feature-card">
            ${message}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="font-size: 56px; font-weight: 800; background: linear-gradient(135deg, #FF7A2F, #EA580C); background-clip: text; -webkit-background-clip: text; color: transparent;">${discount}</div>
            <p style="margin-top: 10px;">Use code: <strong style="background: #FEF3C7; padding: 6px 16px; border-radius: 40px; font-size: 16px;">${discount}</strong></p>
          </div>
          
          <div style="background: linear-gradient(135deg, #F8FAFE 0%, #F1F5F9 100%); border-radius: 20px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-bottom: 15px;">✨ What You Get:</h3>
            <p>✅ Verified Properties - 100% genuine listings</p>
            <p>✅ Free WiFi & Food Options Available</p>
            <p>✅ 24/7 Security with CCTV Surveillance</p>
            <p>✅ No Brokerage - Direct Owner Contact</p>
            <p>✅ Easy Online Booking Process</p>
          </div>
          
          <div style="text-align: center;">
            <a href="https://easytorent.in/pg" class="button">Claim Your Discount →</a>
          </div>
          
          <div class="urgent-badge" style="margin-top: 30px;">
            ⏰ <strong>Limited Time Offer!</strong> Valid for next 48 hours only • Limited slots available
          </div>
        </div>
        
        <div class="footer">
          <p>EasyToRent - Find your perfect PG accommodation</p>
          <p>📍 Chandigarh | Mohali | Panchkula | Zirakpur</p>
          <p>© 2025 EasyToRent. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email: userEmail,
    subject: `🎁 ${discount} OFF - Exclusive Deal Just for You!`,
    html,
  });
};

// Send Price Drop Alert (Enhanced)
const sendPriceDropAlert = async (user, pg, oldPrice, newPrice) => {
  const savings = oldPrice - newPrice;
  const discountPercent = Math.round((savings / oldPrice) * 100);
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Price Drop Alert - EasyToRent</title>
      ${getEmailStyles()}
    </head>
    <body>
      <div class="email-wrapper">
        <div class="header" style="background: linear-gradient(105deg, #2563EB, #1E40AF); color: white;">
          <h1>💰 Price Just Dropped!</h1>
          <p>Save big on your favorite property</p>
        </div>
        
        <div class="content">
          <h2 style="font-size: 22px; font-weight: 600; margin-bottom: 8px;">Great news ${user.name}! 🎉</h2>
          <p>The PG you've been watching just got cheaper. Here's what you'll save:</p>
          
          <div class="price-comparison">
            <div style="margin-bottom: 15px;">
              <h3 style="font-size: 18px; margin-bottom: 5px;">${pg.name}</h3>
              <p style="color: #6B7280; font-size: 13px;">📍 ${pg.address}</p>
            </div>
            
            <div>
              <span class="old-price">₹${oldPrice.toLocaleString()}/month</span>
              <span style="font-size: 28px; margin: 0 10px;">→</span>
              <span class="new-price">₹${newPrice.toLocaleString()}/month</span>
            </div>
            
            <div style="margin-top: 15px;">
              <span class="savings-chip">Save ₹${savings.toLocaleString()}/month (${discountPercent}% OFF)</span>
            </div>
          </div>
          
          <div class="feature-card">
            <div>✅ <strong>Verified Property</strong> - 100% genuine listing</div>
            <div style="margin-top: 10px;">✅ <strong>No Brokerage</strong> - Direct owner contact</div>
            <div style="margin-top: 10px;">✅ <strong>Easy Booking</strong> - Just a few clicks</div>
          </div>
          
          <div class="urgent-badge">
            <strong>⏰ Limited Time Offer!</strong> This discounted price won't last long. Properties at this price get booked within 24 hours!
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://easytorent.in/pg/${pg._id}" class="button">View & Book Now →</a>
          </div>
          
          <p style="font-size: 13px; color: #6B7280;">💡 <strong>Pro Tip:</strong> Book now to secure this discounted rate before it's gone!</p>
        </div>
        
        <div class="footer">
          <p>You received this email because you set a price alert for this PG.</p>
          <p><a href="https://easytorent.in/price-alerts" style="color: #2563EB;">Manage Price Alerts</a> | <a href="https://easytorent.in/unsubscribe" style="color: #6B7280;">Unsubscribe</a></p>
          <p>© 2025 EasyToRent. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Price Drop Alert!\n\nPG: ${pg.name}\nAddress: ${pg.address}\nOld Price: ₹${oldPrice.toLocaleString()}/month\nNew Price: ₹${newPrice.toLocaleString()}/month\nYou save: ₹${savings.toLocaleString()}/month (${discountPercent}% OFF)\n\nView Property: https://easytorent.in/pg/${pg._id}`;

  return await sendEmail({
    email: user.email,
    subject: `💰 Price Drop Alert! Save ₹${savings.toLocaleString()}/month on ${pg.name}`,
    html,
    text
  });
};

// Send Welcome Email (New - Enhanced)
const sendWelcomeEmail = async (user) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to EasyToRent!</title>
      ${getEmailStyles()}
    </head>
    <body>
      <div class="email-wrapper">
        <div class="header" style="background: linear-gradient(105deg, #4F46E5, #7C3AED); color: white;">
          <h1>🏠 Welcome to EasyToRent!</h1>
          <p>Your home search just got smarter</p>
        </div>
        
        <div class="content">
          <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 12px;">Welcome aboard, ${user.name}! 🚀</h2>
          <p>We're thrilled to have you join our community of happy tenants and property owners.</p>
          
          <div style="margin: 30px 0;">
            <h3 style="margin-bottom: 15px;">✨ Here's what you can do next:</h3>
            <div class="feature-card">
              <p>🔍 <strong>Browse Properties</strong> - Explore 500+ verified PGs in your area</p>
              <p style="margin-top: 12px;">❤️ <strong>Save Favorites</strong> - Create wishlists and get price alerts</p>
              <p style="margin-top: 12px;">📅 <strong>Book Instantly</strong> - Hassle-free booking process</p>
              <p style="margin-top: 12px;">⭐ <strong>Leave Reviews</strong> - Share your experience with others</p>
            </div>
          </div>
          
          <div style="text-align: center;">
            <a href="https://easytorent.in/pg" class="button">Start Exploring →</a>
          </div>
          
          <div class="urgent-badge" style="margin-top: 30px;">
            <strong>🎁 Welcome Bonus:</strong> Complete your profile and get ₹500 off on your first booking!
          </div>
        </div>
        
        <div class="footer">
          <p>Need help getting started? <a href="mailto:support@easytorent.in" style="color: #4F46E5;">Contact our support team</a></p>
          <p>© 2025 EasyToRent. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email: user.email,
    subject: '🏠 Welcome to EasyToRent! Start Your Home Search Today',
    html,
  });
};

// Send Test Email
const sendTestEmail = async (userEmail, userName) => {
  return await sendOfferEmail(userEmail, userName);
};

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendWishlistReminder,
  sendBookingConfirmation,
  sendTestEmail,
  sendOfferEmail,
  sendPriceDropAlert,
  sendWelcomeEmail
};