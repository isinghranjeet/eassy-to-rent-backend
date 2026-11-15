const axios = require('axios');
const { logger } = require('./logger');

/**
 * Send WhatsApp Payment Receipt & Invoice Notification
 * @param {Object} data 
 * @param {string} data.phone - Customer phone number with country code (e.g., 919876543210)
 * @param {string} data.customerName - Name of the tenant/user
 * @param {string} data.invoiceNumber - Generated invoice number (e.g., INV-2026-000001)
 * @param {number} data.amount - Paid amount
 * @param {string} data.invoiceUrl - Downloadable PDF invoice URL
 */
const sendWhatsAppReceipt = async ({ phone, customerName, invoiceNumber, amount, invoiceUrl }) => {
  try {
    if (!phone) {
      logger.warn('⚠️ WhatsApp notification skipped: No phone number provided');
      return { success: false, error: 'No phone number provided' };
    }

    // Clean phone number (remove spaces, symbols)
    const formattedPhone = phone.replace(/\D/g, '');

    const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

    // Fallback to development mock logger if credentials are not configured yet
    if (!WHATSAPP_API_URL || !WHATSAPP_TOKEN) {
      logger.info(`📱 [Mock WhatsApp Service] Receipt sent to +${formattedPhone}: Hi ${customerName}, your payment of ₹${amount} is confirmed! Invoice: ${invoiceNumber}. Download: ${invoiceUrl || 'N/A'}`);
      return { success: true, messageId: 'mock-whatsapp-id-' + Date.now() };
    }

    // Real API integration (e.g., Meta Cloud WhatsApp API / WATI / Interakt)
    const payload = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: 'payment_receipt_invoice', // Aapke WhatsApp Business account ka approved template name
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customerName },
              { type: 'text', text: invoiceNumber },
              { type: 'text', text: String(amount) },
              { type: 'text', text: invoiceUrl || 'Not available' }
            ]
          }
        ]
      }
    };

    const response = await axios.post(WHATSAPP_API_URL, payload, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`✅ WhatsApp payment receipt sent successfully to +${formattedPhone}`);
    return { success: true, messageId: response.data?.messages?.[0]?.id };

  } catch (error) {
    logger.error('❌ Failed to send WhatsApp receipt:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendWhatsAppReceipt };