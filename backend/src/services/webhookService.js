/**
 * Webhook Service
 * Delivers events to registered webhooks with HMAC signing and retry logic
 */

const axios = require('axios');
const crypto = require('crypto');
const https = require('https');
const net = require('net');
const { query, pool } = require('../models/db');
const eventBus = require('./eventBus');
const { assertPublicHttpsUrl } = require('../utils/urlValidator');

/**
 * Record a webhook delivery attempt to the database
 * @param {string} webhookId - Webhook UUID
 * @param {string} eventId - Event ID
 * @param {string} eventType - Event type
 * @param {number} attempt - Attempt number
 * @param {boolean} success - Whether delivery succeeded
 * @param {number|null} statusCode - HTTP status code
 * @param {string|null} responseSnippet - Response body snippet
 * @param {string|null} error - Error message
 */
async function recordDelivery(webhookId, eventId, eventType, attempt, success, statusCode, responseSnippet, error) {
  try {
    await pool.query(
      `INSERT INTO webhook_deliveries (webhook_id, event_id, event_type, attempt, success, status_code, response_snippet, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [webhookId, eventId, eventType, attempt, success, statusCode,
       responseSnippet ? String(responseSnippet).substring(0, 500) : null,
       error ? String(error).substring(0, 500) : null]
    );
  } catch (err) {
    console.error('[WebhookService] Failed to record delivery:', err.message);
  }
}

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

  // Re-validate URL at delivery time to prevent SSRF and pin DNS to prevent rebinding
  let pinnedAddress;
  try {
    const validation = await assertPublicHttpsUrl(webhook.url);
    pinnedAddress = validation.resolvedAddresses[0];
  } catch (err) {
    return { success: false, statusCode: 0, error: `SSRF blocked: ${err.message}` };
  }

  // Create a custom HTTPS agent that pins DNS resolution to the validated IP
  const agent = new https.Agent({
    lookup: (hostname, options, cb) => {
      cb(null, pinnedAddress, net.isIP(pinnedAddress));
    }
  });

  try {
    const response = await axios.post(webhook.url, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-AgentID-Signature': signature,
        'X-AgentID-Event': event.type
      },
      httpsAgent: agent,
      timeout: 10000,
      maxRedirects: 0,
      maxContentLength: 64 * 1024,
      maxBodyLength: 1024 * 1024,
      validateStatus: () => true
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

    // Record delivery attempt
    await recordDelivery(
      webhook.id,
      event.id,
      event.type,
      attempt + 1,
      result.success,
      result.statusCode,
      null,
      result.error
    );

    if (result.success) {
      if (attempt > 0) {
        console.log(`[WebhookService] Webhook ${webhook.id} succeeded on attempt ${attempt + 1}`);
      }
      // Reset consecutive failures on success
      await pool.query(
        'UPDATE webhooks SET consecutive_failures = 0 WHERE id = $1',
        [webhook.id]
      ).catch(err => console.error('[WebhookService] Failed to reset failure count:', err.message));
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

  // After final retry failure, track consecutive failures
  try {
    await pool.query(
      `UPDATE webhooks SET
        consecutive_failures = COALESCE(consecutive_failures, 0) + 1
      WHERE id = $1`,
      [webhook.id]
    );
    // Auto-disable after 100 consecutive failures
    await pool.query(
      `UPDATE webhooks SET enabled = false
      WHERE id = $1 AND COALESCE(consecutive_failures, 0) >= 100`,
      [webhook.id]
    );
  } catch (err) {
    console.error('[WebhookService] Failed to update failure count:', err.message);
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
        return false;
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
  initWebhookListeners,
  recordDelivery
};
