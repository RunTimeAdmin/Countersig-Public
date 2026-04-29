const express = require('express');
const router = express.Router();
const config = require('../config');
const { authenticate } = require('../middleware/authenticate');
const billingService = require('../services/billingService');

// GET /billing/usage — current period usage
router.get('/usage', authenticate, async (req, res) => {
  try {
    const orgId = req.user.orgId;
    if (!orgId) return res.status(400).json({ error: 'No organization context' });
    
    const usage = await billingService.getUsage(orgId);
    res.json(usage);
  } catch (err) {
    console.error('[billing] Usage error:', err.message);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

// GET /billing/plan — current plan details
router.get('/plan', authenticate, async (req, res) => {
  try {
    const orgId = req.user.orgId;
    if (!orgId) return res.status(400).json({ error: 'No organization context' });
    
    const plan = await billingService.getOrCreatePlan(orgId);
    res.json({
      tier: plan.tier,
      stripeCustomerId: plan.stripe_customer_id ? '••••' + plan.stripe_customer_id.slice(-4) : null,
      periodStart: plan.current_period_start,
      periodEnd: plan.current_period_end,
    });
  } catch (err) {
    console.error('[billing] Plan error:', err.message);
    res.status(500).json({ error: 'Failed to fetch plan data' });
  }
});

// POST /billing/checkout — create Stripe Checkout session for upgrade
router.post('/checkout', authenticate, express.json(), async (req, res) => {
  try {
    const orgId = req.user.orgId;
    if (!orgId) return res.status(400).json({ error: 'No organization context' });
    
    const { tier, successUrl, cancelUrl } = req.body;
    if (!tier || !['starter', 'professional'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Must be "starter" or "professional".' });
    }
    
    const session = await billingService.createCheckoutSession(orgId, tier, successUrl, cancelUrl);
    res.json(session);
  } catch (err) {
    console.error('[billing] Checkout error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
});

// POST /billing/portal — create Stripe Customer Portal session
router.post('/portal', authenticate, express.json(), async (req, res) => {
  try {
    const orgId = req.user.orgId;
    if (!orgId) return res.status(400).json({ error: 'No organization context' });
    
    const { returnUrl } = req.body;
    const session = await billingService.createPortalSession(orgId, returnUrl);
    res.json(session);
  } catch (err) {
    console.error('[billing] Portal error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create portal session' });
  }
});

// POST /billing/webhook — Stripe webhook handler
// NOTE: This must use raw body parsing, not JSON
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const stripe = billingService.getStripe();
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
    
    const sig = req.headers['stripe-signature'];
    let event;
    
    if (config.stripeWebhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
    } else {
      // In dev, skip signature verification
      event = JSON.parse(req.body.toString());
    }
    
    await billingService.handleWebhookEvent(event);
    res.json({ received: true });
  } catch (err) {
    console.error('[billing] Webhook error:', err.message);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
