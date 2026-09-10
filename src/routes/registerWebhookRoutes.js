const { paymentWebhook } = require('../controllers/advancedPaymentController');

function paymentWebhookHandler(req, res) {
  try {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.rawBody || req.body;
      req.body = JSON.parse(req.body.toString('utf8'));
    }
    return paymentWebhook(req, res);
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
  }
}

function registerWebhookRoutes(app, express) {
  app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), paymentWebhookHandler);
  app.post('/api/paymentgateway/webhook', express.raw({ type: 'application/json' }), paymentWebhookHandler);
}

module.exports = { registerWebhookRoutes };
