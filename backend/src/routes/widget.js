/**
 * Widget Routes
 * Returns embeddable HTML widget for agents
 */

const express = require('express');
const { getWidgetHTML } = require('../services/badgeBuilder');
const { getAgent } = require('../models/queries');
const { defaultLimiter } = require('../middleware/rateLimit');
const { escapeHtml } = require('../utils/transform');

const router = express.Router();

/**
 * GET /widget/:agentId
 * Returns embeddable HTML widget
 */
router.get('/widget/:agentId', defaultLimiter, async (req, res, next) => {
  try {
    const { agentId } = req.params;

    // Check agent exists
    const agent = await getAgent(agentId);
    if (!agent) {
      // Return simple error HTML page
      res.setHeader('Content-Type', 'text/html');
      return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Not Found</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .error-container {
      text-align: center;
      padding: 40px;
    }
    .error-code {
      font-size: 72px;
      font-weight: 700;
      color: #ef4444;
      margin-bottom: 16px;
    }
    .error-message {
      font-size: 18px;
      color: #888;
    }
    .agent-id {
      font-family: monospace;
      background: #1a1a1a;
      padding: 8px 16px;
      border-radius: 8px;
      margin-top: 16px;
      display: inline-block;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-code">404</div>
    <div class="error-message">Agent not found</div>
    <div class="agent-id">${escapeHtml(agentId)}</div>
  </div>
</body>
</html>`);
    }

    const html = await getWidgetHTML(agentId);

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
