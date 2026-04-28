'use strict';

const authConfig = require('./authConfig');
const { CryptographicAuthStrategy } = require('./strategies/cryptographic');
const { OAuth2AuthStrategy } = require('./strategies/oauth2');

class AuthManager {
  constructor() {
    /** @type {Map<string, import('./strategies/base').AuthStrategy>} */
    this._strategies = new Map();
    this._registerDefaults();
  }

  /** Register built-in strategies based on config */
  _registerDefaults() {
    // Crypto is always available
    if (authConfig.isStrategyEnabled('crypto')) {
      this.registerStrategy(new CryptographicAuthStrategy());
    }

    // OAuth2 — only if enabled
    if (authConfig.isStrategyEnabled('oauth2')) {
      this.registerStrategy(new OAuth2AuthStrategy());
    }

    // Entra ID — only if enabled
    if (authConfig.isStrategyEnabled('entra_id')) {
      const { EntraIdAuthStrategy } = require('./strategies/entraId');
      this.registerStrategy(new EntraIdAuthStrategy());
    }
  }

  /**
   * Register an auth strategy.
   * @param {import('./strategies/base').AuthStrategy} strategy
   */
  registerStrategy(strategy) {
    this._strategies.set(strategy.name, strategy);
  }

  /**
   * Get a registered strategy by credential type.
   * @param {string} credentialType
   * @returns {import('./strategies/base').AuthStrategy}
   */
  getStrategy(credentialType) {
    const strategy = this._strategies.get(credentialType);
    if (!strategy) {
      throw new Error(`Authentication strategy not found or not enabled: ${credentialType}`);
    }
    return strategy;
  }

  /**
   * List all registered (enabled) strategy names.
   * @returns {string[]}
   */
  getAvailableStrategies() {
    return Array.from(this._strategies.keys());
  }

  /**
   * Validate agent credentials using the appropriate strategy.
   * @param {string} credentialType - 'crypto', 'oauth2', 'entra_id'
   * @param {Object} payload - Strategy-specific credential data
   * @returns {Promise<{valid: boolean, identity: Object}>}
   */
  async validateAgentCredentials(credentialType, payload) {
    const strategy = this.getStrategy(credentialType);
    return strategy.validateCredentials(payload);
  }

  /**
   * Get a registration challenge (if the strategy requires one).
   * @param {string} credentialType
   * @param {Object} params
   * @returns {Promise<Object|null>}
   */
  async getRegistrationChallenge(credentialType, params) {
    const strategy = this.getStrategy(credentialType);
    return strategy.getRegistrationChallenge(params);
  }

  /**
   * Register an agent using the appropriate strategy.
   * @param {string} credentialType
   * @param {Object} params - Strategy-specific registration parameters
   * @returns {Promise<{verified: boolean, identity: Object}>}
   */
  async registerAgent(credentialType, params) {
    const strategy = this.getStrategy(credentialType);
    return strategy.verifyRegistration(params);
  }
}

// Singleton instance
const authManager = new AuthManager();

module.exports = authManager;
