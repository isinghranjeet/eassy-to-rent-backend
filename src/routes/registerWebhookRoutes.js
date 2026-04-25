function paymentWebhookHandler(req, res) {
  // Handle webhook from payment gateway
  const signature = req.headers['x-razorpay-signature'];
  // Process webhook (implement in controller)
  console.log('Webhook received:', req.body, signature ? '[signature]' : '[no-signature]');
  res.json({ success: true });
}

function registerWebhookRoutes(app, express) {
  app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), paymentWebhookHandler);
  app.post('/api/paymentgateway/webhook', express.raw({ type: 'application/json' }), paymentWebhookHandler);
}

module.exports = { registerWebhookRoutes };
