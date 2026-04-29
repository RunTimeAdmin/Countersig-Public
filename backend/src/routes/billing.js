const express = require('express');
const router = express.Router();
const config = require('../config');
const { authenticate } = require('../middleware/authenticate');
const billingService = require('../services/billingService');

function requireOrgContext(req, res, next) {
  if (!req.user?.orgId) {
    return res.status(403).json({ error: 'Organization context required for billing operations' });
  }
  next();
}

// GET /billing/usage — current period usage
router.get('/usage', authenticate, requireOrgContext, async (req, res) => {
  try {
    const orgId = req.user.orgId;
    
    const usage = await billingService.getUsage(orgId);
    res.json(usage);
  } catch (err) {
    console.error('[billing] Usage error:', err.message);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

// GET /billing/plan — current plan details
router.get('/plan', authenticate, requireOrgContext, async (req, res) => {
  try {
    const orgId = req.user.orgId;
    
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
router.post('/checkout', authenticate, requireOrgContext, express.json(), async (req, res) => {
  try {
    const orgId = req.user.orgId;
    
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
router.post('/portal', authenticate, requireOrgContext, express.json(), async (req, res) => {
  try {
    const orgId = req.user.orgId;
    
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
    } else if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      console.warn('[billing] WARNING: Webhook signature verification disabled in dev mode');
      event = JSON.parse(req.body.toString());
    } else {
      return res.status(503).json({ error: 'Webhook signature verification not configured' });
    }
    
    await billingService.handleWebhookEvent(event);
    res.json({ received: true });
  } catch (err) {
    console.error('[billing] Webhook error:', err.message);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
