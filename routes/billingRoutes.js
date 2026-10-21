const express = require('express');
const router = express.Router();
const billingService = require('../services/billingService');
const { requireAuth } = require('../middleware/auth');

// POST /api/v1/billing/checkout
router.post('/checkout', requireAuth, (req, res, next) => {
  try {
    const { planId } = req.body;
    const session = billingService.createCheckoutSession(req.user.id, planId);
    res.status(200).json({
      success: true,
      session
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/billing/cancel
router.post('/cancel', requireAuth, (req, res, next) => {
  try {
    const result = billingService.cancelSubscription(req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/billing/webhook
// Supports HMAC signature header 'x-webhook-signature' or direct invocation for test events
router.post('/webhook', (req, res, next) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const eventPayload = req.body;

    // Verify signature if provided or required
    if (signature) {
      const isValid = billingService.verifyWebhookSignature(JSON.stringify(eventPayload), signature);
      if (!isValid) {
        return res.status(401).json({ error: { message: 'Invalid webhook signature.' } });
      }
    }

    const result = billingService.processWebhookEvent(eventPayload, signature);
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
