const { Resend } = require('resend');
const logger = require('./logger');
const emailTemplates = require('./emailTemplates');

// Resend API client - Lazy instantiation (no crash on local)
let resend = null;
let hasResendKey = false;

if (process.env.RESEND_API_KEY) {
  const { Resend } = require('resend');
  resend = new Resend(process.env.RESEND_API_KEY);
  hasResendKey = true;
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const FROM_NAME = process.env.FROM_NAME || 'EasyToRent Team';

/**
 * Detect environment and configure sender
 */
function getSender() {
  if (process.env.NODE_ENV === 'production' || process.env.RESEND_API_KEY) {
    return { from: `${FROM_NAME} <${FROM_EMAIL}>` };
  }
  // Local fallback - log only
  return null;
}

/**
 * Main sendEmail function - Resend API + Local fallback
 */
const sendEmail = async (options) => {
  try {
    // Use Resend if key available, else local simulation
    if (hasResendKey) {
      const { data, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        html: options.html,
        text: options.text || '',
      });

      if (error) {
        throw error;
      }

      logger.info(`✅ Resend Email sent to ${options.email}: ${data.id}`);
      return { success: true, messageId: data.id };
    } 

    // Local dev simulation - No API key
    console.log('📧 [SIMULATION] Email to:', options.email);
    console.log('📧 Subject:', options.subject);
    logger.info(`📧 [SIMULATED] Email to ${options.email} - ${options.subject}`);
    return { success: true, messageId: 'simulated-' + Date.now() };

  } catch (error) {
    console.error('❌ Email FAILED:', {
      to: options.email,
      error: error.message,
      code: error.code,
      statusCode: error.statusCode
    });
    logger.error(`Email error for ${options.email}: ${error.message}`, { error });
    return { success: false, error: error.message };
  }
};

// OTP Email - Primary use case
const sendOtpEmail = async (email, otp, userName = '') => {
  const { html } = emailTemplates.otpEmail({ otp, userName });
  
  const result = await sendEmail({
    email,
    subject: '🔐 Your EasyToRent OTP Verification Code',
    html,
  });

  return result.success;
};

// All other exports preserved for compatibility
const sendWishlistReminder = async (user, wishlistItems) => {
  const { html } = emailTemplates.wishlistReminderEmail({ userName: user.name, items: wishlistItems });
  return await sendEmail({
    email: user.email,
    subject: `❤️ ${wishlistItems.length} properties waiting for you!`,
    html,
  });
};

const sendBookingConfirmation = async (user, bookingDetails) => {
  const { html } = emailTemplates.bookingConfirmationEmail({
    userName: user.name,
    ...bookingDetails
  });
  return await sendEmail({
    email: user.email,
    subject: '🎉 Booking Confirmed - Welcome Home! 🏠',
    html,
  });
};

const sendOfferEmail = async (userEmail, userName, customMessage, discountCode) => {
  const { html } = emailTemplates.offerEmail({
    userName,
    message: customMessage,
    discountCode
  });
  return await sendEmail({
    email: userEmail,
    subject: `🎁 ${discountCode || 'Special Offer'} - Just for You!`,
    html,
  });
};

const sendPriceDropAlert = async (user, pg, oldPrice, newPrice) => {
  const { html } = emailTemplates.priceDropEmail({ 
    userName: user.name, 
    pg, 
    oldPrice, 
    newPrice 
  });
  return await sendEmail({
    email: user.email,
    subject: `💰 Price Drop! ${pg.name} now ₹${newPrice.toLocaleString()}/month`,
    html,
  });
};

const sendWelcomeEmail = async (user) => {
  const { html } = emailTemplates.welcomeEmail({ userName: user.name });
  return await sendEmail({
    email: user.email,
    subject: '🏠 Welcome to EasyToRent! 🚀',
    html,
  });
};

const sendTestEmail = async (userEmail, userName) => {
  return await sendOfferEmail(userEmail, userName, 'Test email via Resend', 'TEST25');
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
