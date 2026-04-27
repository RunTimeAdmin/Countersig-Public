/**
 * Webhook Service
 * Delivers events to registered webhooks with HMAC signing and retry logic
 */

const axios = require('axios');
const crypto = require('crypto');
const { query } = require('../models/db');
const eventBus = require('./eventBus');

/**
 * Deliver a single webhook payload
 * @param {Object} webhook - Webhook row from database
 * @param {Object} event - Event object
 * @returns {Object}
 */
async function deliverWebhook(webhook, event) {
  const body = {
    event: event.type,
    data: event.data,
    timestamp: event.timestamp,
    id: event.id
  };

  const bodyString = JSON.stringify(body);
  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(bodyString)
    .digest('hex');

  try {
    const response = await axios.post(webhook.url, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-AgentID-Signature': signature,
        'X-AgentID-Event': event.type
      },
      timeout: 10000
    });

    return {
      success: true,
      statusCode: response.status,
      error: null
    };
  } catch (err) {
    return {
      success: false,
      statusCode: err.response ? err.response.status : null,
      error: err.message
    };
  }
}

/**
 * Deliver webhook with exponential backoff retry
 * @param {Object} webhook - Webhook row from database
 * @param {Object} event - Event object
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Object}
 */
async function deliverWithRetry(webhook, event, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await deliverWebhook(webhook, event);

    if (result.success) {
      if (attempt > 0) {
        console.log(`[WebhookService] Webhook ${webhook.id} succeeded on attempt ${attempt + 1}`);
      }
      return result;
    }

    console.warn(
      `[WebhookService] Webhook ${webhook.id} attempt ${attempt + 1} failed:`,
      result.error
    );

    if (attempt < maxRetries) {
      const delay = Math.pow(4, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    statusCode: null,
    error: `Failed after ${maxRetries + 1} attempts`
  };
}

/**
 * Process all matching webhooks for an event
 * @param {Object} event - Event object
 * @returns {number}
 */
async function processEventWebhooks(event) {
  const orgId = event.data ? event.data.orgId : null;
  if (!orgId) {
    return 0;
  }

  try {
    const result = await query(
      'SELECT * FROM webhooks WHERE org_id = $1 AND enabled = true',
      [orgId]
    );

    const matchingWebhooks = result.rows.filter((webhook) => {
      if (!webhook.events || (Array.isArray(webhook.events) && webhook.events.length === 0)) {
        return true;
      }
      return webhook.events.includes(event.type);
    });

    Promise.allSettled(
      matchingWebhooks.map((webhook) => deliverWithRetry(webhook, event))
    ).catch((err) => {
      console.error('[WebhookService] Error in webhook delivery batch:', err.message);
    });

    return matchingWebhooks.length;
  } catch (err) {
    console.error('[WebhookService] Error processing event webhooks:', err.message);
    return 0;
  }
}

/**
 * Initialize webhook listeners on the event bus
 * Should be called once at server startup
 */
function initWebhookListeners() {
  eventBus.on('*', (event) => {
    processEventWebhooks(event).catch((err) => {
      console.error('[WebhookService] Listener error:', err.message);
    });
  });
  console.log('[WebhookService] Webhook listeners initialized');
}

module.exports = {
  deliverWebhook,
  deliverWithRetry,
  processEventWebhooks,
  initWebhookListeners
};
