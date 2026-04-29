const Stripe = require('stripe');
const config = require('../config');
const { pool } = require('../models/db');
const { TIER_LIMITS } = require('../middleware/billingMeter');

let stripe = null;
function getStripe() {
  if (!stripe && config.stripeSecretKey) {
    stripe = new Stripe(config.stripeSecretKey);
  }
  return stripe;
}

/**
 * Get usage for an org in the current billing period
 */
async function getUsage(orgId) {
  const planResult = await pool.query(
    'SELECT * FROM org_plans WHERE org_id = $1', [orgId]
  );
  const plan = planResult.rows[0] || { tier: 'free' };
  const periodStart = plan.current_period_start || getMonthStart();
  
  const usageResult = await pool.query(
    `SELECT operation_type, COUNT(*) as count 
     FROM billing_events 
     WHERE org_id = $1 AND created_at >= $2 
     GROUP BY operation_type`,
    [orgId, periodStart]
  );
  
  const usage = {};
  const limits = TIER_LIMITS[plan.tier] || TIER_LIMITS.free;
  
  for (const type of ['attestation', 'verification', 'credential_fetch', 'token_issuance']) {
    const row = usageResult.rows.find(r => r.operation_type === type);
    const current = row ? parseInt(row.count, 10) : 0;
    const limit = limits[type];
    usage[type] = { 
      current, 
      limit: limit === Infinity ? 'unlimited' : limit,
      remaining: limit === Infinity ? 'unlimited' : Math.max(0, limit - current),
    };
  }
  
  return { tier: plan.tier, periodStart, usage };
}

/**
 * Get or create org plan record
 */
async function getOrCreatePlan(orgId) {
  let result = await pool.query('SELECT * FROM org_plans WHERE org_id = $1', [orgId]);
  if (result.rows.length === 0) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    result = await pool.query(
      `INSERT INTO org_plans (org_id, tier, current_period_start, current_period_end) 
       VALUES ($1, 'free', $2, $3) RETURNING *`,
      [orgId, periodStart, periodEnd]
    );
  }
  return result.rows[0];
}

/**
 * Create a Stripe Checkout session for plan upgrade
 */
async function createCheckoutSession(orgId, tier, successUrl, cancelUrl) {
  const s = getStripe();
  if (!s) throw new Error('Stripe is not configured');
  
  const plan = await getOrCreatePlan(orgId);
  
  let priceId;
  if (tier === 'starter') priceId = config.stripePriceStarterId;
  else if (tier === 'professional') priceId = config.stripePriceProfessionalId;
  else throw new Error(`Invalid tier: ${tier}`);
  
  if (!priceId) throw new Error(`Stripe price not configured for tier: ${tier}`);
  
  // Get or create Stripe customer
  let customerId = plan.stripe_customer_id;
  if (!customerId) {
    const customer = await s.customers.create({
      metadata: { orgId: String(orgId) },
    });
    customerId = customer.id;
    await pool.query(
      'UPDATE org_plans SET stripe_customer_id = $1 WHERE org_id = $2',
      [customerId, orgId]
    );
  }
  
  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl || 'https://agentidapp.com/settings?billing=success',
    cancel_url: cancelUrl || 'https://agentidapp.com/settings?billing=cancelled',
    metadata: { orgId: String(orgId), tier },
  });
  
  return { url: session.url, sessionId: session.id };
}

/**
 * Create a Stripe Customer Portal session
 */
async function createPortalSession(orgId, returnUrl) {
  const s = getStripe();
  if (!s) throw new Error('Stripe is not configured');
  
  const plan = await getOrCreatePlan(orgId);
  if (!plan.stripe_customer_id) {
    throw new Error('No billing account found. Please subscribe to a plan first.');
  }
  
  const session = await s.billingPortal.sessions.create({
    customer: plan.stripe_customer_id,
    return_url: returnUrl || 'https://agentidapp.com/settings',
  });
  
  return { url: session.url };
}

/**
 * Handle Stripe webhook events
 */
async function handleWebhookEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const orgId = session.metadata?.orgId;
      const tier = session.metadata?.tier;
      if (orgId && tier) {
        await pool.query(
          `UPDATE org_plans SET tier = $1, stripe_subscription_id = $2, updated_at = NOW() WHERE org_id = $3`,
          [tier, session.subscription, orgId]
        );
      }
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const customerId = sub.customer;
      const periodStart = new Date(sub.current_period_start * 1000);
      const periodEnd = new Date(sub.current_period_end * 1000);
      await pool.query(
        `UPDATE org_plans SET current_period_start = $1, current_period_end = $2, updated_at = NOW() 
         WHERE stripe_customer_id = $3`,
        [periodStart, periodEnd, customerId]
      );
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await pool.query(
        `UPDATE org_plans SET tier = 'free', stripe_subscription_id = NULL, updated_at = NOW() 
         WHERE stripe_customer_id = $1`,
        [sub.customer]
      );
      break;
    }
  }
}

function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

module.exports = { getUsage, getOrCreatePlan, createCheckoutSession, createPortalSession, handleWebhookEvent, getStripe };
