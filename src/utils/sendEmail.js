const { Resend } = require('resend');
const { logger } = require('./logger');
const emailTemplates = require('./emailTemplates');

// 🔥 Hard marker to verify this module is loaded at runtime
console.log('🔥 sendEmail.js LOADED');


// Resend client
let resend = null;
let hasResendKey = false;

// ======================
// ENV CONFIG (logged safely)
// ======================
const RESEND_API_KEY_PRESENT = Boolean(process.env.RESEND_API_KEY);
hasResendKey = RESEND_API_KEY_PRESENT;

// Avoid printing secret key value. Only log presence.
console.log('[Email] Resend env check:', {
  RESEND_API_KEY_PRESENT,
  FROM_EMAIL: process.env.FROM_EMAIL || 'onboarding@resend.dev',
  FROM_NAME: process.env.FROM_NAME || 'EasyToRent Team',
  NODE_ENV: process.env.NODE_ENV || 'development',
});
logger.info('[Email] Resend env check (safe):', {
  RESEND_API_KEY_PRESENT,
  FROM_EMAIL: process.env.FROM_EMAIL || 'onboarding@resend.dev',
  FROM_NAME: process.env.FROM_NAME || 'EasyToRent Team',
  NODE_ENV: process.env.NODE_ENV || 'development',
});

if (hasResendKey) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const FROM_NAME = process.env.FROM_NAME || 'EasyToRent Team';


/**
 * Main Email Sender
 */
const sendEmail = async ({ email, subject, html = '', text = '' }) => {
  try {
    // REAL EMAIL (Resend)
    if (hasResendKey) {
      console.log('[Email] Sending via Resend:', {
        to: email,
        subject,
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        htmlLength: String(html || '').length,
      });

      const { data, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: email,
        subject,
        html: String(html), // ✅ ensure string
        text,
      });

      // Log full response/error safely for debugging
      console.log('[Email] Resend response:', {
        data,
        error,
      });

      if (error) {
        // Resend may return { error } without throwing
        console.error('[Email] Resend API error:', error);
        logger.error('[Email] Resend API error:', {
          to: email,
          subject,
          error,
        });
        return {
          success: false,
          error: error.message || 'Resend email sending failed',
          // Keep error object in logs only (avoid leaking internals to frontend)
        };
      }

      logger.info(`📧 Email sent to ${email}: ${data?.id}`);

      return {
        success: true,
        messageId: data?.id,
      };
    }


    // DEV MODE
    console.log('📧 DEV EMAIL');
    console.log('To:', email);
    console.log('Subject:', subject);

    logger.info(`📧 Simulated email sent to ${email}`);

    return {
      success: true,
      messageId: 'dev-' + Date.now(),
    };

  } catch (error) {
    console.error('❌ Email Error (exception):', {
      message: error?.message,
      name: error?.name,
      code: error?.code,
      stack: error?.stack,
    });

    logger.error(`Email failed for ${email}: ${error?.message || 'Unknown error'}`, {
      to: email,
      subject,
      name: error?.name,
      code: error?.code,
      stack: error?.stack,
    });

    return {
      success: false,
      error: error?.message || 'Unknown error',
    };
  }
};


/**
 * OTP EMAIL (FIXED - NO object bug)
 */
const sendOtpEmail = async (email, otp, userName = '') => {
  const result = emailTemplates.otpEmail({ otp, userName });

  // ✅ FIX: extract HTML string properly
  const html = typeof result === 'string' ? result : result.html;

  const res = await sendEmail({
    email,
    subject: '🔐 OTP Verification Code',
    html,
  });

  return res.success;
};

/**
 * Wishlist Email
 */
const sendWishlistReminder = async (user, items) => {
  const html = emailTemplates.wishlistReminderEmail({
    userName: user.name,
    items,
  });

  return await sendEmail({
    email: user.email,
    subject: `❤️ ${items.length} properties waiting`,
    html,
  });
};

/**
 * Booking Email
 */
const sendBookingConfirmation = async (user, booking) => {
  const html = emailTemplates.bookingConfirmationEmail({
    userName: user.name,
    ...booking,
  });

  return await sendEmail({
    email: user.email,
    subject: '🎉 Booking Confirmed',
    html,
  });
};

/**
 * Offer Email
 */
const sendOfferEmail = async (email, userName, message, code) => {
  const html = emailTemplates.offerEmail({
    userName,
    message,
    discountCode: code,
  });

  return await sendEmail({
    email,
    subject: `🎁 ${code || 'Offer'}`,
    html,
  });
};

/**
 * Price Drop Email
 */
const sendPriceDropAlert = async (user, pg, oldPrice, newPrice) => {
  const html = emailTemplates.priceDropEmail({
    userName: user.name,
    pg,
    oldPrice,
    newPrice,
  });

  return await sendEmail({
    email: user.email,
    subject: `💰 Price Drop: ${pg.name}`,
    html,
  });
};

/**
 * Welcome Email
 */
const sendWelcomeEmail = async (user) => {
  const html = emailTemplates.welcomeEmail({
    userName: user.name,
  });

  return await sendEmail({
    email: user.email,
    subject: '🏠 Welcome to EasyToRent',
    html,
  });
};

/**
 * Test Email
 */
const sendTestEmail = async (email, name) => {
  return await sendOfferEmail(email, name, 'Test Email', 'TEST25');
};

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendWishlistReminder,
  sendBookingConfirmation,
  sendOfferEmail,
  sendPriceDropAlert,
  sendWelcomeEmail,
  sendTestEmail,
};