const jwt = require('jsonwebtoken');

class AgentIDVerifier {
  /**
   * @param {Object} options
   * @param {string} options.secret - Shared A2A secret (for local HMAC verification)
   * @param {string} [options.apiUrl] - AgentID API base URL (for server-side verification)
   */
  constructor(options = {}) {
    this.secret = options.secret;
    this.apiUrl = options.apiUrl || 'https://api.agentidapp.com';
    this.issuer = 'agentidapp.com';
    this.audience = 'agentid-a2a';
  }

  /**
   * Verify an A2A token locally using the shared secret
   * @param {string} token - The A2A JWT token
   * @returns {Object} Decoded token payload
   * @throws {Error} If token is invalid or expired
   */
  verifyLocal(token) {
    if (!this.secret) {
      throw new Error('Shared secret required for local verification. Use verifyRemote() instead.');
    }
    return jwt.verify(token, this.secret, {
      issuer: this.issuer,
      audience: this.audience
    });
  }

  /**
   * Verify an A2A token via AgentID API (no shared secret needed)
   * @param {string} token - The A2A JWT token
   * @returns {Promise<Object>} Decoded token payload
   * @throws {Error} If token is invalid or expired
   */
  async verifyRemote(token) {
    let axios;
    try {
      axios = require('axios');
    } catch {
      throw new Error('axios is required for remote verification. Install it: npm install axios');
    }

    const response = await axios.post(`${this.apiUrl}/agents/verify-token`, { token }, {
      timeout: 5000
    });

    if (!response.data?.valid) {
      throw new Error(response.data?.error || 'Token verification failed');
    }
    return response.data.payload;
  }

  /**
   * Verify a token using the best available method
   * Prefers local verification if secret is available
   * @param {string} token
   * @returns {Promise<Object>}
   */
  async verify(token) {
    if (this.secret) {
      return this.verifyLocal(token);
    }
    return this.verifyRemote(token);
  }

  /**
   * Extract token payload without verification (for inspection only)
   * @param {string} token
   * @returns {Object}
   */
  decode(token) {
    return jwt.decode(token);
  }
}

module.exports = { AgentIDVerifier };
