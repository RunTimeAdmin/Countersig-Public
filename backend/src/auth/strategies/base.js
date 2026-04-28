'use strict';

/**
 * Base authentication strategy interface.
 * All auth strategies must extend this class.
 */
class AuthStrategy {
  /** @returns {string} Strategy identifier */
  get name() {
    throw new Error('Strategy must implement name getter');
  }

  /**
   * Validate agent credentials.
   * @param {Object} payload - Strategy-specific credential payload
   * @returns {Promise<{valid: boolean, identity: Object}>}
   */
  async validateCredentials(payload) {
    throw new Error('Strategy must implement validateCredentials()');
  }

  /**
   * Get a registration challenge (if the strategy requires one).
   * @param {Object} params - Strategy-specific parameters
   * @returns {Promise<Object|null>} Challenge data, or null if not needed
   */
  async getRegistrationChallenge(params) {
    return null; // Default: no challenge needed
  }

  /**
   * Verify a registration payload and return normalized identity.
   * @param {Object} params - Strategy-specific registration parameters
   * @returns {Promise<{verified: boolean, identity: Object}>}
   */
  async verifyRegistration(params) {
    throw new Error('Strategy must implement verifyRegistration()');
  }
}

module.exports = { AuthStrategy };
