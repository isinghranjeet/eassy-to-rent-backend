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

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Connection Error:', error);
  } else {
    console.log('✅ SMTP Connected Successfully');
  }
});

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
    console.log(`✅ Email sent: ${info.messageId}`);
    logger.info(`✅ Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Send Email Error:', error);
    logger.error(`❌ Send Email error: ${error.message}`);
    return false;
  }
};

// Send OTP Email
const sendOtpEmail = async (email, otp) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f97316; color: white; padding: 20px; text-align: center; }
        .otp { font-size: 32px; font-weight: bold; color: #f97316; text-align: center; margin: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>EasyToRent</h1>
        </div>
        <h2>Your OTP Verification Code</h2>
        <p>Please use the following OTP to complete your login:</p>
        <div class="otp">${otp}</div>
        <p>This OTP is valid for 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email,
    subject: 'Your OTP Verification Code - EasyToRent',
    html,
  });
};

// Send Wishlist Reminder
const sendWishlistReminder = async (user, wishlistItems) => {
  const itemsList = wishlistItems.map(item => `
    <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #eee; border-radius: 8px;">
      <h3 style="margin: 0 0 5px 0;">${item.pg.name}</h3>
      <p style="margin: 0; color: #666;">📍 ${item.pg.address}</p>
      <p style="margin: 5px 0 0 0; color: #f97316; font-weight: bold;">₹${item.pg.price}/month</p>
    </div>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f97316; color: white; padding: 20px; text-align: center; }
        .button { background: #f97316; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏠 Don't Miss Out!</h1>
        </div>
        <h2>Hi ${user.name} 👋</h2>
        <p>You have <strong>${wishlistItems.length}</strong> propert${wishlistItems.length === 1 ? 'y' : 'ies'} saved in your wishlist.</p>
        <div>${itemsList}</div>
        <div style="text-align: center; margin-top: 30px;">
          <a href="https://easytorent.in/wishlist" class="button">View Wishlist</a>
        </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email: user.email,
    subject: '🏠 Don\'t miss your saved PGs!',
    html,
  });
};

// Send Booking Confirmation
const sendBookingConfirmation = async (user, bookingDetails) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #22c55e; color: white; padding: 20px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Booking Confirmed!</h1>
        </div>
        <h2>Hi ${user.name} 👋</h2>
        <p>Your booking has been confirmed!</p>
        <p><strong>PG:</strong> ${bookingDetails.pgName}</p>
        <p><strong>Duration:</strong> ${bookingDetails.duration} months</p>
        <p><strong>Total:</strong> ₹${bookingDetails.totalAmount}</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email: user.email,
    subject: '✅ Booking Confirmed - EasyToRent',
    html,
  });
};

// Send Offer Email (Special Discount)
// Supports custom message and discount code for bulk admin campaigns
const sendOfferEmail = async (userEmail, userName, customMessage, discountCode) => {
  const message = customMessage && customMessage.trim()
    ? customMessage.trim().replace(/\n/g, '<br>')
    : "Book your dream PG today and get a special discount!";

  const discount = discountCode && discountCode.trim()
    ? discountCode.trim()
    : '20% OFF';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Special Offer</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .offer-badge { background: #ffd700; color: #333; padding: 8px 16px; border-radius: 50px; display: inline-block; font-weight: bold; margin-top: 15px; }
        .content { padding: 40px 30px; }
        .discount { font-size: 48px; font-weight: bold; color: #f97316; text-align: center; margin: 20px 0; }
        .message-box { background: #fff7ed; border-left: 4px solid #f97316; padding: 20px; border-radius: 8px; margin: 20px 0; font-size: 16px; color: #7c2d12; }
        .features { background: #f9f9f9; padding: 20px; border-radius: 15px; margin: 20px 0; }
        .feature { padding: 8px 0; border-bottom: 1px solid #eee; }
        .feature:last-child { border-bottom: none; }
        .button { display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 14px 35px; text-decoration: none; border-radius: 50px; font-weight: bold; margin-top: 20px; transition: transform 0.3s; }
        .button:hover { transform: scale(1.05); }
        .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .expiry { color: #e53e3e; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 EasyToRent</h1>
          <p>Exclusive Offer Just For You!</p>
          <div class="offer-badge">🔥 LIMITED TIME OFFER 🔥</div>
        
        <div class="content">
          <h2 style="text-align: center;">Hi ${userName || 'there'}! 👋</h2>
          
          <div class="message-box">
            ${message}
          </div>
          
          <div class="discount">
            ${discount}
          </div>
          <p style="text-align: center; font-size: 16px; color: #4b5563;">Use this exclusive code when booking!</p>
          
          <div class="features">
            <div class="feature">✅ <strong>Verified Properties</strong> - 100% genuine listings</div>
            <div class="feature">✅ <strong>Free WiFi & Food Options</strong> - Choose as per your need</div>
            <div class="feature">✅ <strong>24/7 Security</strong> - CCTV & Guard available</div>
            <div class="feature">✅ <strong>No Brokerage</strong> - Direct owner contact</div>
            <div class="feature">✅ <strong>Easy Booking Process</strong> - Just a few clicks</div>
          
          <div style="text-align: center;">
            <a href="https://easytorent.in/pg" class="button">🔍 Browse PGs & Claim Offer</a>
          </div>
          
          <p style="text-align: center; margin-top: 30px; font-size: 14px;">
            ⏰ <span class="expiry">Offer valid for a limited time only</span>
          </p>
          <p style="text-align: center; font-size: 12px; color: #888;">
            Limited slots available. Book now to secure your discount!
          </p>
        </div>
        
        <div class="footer">
          <p>EasyToRent - Find your perfect PG accommodation</p>
          <p>📍 Chandigarh | Mohali | Panchkula | Zirakpur</p>
          <p>© ${new Date().getFullYear()} EasyToRent. All rights reserved.</p>
          <p style="font-size: 11px;">You're receiving this email because you're a valued EasyToRent user.</p>
        </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email: userEmail,
    subject: `🎉 Special Offer: ${discount} - EasyToRent`,
    html,
  });
};

// ✅ NEW: Send Price Drop Alert Email
const sendPriceDropAlert = async (user, pg, oldPrice, newPrice) => {
  const savings = oldPrice - newPrice;
  const discountPercent = Math.round((savings / oldPrice) * 100);
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Price Drop Alert!</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 32px; }
        .price-box { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 15px; padding: 20px; text-align: center; margin: 20px 0; }
        .price-old { text-decoration: line-through; color: #999; font-size: 18px; }
        .price-new { color: #22c55e; font-size: 32px; font-weight: bold; }
        .savings { background: #22c55e; color: white; padding: 5px 15px; border-radius: 50px; display: inline-block; font-weight: bold; }
        .button { display: inline-block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 12px 30px; text-decoration: none; border-radius: 50px; font-weight: bold; margin-top: 20px; }
        .features { background: #f9f9f9; padding: 20px; border-radius: 15px; margin: 20px 0; }
        .feature { padding: 8px 0; border-bottom: 1px solid #eee; }
        .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💰 Price Drop Alert!</h1>
          <p>Great news about a PG you're interested in</p>
        </div>
        
        <div style="padding: 30px;">
          <h2 style="text-align: center;">Hi ${user.name}! 👋</h2>
          <p style="text-align: center; font-size: 16px;">The PG you've been watching just got cheaper!</p>
          
          <div style="text-align: center; margin: 20px 0;">
            <img src="${pg.images?.[0] || 'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=200'}" 
                 alt="${pg.name}" 
                 style="width: 100%; max-width: 300px; height: 200px; object-fit: cover; border-radius: 15px;">
          </div>
          
          <h3 style="text-align: center; color: #1f2937;">${pg.name}</h3>
          <p style="text-align: center; color: #6b7280;">📍 ${pg.address}</p>
          
          <div class="price-box">
            <p style="margin: 0;">Previous Price</p>
            <p class="price-old">₹${oldPrice.toLocaleString()}/month</p>
            <p style="margin: 10px 0 0;">New Price</p>
            <p class="price-new">₹${newPrice.toLocaleString()}/month</p>
            <div style="margin-top: 15px;">
              <span class="savings">Save ₹${savings.toLocaleString()}/month (${discountPercent}% OFF)</span>
            </div>
          
          <div class="features">
            <div class="feature">✅ <strong>Verified Property</strong> - 100% genuine listing</div>
            <div class="feature">✅ <strong>No Brokerage</strong> - Direct owner contact</div>
            <div class="feature">✅ <strong>Easy Booking</strong> - Just a few clicks</div>
          
          <div style="text-align: center;">
            <a href="https://easytorent.in/pg/${pg._id}" class="button">🔍 View Property & Book Now</a>
          </div>
          
          <p style="text-align: center; font-size: 12px; color: #888; margin-top: 20px;">
            ⏰ This offer won't last long! Book now to secure this price.
          </p>
        </div>
        
        <div class="footer">
          <p>EasyToRent - Find your perfect PG accommodation</p>
          <p>You received this email because you set a price alert for this PG.</p>
          <p><a href="https://easytorent.in/price-alerts" style="color: #3b82f6;">Manage Alerts</a></p>
          <p>© 2024 EasyToRent. All rights reserved.</p>
        </div>
    </body>
    </html>
  `;

  const text = `Price Drop Alert!\n\nPG: ${pg.name}\nAddress: ${pg.address}\nOld Price: ₹${oldPrice.toLocaleString()}/month\nNew Price: ₹${newPrice.toLocaleString()}/month\nYou save: ₹${savings.toLocaleString()}/month (${discountPercent}% OFF)\n\nView Property: https://easytorent.in/pg/${pg._id}`;

  return await sendEmail({
    email: user.email,
    subject: `💰 Price Drop Alert! ${pg.name} is now ₹${newPrice.toLocaleString()}/month`,
    html,
    text
  });
};

// Send Test Email (Now sends offer email instead of test)
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
  sendPriceDropAlert
};
