/**
 * @agentidapp/verify — A2A Token Verification SDK
 * 
 * Verifies AgentID A2A tokens using Ed25519 asymmetric cryptography.
 * No shared secret required — only the public key or JWKS endpoint.
 */

let jose;
function getJose() {
  if (!jose) {
    try {
      jose = require('jose');
    } catch {
      throw new Error('@agentidapp/verify requires the jose library. Run: npm install jose');
    }
  }
  return jose;
}

class AgentIDVerifier {
  /**
   * @param {Object} options
   * @param {string} [options.publicKey] - PEM-encoded Ed25519 public key (SPKI format)
   * @param {Object} [options.jwk] - JWK-formatted Ed25519 public key
   * @param {string} [options.apiUrl] - AgentID API URL for remote/JWKS verification
   * @param {string} [options.secret] - DEPRECATED: HMAC secret (backward compat, dev only)
   */
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || 'https://api.agentidapp.com';
    this.issuer = 'agentidapp.com';
    this.audience = 'agentid-a2a';
    this._publicKeyPem = options.publicKey || null;
    this._jwk = options.jwk || null;
    this._secret = options.secret || null;
    this._resolvedKey = null;
    this._jwksSet = null;

    if (this._secret) {
      console.warn('[AgentIDVerifier] HMAC secret verification is deprecated. Migrate to Ed25519 public key or JWKS.');
    }
  }

  /** Resolve the public key for local verification */
  async _getKey() {
    if (this._resolvedKey) return this._resolvedKey;
    const { importSPKI, importJWK } = getJose();
    if (this._publicKeyPem) {
      this._resolvedKey = await importSPKI(this._publicKeyPem, 'EdDSA');
    } else if (this._jwk) {
      this._resolvedKey = await importJWK(this._jwk, 'EdDSA');
    }
    return this._resolvedKey;
  }

  /**
   * Verify token locally using Ed25519 public key.
   * @param {string} token - JWT token string
   * @returns {Promise<Object>} Decoded payload
   */
  async verifyLocal(token) {
    const key = await this._getKey();
    if (!key) throw new Error('No public key configured for local verification');
    const { jwtVerify } = getJose();
    const { payload } = await jwtVerify(token, key, {
      issuer: this.issuer,
      audience: this.audience,
    });
    return payload;
  }

  /**
   * Verify token using JWKS fetched from the AgentID API.
   * @param {string} token - JWT token string
   * @returns {Promise<Object>} Decoded payload
   */
  async verifyWithJWKS(token) {
    const { createRemoteJWKSet, jwtVerify } = getJose();
    if (!this._jwksSet) {
      this._jwksSet = createRemoteJWKSet(new URL(`${this.apiUrl}/.well-known/jwks.json`));
    }
    const { payload } = await jwtVerify(token, this._jwksSet, {
      issuer: this.issuer,
      audience: this.audience,
    });
    return payload;
  }

  /**
   * Verify token via AgentID HTTP API (POST /agents/verify-token).
   * @param {string} token - JWT token string
   * @returns {Promise<Object>} Decoded payload
   */
  async verifyRemote(token) {
    let axios;
    try { axios = require('axios'); } catch {
      throw new Error('axios is required for remote verification. Run: npm install axios');
    }
    const response = await axios.post(
      `${this.apiUrl}/agents/verify-token`,
      { token },
      { timeout: 5000 }
    );
    if (!response.data?.valid) {
      throw new Error(response.data?.error || 'Token verification failed');
    }
    return response.data.payload;
  }

  /**
   * Auto-select best verification method:
   * 1. Local (if public key provided)
   * 2. JWKS (if apiUrl configured, fetches public key automatically)
   * 3. Remote HTTP (fallback)
   * 
   * DEPRECATED: HMAC secret fallback (if secret provided)
   * @param {string} token - JWT token string
   * @returns {Promise<Object>} Decoded payload
   */
  async verify(token) {
    // Ed25519 local verification (preferred)
    if (this._publicKeyPem || this._jwk) {
      return this.verifyLocal(token);
    }
    // HMAC fallback (deprecated, dev only)
    if (this._secret) {
      const jwtLib = require('jsonwebtoken');
      return jwtLib.verify(token, this._secret, {
        issuer: this.issuer,
        audience: this.audience,
      });
    }
    // JWKS auto-fetch (recommended for production consumers)
    return this.verifyWithJWKS(token);
  }

  /**
   * Decode token without verification (for inspection only).
   * @param {string} token - JWT token string
   * @returns {Object} Decoded payload
   */
  decode(token) {
    const { decodeJwt } = getJose();
    return decodeJwt(token);
  }
}

module.exports = { AgentIDVerifier };
