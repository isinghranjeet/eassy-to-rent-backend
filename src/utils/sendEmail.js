/**
 * EasyToRent - Centralized Email Sender
 * Ultimate Bulletproof Edition
 */

const { Resend } = require('resend');
const { logger } = require('./logger');

let resend = null;
let hasResendKey = Boolean(process.env.RESEND_API_KEY);

if (hasResendKey) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const FROM_NAME = process.env.FROM_NAME || 'EasyToRent Team';

/**
 * 🛡️ Universal HTML Extractor & Sanitizer
 */
const sanitizeHtml = (input) => {
  if (!input) return '<p>EasyToRent Notification</p>';
  if (typeof input === 'string') {
    if (input.includes('[object Object]')) {
      return '<p>You have new updates in your EasyToRent wishlist.</p>';
    }
    return input;
  }
  if (typeof input === 'object') {
    if (input.html && typeof input.html === 'string') return input.html;
    return JSON.stringify(input);
  }
  return String(input);
};

const sendEmail = async ({ email, subject = 'EasyToRent Update', html = '', text = '' }) => {
  try {
    const finalHtml = sanitizeHtml(html);
    const finalSubject = sanitizeHtml(subject);

    if (hasResendKey && email) {
      const { data, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: email,
        subject: finalSubject,
        html: finalHtml,
        text,
      });

      if (error) {
        console.error('[Email] Resend API error:', error);
        return { success: false, error: error.message };
      }
      return { success: true, messageId: data?.id };
    }

    console.log('📧 DEV EMAIL SIMULATION:', { to: email, subject: finalSubject });
    return { success: true, messageId: 'dev-' + Date.now() };

  } catch (error) {
    console.error('❌ Email Error:', error);
    return { success: false, error: error?.message };
  }
};

const emailTemplates = require('./emailTemplates');

const sendOtpEmail = async (email, otp, userName = '') => {
  const html = emailTemplates.otpEmail({ otp, userName });
  const res = await sendEmail({ email, subject: '🔐 OTP Verification Code', html });
  return res.success;
};

const sendWishlistReminder = async (user, items) => {
  const html = emailTemplates.wishlistReminderEmail({ userName: user?.name, items: items || [] });
  const res = await sendEmail({ email: user?.email, subject: `❤️ ${items?.length || 0} properties waiting in your wishlist`, html });
  return res.success;
};

const sendBookingConfirmation = async (user, booking) => {
  const html = emailTemplates.bookingConfirmationEmail({ userName: user?.name, ...(booking || {}) });
  const res = await sendEmail({ email: user?.email, subject: '🎉 Booking Confirmed - EasyToRent', html });
  return res.success;
};

const sendOfferEmail = async (email, userName, message, code) => {
  const html = emailTemplates.offerEmail({ userName, message, discountCode: code });
  const res = await sendEmail({ email, subject: `🎁 Special Offer: ${code || 'Discount'}`, html });
  return res.success;
};

const sendPriceDropAlert = async (user, pg, oldPrice, newPrice) => {
  const html = emailTemplates.priceDropEmail({ userName: user?.name, pg, oldPrice, newPrice });
  const res = await sendEmail({ email: user?.email, subject: `💰 Price Drop Alert: ${pg?.name || 'Property'}`, html });
  return res.success;
};

const sendWelcomeEmail = async (user) => {
  const html = emailTemplates.welcomeEmail({ userName: user?.name });
  const res = await sendEmail({ email: user?.email, subject: '🏠 Welcome to EasyToRent', html });
  return res.success;
};

const sendPaymentReceipt = async ({ user, booking, payment }) => {
  const html = `<h2>Payment Successful</h2><p>Dear ${user?.name || 'User'}, your payment of ₹${payment?.amount} is received.</p>`;
  const res = await sendEmail({ email: user?.email, subject: '🧾 Payment Receipt', html });
  return res.success;
};

const sendTestEmail = async (email, name) => {
  return await sendOfferEmail(email, name, 'Test Email', 'TEST25');
};

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendWishlistReminder,
  sendBookingConfirmation,
  sendPaymentReceipt,
  sendOfferEmail,
  sendPriceDropAlert,
  sendWelcomeEmail,
  sendTestEmail,
};