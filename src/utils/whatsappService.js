// backend/src/utils/whatsappService.js
const axios = require('axios');

const sendWhatsAppReceipt = async ({ phone, customerName, invoiceNumber, amount, invoiceUrl }) => {
  try {
    if (!phone) return { success: false, error: 'No phone number provided' };

    const formattedPhone = phone.replace(/\D/g, '');
    const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

    // Agar real WhatsApp API keys configured nahi hain toh mock mode mein log print karega
    if (!WHATSAPP_API_URL || !WHATSAPP_TOKEN) {
      console.log(`📱 [Mock WhatsApp] Receipt sent to +${formattedPhone}: Hi ${customerName}, your payment of ₹${amount} is confirmed! Invoice: ${invoiceNumber}.`);
      return { success: true, messageId: 'mock-whatsapp-id-' + Date.now() };
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: 'payment_receipt_invoice',
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

    return { success: true, messageId: response.data?.messages?.[0]?.id };
  } catch (error) {
    console.error('❌ Failed to send WhatsApp receipt:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendWhatsAppReceipt };