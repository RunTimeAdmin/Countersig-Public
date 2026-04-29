/**
 * Webhook Service
 * Delivers events to registered webhooks with HMAC signing and retry logic
 * Uses BullMQ for reliable delivery with exponential backoff
 */

const { Queue, Worker } = require('bullmq');
const axios = require('axios');
const crypto = require('crypto');
const https = require('https');
const net = require('net');
const { query, pool } = require('../models/db');
const eventBus = require('./eventBus');
const { assertPublicHttpsUrl } = require('../utils/urlValidator');
const config = require('../config');
const { getLogger, logger: baseLogger } = require('../utils/logger');

// BullMQ Redis connection configuration
const redisConnection = {
  host: config.redisHost || 'localhost',
  port: config.redisPort || 6379,
  password: config.redisPassword || undefined,
};

// Create the webhook delivery queue
const webhookQueue = new Queue('webhook-delivery', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  }
});

// Create a worker that processes deliveries
const webhookWorker = new Worker('webhook-delivery', async (job) => {
  const { url, payload, headers } = job.data;

  // Re-validate URL at delivery time to prevent SSRF and pin DNS to prevent rebinding
  let pinnedAddress;
  try {
    const validation = await assertPublicHttpsUrl(url);
    pinnedAddress = validation.resolvedAddresses[0];
  } catch (err) {
    throw new Error(`SSRF blocked: ${err.message}`);
  }

  // Create a custom HTTPS agent that pins DNS resolution to the validated IP
  const agent = new https.Agent({
    lookup: (hostname, options, cb) => {
      cb(null, pinnedAddress, net.isIP(pinnedAddress));
    }
  });

  const response = await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    httpsAgent: agent,
    timeout: 10000,
    maxRedirects: 0,
    maxContentLength: 64 * 1024,
    maxBodyLength: 1024 * 1024,
    validateStatus: () => true
  });

  if (response.status < 200 || response.status >= 300) {
    try { require('../middleware/metricsMiddleware').webhookDeliveries.inc({ status: 'failure' }); } catch (_) {}
    throw new Error(`Webhook delivery failed: ${response.status}`);
  }
  try { require('../middleware/metricsMiddleware').webhookDeliveries.inc({ status: 'success' }); } catch (_) {}
  return { status: response.status };
}, { connection: redisConnection, concurrency: 5 });

webhookWorker.on('failed', (job, err) => {
  baseLogger.error({ jobId: job?.id, err }, 'Webhook job failed');
});

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
    getLogger().error({ err }, 'Failed to record webhook delivery');
  }
}

/**
 * Deliver a single webhook payload via the BullMQ queue
 * @param {string} url - Webhook URL
 * @param {Object} payload - Event payload
 * @param {Object} headers - Additional headers
 */
async function deliverWebhook(url, payload, headers = {}) {
  await webhookQueue.add('deliver', { url, payload, headers });
}

/**
 * Deliver webhook with exponential backoff retry (legacy wrapper for queue-based delivery)
 * @param {Object} webhook - Webhook row from database
 * @param {Object} event - Event object
 * @returns {Object}
 */
async function deliverWithRetry(webhook, event) {
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

  await deliverWebhook(webhook.url, body, {
    'X-AgentID-Signature': signature,
    'X-AgentID-Event': event.type
  });

  return { success: true, statusCode: null, error: null };
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

    // Enqueue each matching webhook for delivery
    for (const webhook of matchingWebhooks) {
      deliverWithRetry(webhook, event).catch((err) => {
        getLogger().error({ err }, 'Error enqueueing webhook');
      });
    }

    return matchingWebhooks.length;
  } catch (err) {
    getLogger().error({ err }, 'Error processing event webhooks');
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
      baseLogger.error({ err }, 'Webhook listener error');
    });
  });
  baseLogger.info('Webhook listeners initialized');
}

/**
 * Gracefully shut down the BullMQ queue and worker
 */
async function closeWebhookQueue() {
  await webhookWorker.close();
  await webhookQueue.close();
}

module.exports = {
  deliverWebhook,
  deliverWithRetry,
  processEventWebhooks,
  initWebhookListeners,
  recordDelivery,
  closeWebhookQueue
};
