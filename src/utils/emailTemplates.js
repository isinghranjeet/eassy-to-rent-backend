/**
 * Email Template System
 *
 * Reusable, mobile-responsive email template builder.
 * All templates use inline CSS for maximum email client compatibility.
 */

const BRAND_COLOR = '#f97316';
const BRAND_COLOR_DARK = '#ea580c';
const TEXT_PRIMARY = '#1f2937';
const TEXT_SECONDARY = '#6b7280';
const BG_BODY = '#f4f4f4';
const BG_CARD = '#ffffff';

/**
 * Build the base email HTML wrapper
 */
function buildBaseTemplate({ title, content, footer, previewText = '' }) {
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  ${previewText ? `<meta name="description" content="${previewText}">` : ''}
  <style>
    /* Reset */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; max-width: 100% !important; }
      .content-padding { padding: 20px 15px !important; }
      .hide-mobile { display: none !important; }
      .full-width { width: 100% !important; max-width: 100% !important; }
      .text-center-mobile { text-align: center !important; }
      h1 { font-size: 22px !important; }
      h2 { font-size: 18px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BG_BODY};font-family:'Segoe UI',Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.5;color:${TEXT_PRIMARY};">
  <!-- Preview Text -->
  <div style="display:none;font-size:1px;color:${BG_BODY};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${previewText || title}
  </div>

  <!-- Centered Wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BG_BODY};">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <!-- Main Card -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="container" style="width:100%;max-width:600px;background-color:${BG_CARD};border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLOR}, ${BRAND_COLOR_DARK}); padding: 30px 25px; text-align: center;">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                🏠 EasyToRent
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content-padding" style="padding: 35px 30px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:25px 30px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 8px;font-size:13px;color:${TEXT_SECONDARY};">
                EasyToRent — Find your perfect PG accommodation
              </p>
              <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">
                📍 Chandigarh | Mohali | Panchkula | Zirakpur
              </p>
              ${footer ? `<div style="margin:12px 0;font-size:12px;color:${TEXT_SECONDARY};">${footer}</div>` : ''}
              <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;">
                © ${year} EasyToRent. All rights reserved.
              </p>
            </td>
          </tr>
        </table>

        <!-- Bottom Spacer -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
          <tr><td style="height:20px;"></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════════════
   REUSABLE CONTENT BLOCKS
   ═══════════════════════════════════════════════════════════════════ */

function otpBlock(otp) {
  return `
    <p style="font-size:16px;color:${TEXT_SECONDARY};margin:0 0 20px;">Please use the following OTP to complete your verification:</p>
    <div style="background:#fff7ed;border:2px dashed ${BRAND_COLOR};border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
      <span style="font-size:36px;font-weight:800;color:${BRAND_COLOR};letter-spacing:8px;font-family:monospace;">${otp}</span>
    </div>
    <p style="font-size:13px;color:#9ca3af;text-align:center;margin:0;">⏰ This OTP is valid for 10 minutes.</p>
    <p style="font-size:13px;color:#9ca3af;text-align:center;margin:8px 0 0;">If you didn't request this, please ignore this email.</p>
  `;
}

function buttonBlock({ text, url, color = BRAND_COLOR }) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
      <tr>
        <td style="border-radius:50px;background:${color};text-align:center;">
          <a href="${url}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:50px;">${text}</a>
        </td>
      </tr>
    </table>
  `;
}

function featureList(items) {
  const rows = items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
        <span style="color:#22c55e;font-size:16px;margin-right:8px;">✓</span>
        <span style="font-size:14px;color:${TEXT_PRIMARY};">${item}</span>
      </td>
    </tr>
  `).join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9fafb;border-radius:12px;padding:16px 20px;margin:20px 0;">
      ${rows}
    </table>
  `;
}

function priceBox({ oldPrice, newPrice, savings, discountPercent }) {
  return `
    <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:16px;padding:24px;text-align:center;margin:20px 0;">
      <p style="margin:0 0 8px;font-size:14px;color:${TEXT_SECONDARY};">Previous Price</p>
      <p style="margin:0 0 16px;font-size:20px;color:#9ca3af;text-decoration:line-through;">₹${Number(oldPrice).toLocaleString()}/month</p>
      <p style="margin:0 0 8px;font-size:14px;color:${TEXT_SECONDARY};">New Price</p>
      <p style="margin:0 0 16px;font-size:32px;font-weight:800;color:#22c55e;">₹${Number(newPrice).toLocaleString()}/month</p>
      <span style="display:inline-block;background:#22c55e;color:#ffffff;padding:6px 16px;border-radius:50px;font-size:13px;font-weight:700;">Save ₹${Number(savings).toLocaleString()}/month (${discountPercent}% OFF)</span>
    </div>
  `;
}

function pgCard(pg) {
  const image = pg.images?.[0] || 'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=400';
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9fafb;border-radius:12px;overflow:hidden;margin:12px 0;border:1px solid #e5e7eb;">
      <tr>
        <td style="padding:16px;">
          <img src="${image}" alt="${pg.name}" style="width:100%;height:180px;object-fit:cover;border-radius:10px;margin-bottom:12px;display:block;">
          <h3 style="margin:0 0 6px;font-size:17px;color:${TEXT_PRIMARY};">${pg.name}</h3>
          <p style="margin:0 0 8px;font-size:13px;color:${TEXT_SECONDARY};">📍 ${pg.address || pg.city}</p>
          <p style="margin:0;font-size:18px;font-weight:700;color:${BRAND_COLOR};">₹${Number(pg.price).toLocaleString()}/month</p>
        </td>
      </tr>
    </table>
  `;
}

/* ═══════════════════════════════════════════════════════════════════
   SPECIFIC EMAIL TEMPLATES
   ═══════════════════════════════════════════════════════════════════ */

function otpEmail({ otp, userName = '' }) {
  const greeting = userName ? `Hi ${userName},` : 'Hi there,';
  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;color:${TEXT_PRIMARY};">${greeting} 👋</h2>
    <p style="font-size:16px;color:${TEXT_SECONDARY};margin:0 0 20px;">We received a request to verify your identity. Use the code below to complete your action:</p>
    ${otpBlock(otp)}
  `;

  return buildBaseTemplate({
    title: 'Your OTP Verification Code',
    previewText: `Your EasyToRent verification code is ${otp}`,
    content,
  });
}

function wishlistReminderEmail({ userName, items }) {
  const greeting = userName ? `Hi ${userName},` : 'Hi there,';
  const itemCards = items.map(pg => pgCard(pg)).join('');

  const content = `
    <h2 style="margin:0 0 12px;font-size:20px;color:${TEXT_PRIMARY};">${greeting} 👋</h2>
    <p style="font-size:16px;color:${TEXT_SECONDARY};margin:0 0 20px;">You have <strong style="color:${BRAND_COLOR};">${items.length}</strong> propert${items.length === 1 ? 'y' : 'ies'} saved in your wishlist. Don't miss out!</p>
    ${itemCards}
    ${buttonBlock({ text: '🔍 View Wishlist', url: 'https://easytorent.in/wishlist' })}
  `;

  return buildBaseTemplate({
    title: "Don't Miss Out!",
    previewText: `You have ${items.length} saved propert${items.length === 1 ? 'y' : 'ies'} waiting for you`,
    content,
  });
}

function bookingConfirmationEmail({ userName, pgName, duration, totalAmount, checkInDate }) {
  const greeting = userName ? `Hi ${userName},` : 'Hi there,';
  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <span style="display:inline-block;background:#22c55e;color:#ffffff;font-size:48px;width:64px;height:64px;line-height:64px;border-radius:50%;">✓</span>
      <h2 style="margin:16px 0 4px;font-size:22px;color:${TEXT_PRIMARY};">Booking Confirmed!</h2>
      <p style="margin:0;font-size:15px;color:${TEXT_SECONDARY};">Your reservation is all set 🎉</p>
    </div>

    <h3 style="margin:0 0 16px;font-size:16px;color:${TEXT_PRIMARY};">${greeting}</h3>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9fafb;border-radius:12px;padding:20px;">
      <tr><td style="padding:8px 0;font-size:14px;color:${TEXT_SECONDARY};">Property</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:${TEXT_PRIMARY};text-align:right;">${pgName}</td></tr>
      <tr><td style="padding:8px 0;font-size:14px;color:${TEXT_SECONDARY};">Duration</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:${TEXT_PRIMARY};text-align:right;">${duration} months</td></tr>
      <tr><td style="padding:8px 0;font-size:14px;color:${TEXT_SECONDARY};">Total Amount</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:${TEXT_PRIMARY};text-align:right;">₹${Number(totalAmount).toLocaleString()}</td></tr>
      <tr><td style="padding:8px 0;font-size:14px;color:${TEXT_SECONDARY};">Check-in</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:${TEXT_PRIMARY};text-align:right;">${checkInDate || 'As per agreement'}</td></tr>
    </table>

    ${buttonBlock({ text: 'View Booking', url: 'https://easytorent.in/dashboard', color: '#22c55e' })}
  `;

  return buildBaseTemplate({
    title: '✅ Booking Confirmed',
    previewText: `Your booking at ${pgName} has been confirmed!`,
    content,
  });
}

function offerEmail({ userName, message, discountCode }) {
  const greeting = userName ? `Hi ${userName},` : 'Hi there,';
  const content = `
    <h2 style="margin:0 0 12px;font-size:20px;color:${TEXT_PRIMARY};">${greeting} 🎉</h2>

    <div style="background:#fff7ed;border-left:4px solid ${BRAND_COLOR};padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0;">
      <p style="margin:0;font-size:15px;color:#7c2d12;line-height:1.6;">${message}</p>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <span style="display:inline-block;background:linear-gradient(135deg,${BRAND_COLOR},${BRAND_COLOR_DARK});color:#ffffff;padding:4px 16px;border-radius:50px;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Limited Time Offer</span>
      <p style="margin:16px 0 4px;font-size:14px;color:${TEXT_SECONDARY};">Use this exclusive code:</p>
      <div style="background:#1f2937;color:#ffffff;padding:14px 28px;border-radius:10px;display:inline-block;font-size:24px;font-weight:800;letter-spacing:2px;font-family:monospace;margin:8px 0;">${discountCode}</div>
    </div>

    ${featureList([
      '<strong>Verified Properties</strong> — 100% genuine listings',
      '<strong>No Brokerage</strong> — Direct owner contact',
      '<strong>Easy Booking</strong> — Just a few clicks',
      '<strong>24/7 Security</strong> — CCTV & Guard available',
    ])}

    ${buttonBlock({ text: 'Browse PGs & Claim Offer', url: 'https://easytorent.in/pg' })}
  `;

  return buildBaseTemplate({
    title: `Special Offer: ${discountCode}`,
    previewText: `Exclusive ${discountCode} offer waiting for you!`,
    content,
    footer: `⏰ Offer valid for a limited time. Limited slots available.`,
  });
}

function priceDropEmail({ userName, pg, oldPrice, newPrice }) {
  const savings = oldPrice - newPrice;
  const discountPercent = Math.round((savings / oldPrice) * 100);
  const greeting = userName ? `Hi ${userName},` : 'Hi there,';

  const content = `
    <h2 style="margin:0 0 12px;font-size:20px;color:${TEXT_PRIMARY};">${greeting} 👋</h2>
    <p style="font-size:16px;color:${TEXT_SECONDARY};margin:0 0 20px;">Great news! A PG you're watching just got cheaper 💰</p>

    ${pgCard(pg)}
    ${priceBox({ oldPrice, newPrice, savings, discountPercent })}

    ${featureList([
      '<strong>Verified Property</strong> — 100% genuine listing',
      '<strong>No Brokerage</strong> — Direct owner contact',
      '<strong>Easy Booking</strong> — Just a few clicks',
    ])}

    ${buttonBlock({ text: 'View Property & Book Now', url: `https://easytorent.in/pg/${pg._id || pg.slug || ''}`, color: '#3b82f6' })}

    <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:16px;">⏰ This offer won't last long! Book now to secure this price.</p>
  `;

  return buildBaseTemplate({
    title: '💰 Price Drop Alert!',
    previewText: `${pg.name} dropped from ₹${oldPrice.toLocaleString()} to ₹${newPrice.toLocaleString()}!`,
    content,
    footer: 'You received this because you set a price alert. <a href="https://easytorent.in/price-alerts" style="color:#3b82f6;text-decoration:none;">Manage Alerts</a>',
  });
}

/* ═══════════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════════ */
module.exports = {
  buildBaseTemplate,
  otpEmail,
  wishlistReminderEmail,
  bookingConfirmationEmail,
  offerEmail,
  priceDropEmail,
  buttonBlock,
  featureList,
  priceBox,
  pgCard,
};

