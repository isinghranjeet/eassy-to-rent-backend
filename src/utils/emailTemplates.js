/**
 * EasyToRent Email Template System
 * Production Ready - Direct String Return Edition
 */

const BRAND_COLOR = '#f97316';
const BRAND_COLOR_DARK = '#ea580c';
const TEXT_PRIMARY = '#1f2937';
const TEXT_SECONDARY = '#6b7280';
const BG_BODY = '#f4f4f4';
const BG_CARD = '#ffffff';
const SUCCESS_COLOR = '#10b981';

function buildBaseTemplate({ title, content, previewText = '' }) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; padding: 0; background-color: ${BG_BODY}; font-family: Arial, sans-serif; }
  .wrapper { width: 100%; padding: 20px 10px; background-color: ${BG_BODY}; }
  .card { max-width: 600px; margin: 0 auto; background: ${BG_CARD}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
  .header { background: linear-gradient(135deg, ${BRAND_COLOR}, ${BRAND_COLOR_DARK}); padding: 28px 20px; text-align: center; color: #ffffff; font-size: 24px; font-weight: bold; }
  .content { padding: 28px 24px; color: ${TEXT_PRIMARY}; line-height: 1.5; }
  .footer { padding: 20px; text-align: center; background: #fafafa; border-top: 1px solid #e5e7eb; color: ${TEXT_SECONDARY}; font-size: 12px; }
</style>
</head>
<body>
<div style="display:none;font-size:1px;color:${BG_BODY};">${previewText}</div>
<div class="wrapper">
  <div class="card">
    <div class="header">🏠 EasyToRent</div>
    <div class="content">${content}</div>
    <div class="footer">
      <strong>EasyToRent</strong> — Chandigarh University | Mohali | Kharar<br/>
      © ${year} EasyToRent. All rights reserved.
    </div>
  </div>
</div>
</body>
</html>`;
}

function pgCard(pg) {
  const property = (typeof pg === 'object' && pg !== null) ? pg : {};
  const title = property.name || property.title || 'Verified PG Property';
  const address = property.address || property.city || property.locality || 'Chandigarh University Region';
  const price = Number(property.price || property.rent) > 0 ? Number(property.price || property.rent) : 8500;
  const pgId = property._id || property.id || '';
  const imageUrl = (property.images && property.images.length > 0) ? property.images[0] : 'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=600';

  return `
  <div style="border: 1px solid #eef2f6; border-radius: 14px; margin: 16px 0; background: #ffffff; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
    <img src="${imageUrl}" alt="${escapeHtml(title)}" style="width: 100%; height: 150px; object-fit: cover;" />
    <div style="padding: 14px;">
      <h3 style="margin:0 0 4px; font-size:16px; color:${TEXT_PRIMARY};">🏠 ${escapeHtml(title)}</h3>
      <p style="margin:0 0 10px; color:${TEXT_SECONDARY}; font-size:13px;">📍 ${escapeHtml(address)}</p>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:800; font-size:17px; color:${BRAND_COLOR};">₹${price.toLocaleString('en-IN')}<span style="font-size:12px; font-weight:normal;">/month</span></span>
        ${pgId ? `<a href="https://easytorent.in/pg/${pgId}" target="_blank" style="color:#2563eb; text-decoration:none; font-weight:600; font-size:13px;">View Details →</a>` : ''}
      </div>
    </div>
  </div>
  `;
}

// All template functions returning direct string HTML
function wishlistReminderEmail({ userName = '', items = [] }) {
  const cards = items.length ? items.map(pg => pgCard(pg)).join('') : '<p style="text-align:center; color:#9ca3af;">✨ Your wishlist is empty.</p>';
  const content = `
    <h2>Hey ${escapeHtml(userName) || 'there'}! 👋</h2>
    <p>You have <strong style="color:${BRAND_COLOR};">${items.length} saved propert${items.length === 1 ? 'y' : 'ies'}</strong> waiting in your wishlist.</p>
    ${cards}
    <div style="text-align:center; margin-top:24px;">
      <a href="https://easytorent.in/wishlist" style="background:${BRAND_COLOR}; color:white; padding:12px 24px; text-decoration:none; border-radius:30px; font-weight:bold; display:inline-block;">View My Wishlist</a>
    </div>
  `;
  return buildBaseTemplate({ title: 'Wishlist Reminder', previewText: `You have ${items.length} properties saved`, content });
}

function otpEmail({ otp, userName = '' }) {
  const content = `
    <h2>Hello ${escapeHtml(userName) || 'there'}! 👋</h2>
    <p>Your verification code for EasyToRent is:</p>
    <div style="background:#f3f4f6; padding:15px; font-size:24px; font-weight:bold; text-align:center; letter-spacing:4px; border-radius:8px; margin:20px 0;">${otp}</div>
    <p style="font-size:13px; color:${TEXT_SECONDARY};">Valid for 10 minutes. Do not share.</p>
  `;
  return buildBaseTemplate({ title: 'OTP Verification', previewText: `Your OTP is ${otp}`, content });
}

function welcomeEmail({ userName = '' }) {
  const content = `
    <h2>Welcome to EasyToRent, ${escapeHtml(userName) || 'Renter'}! 🎉</h2>
    <p>Find verified PGs near Chandigarh University with zero brokerage.</p>
  `;
  return buildBaseTemplate({ title: 'Welcome', previewText: 'Welcome to EasyToRent', content });
}

function bookingConfirmationEmail({ userName = '', pgName = 'Property', totalAmount = 0, bookingId = 'ETR123' }) {
  const content = `
    <h2>Booking Confirmed! 🎊</h2>
    <p>Dear ${escapeHtml(userName)}, your stay at <strong>${escapeHtml(pgName)}</strong> is confirmed.</p>
    <p><strong>Booking ID:</strong> ${bookingId}</p>
    <p><strong>Total Amount:</strong> ₹${Number(totalAmount).toLocaleString('en-IN')}</p>
  `;
  return buildBaseTemplate({ title: 'Booking Confirmed', previewText: 'Booking Confirmed', content });
}

function offerEmail({ userName = '', message = '', discountCode = 'SAVE20' }) {
  const content = `
    <h2>Special Offer! 🎁</h2>
    <p>Hi ${escapeHtml(userName)}, ${message}</p>
    <div style="background:#fff7ed; border:1px dashed ${BRAND_COLOR}; padding:12px; text-align:center; font-size:18px; font-weight:bold; color:${BRAND_COLOR}; border-radius:6px; margin:20px 0;">Code: ${discountCode}</div>
  `;
  return buildBaseTemplate({ title: 'Special Offer', previewText: 'Exclusive offer', content });
}

function priceDropEmail({ userName = '', pg = {}, oldPrice = 0, newPrice = 0 }) {
  const enhancedPG = { ...pg, price: newPrice };
  const content = `
    <h2>Price Drop Alert! 💰</h2>
    <p>Hi ${escapeHtml(userName)}, a property in your wishlist got cheaper!</p>
    ${pgCard(enhancedPG)}
  `;
  return buildBaseTemplate({ title: 'Price Drop', previewText: 'Price reduced', content });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

module.exports = {
  wishlistReminderEmail,
  otpEmail,
  welcomeEmail,
  bookingConfirmationEmail,
  offerEmail,
  priceDropEmail,
  pgCard,
  buildBaseTemplate
};