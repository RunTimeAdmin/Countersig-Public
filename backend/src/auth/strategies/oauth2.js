'use strict';

const { AuthStrategy } = require('./base');
const { assertPublicHttpsUrl } = require('../../utils/urlValidator');
const { getLogger } = require('../../utils/logger');

// jose is loaded lazily to avoid hard failure if not installed
let jose;
function getJose() {
  if (!jose) {
    try {
      jose = require('jose');
    } catch {
      throw new Error('jose library is required for OAuth2 authentication. Run: npm install jose');
    }
  }
  return jose;
}

/**
 * In-memory JWKS cache keyed by issuer URL.
 * Each entry: { jwks: RemoteJWKSet, cachedAt: number }
 */
const jwksCache = new Map();
const JWKS_CACHE_TTL = 3600000; // 1 hour

/**
 * Get or create a JWKS client for the given issuer.
 * @param {string} issuerUrl
 * @returns {Function} JWKS function for jose.jwtVerify
 */
function getJWKS(issuerUrl) {
  const { createRemoteJWKSet } = getJose();
  const cached = jwksCache.get(issuerUrl);
  if (cached && Date.now() - cached.cachedAt < JWKS_CACHE_TTL) {
    return cached.jwks;
  }

  // Auto-discover JWKS endpoint from issuer
  const jwksUrl = new URL('/.well-known/jwks.json', issuerUrl);
  const jwks = createRemoteJWKSet(jwksUrl);
  jwksCache.set(issuerUrl, { jwks, cachedAt: Date.now() });
  return jwks;
}

class OAuth2AuthStrategy extends AuthStrategy {
  /**
   * @param {Object} config
   * @param {string[]} config.allowedIssuers - Non-empty list of allowed issuer URLs
   */
  constructor(config = {}) {
    super();
    if (!config.allowedIssuers || config.allowedIssuers.length === 0 ||
        (config.allowedIssuers.length === 1 && config.allowedIssuers[0] === '')) {
      throw new Error('OAuth2 strategy requires at least one allowed issuer (set OAUTH2_ALLOWED_ISSUERS)');
    }
    this.allowedIssuers = config.allowedIssuers;
  }

  get name() {
    return 'oauth2';
  }

  /**
   * Validate an external OAuth2/OIDC JWT token.
   * @param {Object} payload
   * @param {string} payload.token - The JWT to validate
   * @param {string} [payload.expectedIssuer] - Required issuer
   * @param {string|string[]} [payload.expectedAudience] - Required audience(s)
   * @param {string[]} [payload.allowedIssuers] - Override allowed issuers (falls back to constructor list)
   * @returns {Promise<{valid: boolean, identity: Object}>}
   */
  async validateCredentials({ token, expectedIssuer, expectedAudience, allowedIssuers }) {
    const { jwtVerify, decodeJwt } = getJose();

    // Use instance allowedIssuers if none provided at call-site
    const effectiveIssuers = (allowedIssuers && allowedIssuers.length > 0)
      ? allowedIssuers
      : this.allowedIssuers;

    // Decode without verification first to get issuer for JWKS lookup
    const decoded = decodeJwt(token);
    const issuer = decoded.iss;

    if (!issuer) {
      return { valid: false, identity: null };
    }

    // Validate issuer is allowed (mandatory — never skip)
    if (expectedIssuer && issuer !== expectedIssuer) {
      return { valid: false, identity: null };
    }
    if (!effectiveIssuers.includes(issuer)) {
      return { valid: false, identity: null, error: 'Issuer not in allowed list' };
    }

    // SSRF protection: ensure issuer URL is public HTTPS
    try {
      await assertPublicHttpsUrl(issuer);
    } catch (err) {
      getLogger().error({ err }, 'OAuth2 issuer URL failed SSRF validation');
      return { valid: false, identity: null, error: 'Issuer URL failed security validation' };
    }

    try {
      // Fetch JWKS and verify token
      const jwks = getJWKS(issuer);
      const verifyOptions = { issuer };
      if (expectedAudience) {
        verifyOptions.audience = expectedAudience;
      }

      const { payload: claims } = await jwtVerify(token, jwks, verifyOptions);

      // Extract normalized identity from claims
      const identity = this._extractIdentity(claims, issuer);
      return { valid: true, identity };
    } catch (err) {
      getLogger().error({ err }, 'OAuth2 token validation failed');
      return { valid: false, identity: null };
    }
  }

  /**
   * OAuth2 does not require a challenge — tokens are self-contained proofs.
   */
  async getRegistrationChallenge() {
    return null;
  }

  /**
   * Verify registration via OAuth2 token.
   * @param {Object} params
   * @param {string} params.token - OAuth2/OIDC JWT
   * @param {string} [params.expectedIssuer]
   * @param {string|string[]} [params.expectedAudience]
   * @param {Object[]} [params.allowedIssuers]
   * @returns {Promise<{verified: boolean, identity: Object}>}
   */
  async verifyRegistration({ token, expectedIssuer, expectedAudience, allowedIssuers }) {
    const result = await this.validateCredentials({
      token,
      expectedIssuer,
      expectedAudience,
      allowedIssuers,
    });
    return { verified: result.valid, identity: result.identity };
  }

  /**
   * Extract normalized identity from JWT claims.
   * @param {Object} claims - Verified JWT payload
   * @param {string} issuer - Token issuer
   * @returns {Object} Normalized identity
   */
  _extractIdentity(claims, issuer) {
    return {
      externalId: claims.sub,
      provider: issuer,
      email: claims.email || claims.preferred_username || null,
      name: claims.name || claims.given_name || null,
      credentialType: 'oauth2',
      claims: {
        sub: claims.sub,
        aud: claims.aud,
        iss: claims.iss,
        roles: claims.roles || claims.realm_access?.roles || [],
        scope: claims.scope || claims.scp || '',
      },
    };
  }
}

module.exports = { OAuth2AuthStrategy, getJWKS, jwksCache };
