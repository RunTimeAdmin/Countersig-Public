/**
 * Data transformation utilities
 * Converts between snake_case and camelCase
 */

/**
 * Convert snake_case string to camelCase
 * @param {string} str - snake_case string
 * @returns {string} - camelCase string
 */
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

/**
 * Convert all keys in an object from snake_case to camelCase
 * @param {Object} obj - Object with snake_case keys
 * @returns {Object} - Object with camelCase keys
 */
function snakeToCamel(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map(item => snakeToCamel(item));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key);
    result[camelKey] = snakeToCamel(value);
  }
  return result;
}

/**
 * Transform agent fields to camelCase for API responses
 * Maps capability_set -> capabilities for frontend compatibility
 * Ensures agent_id is available as agentId
 * @param {Object} agent - Agent row from database
 * @returns {Object} - Agent with camelCase fields
 */
function transformAgent(agent) {
  if (!agent) return null;

  const transformed = snakeToCamel(agent);

  // Map capability_set to capabilities for frontend compatibility
  if (transformed.capabilitySet !== undefined) {
    transformed.capabilities = transformed.capabilitySet;
    delete transformed.capabilitySet;
  }

  // Ensure agent_id comes through as agentId (snakeToCamel should handle this, but be explicit)
  if (agent.agent_id && !transformed.agentId) {
    transformed.agentId = agent.agent_id;
  }

  return transformed;
}

/**
 * Transform a list of agents
 * @param {Array} agents - Array of agent rows
 * @returns {Array} - Array of transformed agents
 */
function transformAgents(agents) {
  if (!agents) return [];
  return agents.map(agent => transformAgent(agent));
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Input text
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape XML special characters
 * @param {string} str - Input text
 * @returns {string} - Escaped text
 */
function escapeXml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Validate Solana public key format
 * @param {string} pubkey - Public key to validate
 * @returns {boolean} - True if valid Solana address
 */
function isValidSolanaAddress(pubkey) {
  try {
    const bs58 = require('bs58');
    const decoded = bs58.decode(pubkey);
    return decoded.length === 32;
  } catch { return false; }
}

module.exports = {
  toCamelCase,
  snakeToCamel,
  transformAgent,
  transformAgents,
  escapeHtml,
  escapeXml,
  isValidSolanaAddress
};
