'use strict';

const { OAuth2AuthStrategy, getJWKS } = require('./oauth2');

// Entra ID specific constants
const ENTRA_ISSUER_PREFIX = 'https://login.microsoftonline.com/';
const ENTRA_JWKS_SUFFIX = '/discovery/v2.0/keys';
const ENTRA_V2_SUFFIX = '/v2.0';

class EntraIdAuthStrategy extends OAuth2AuthStrategy {
  get name() {
    return 'entra_id';
  }

  /**
   * Validate a Microsoft Entra ID token (including Workload Identity Federation).
   * @param {Object} payload
   * @param {string} payload.token - The JWT from Entra ID
   * @param {string} [payload.expectedTenantId] - Required tenant ID
   * @param {string|string[]} [payload.expectedAudience] - Required audience(s)
   * @param {string[]} [payload.allowedIssuers] - Additional allowed issuers
   * @returns {Promise<{valid: boolean, identity: Object}>}
   */
  async validateCredentials({ token, expectedTenantId, expectedAudience, allowedIssuers = [] }) {
    let jose;
    try {
      jose = require('jose');
    } catch {
      throw new Error('jose library is required for Entra ID authentication. Run: npm install jose');
    }

    const { decodeJwt, jwtVerify } = jose;

    // Decode without verification first to extract tenant and issuer
    const decoded = decodeJwt(token);
    const issuer = decoded.iss;
    const tenantId = decoded.tid;

    if (!issuer || !tenantId) {
      return { valid: false, identity: null };
    }

    // Validate this is an Entra ID token
    if (!issuer.startsWith(ENTRA_ISSUER_PREFIX)) {
      return { valid: false, identity: null };
    }

    // Validate tenant ID if specified
    if (expectedTenantId && tenantId !== expectedTenantId) {
      return { valid: false, identity: null };
    }

    // Build the Entra-specific JWKS URL
    const jwksUrl = `${ENTRA_ISSUER_PREFIX}${tenantId}${ENTRA_JWKS_SUFFIX}`;

    try {
      const jwks = getJWKS(issuer.endsWith(ENTRA_V2_SUFFIX) ? issuer : `${ENTRA_ISSUER_PREFIX}${tenantId}${ENTRA_V2_SUFFIX}`);

      const verifyOptions = {
        issuer,
      };
      if (expectedAudience) {
        verifyOptions.audience = expectedAudience;
      }

      const { payload: claims } = await jwtVerify(token, jwks, verifyOptions);

      const identity = this._extractEntraIdentity(claims, issuer, tenantId);
      return { valid: true, identity };
    } catch (err) {
      console.error('Entra ID token validation failed:', err.message);
      return { valid: false, identity: null };
    }
  }

  /**
   * Extract normalized identity from Entra ID JWT claims.
   * Handles both user tokens and Workload Identity Federation tokens.
   * @param {Object} claims - Verified JWT payload
   * @param {string} issuer - Token issuer
   * @param {string} tenantId - Azure AD tenant ID
   * @returns {Object} Normalized identity
   */
  _extractEntraIdentity(claims, issuer, tenantId) {
    // Determine if this is a workload identity (app token) or user token
    const isWorkloadIdentity = !claims.upn && !claims.email && (claims.appid || claims.azp);

    return {
      externalId: claims.oid || claims.sub,
      provider: issuer,
      email: claims.email || claims.preferred_username || claims.upn || null,
      name: claims.name || claims.app_displayname || null,
      credentialType: 'entra_id',
      tenantId,
      isWorkloadIdentity,
      claims: {
        sub: claims.sub,
        oid: claims.oid,
        aud: claims.aud,
        iss: claims.iss,
        tid: tenantId,
        // App identity fields (Workload Identity)
        appid: claims.appid || claims.azp || null,
        appDisplayName: claims.app_displayname || null,
        // Role mappings -> capabilities
        roles: claims.roles || [],
        // Scopes
        scp: claims.scp || '',
        // Federated credential info
        azpacr: claims.azpacr || null, // Authentication context class reference
      },
    };
  }

  /**
   * Verify registration via Entra ID token.
   * Maps Entra roles to agent capabilities.
   * @param {Object} params
   * @param {string} params.token
   * @param {string} [params.expectedTenantId]
   * @param {string|string[]} [params.expectedAudience]
   * @returns {Promise<{verified: boolean, identity: Object}>}
   */
  async verifyRegistration({ token, expectedTenantId, expectedAudience, allowedIssuers = [] }) {
    const result = await this.validateCredentials({
      token,
      expectedTenantId,
      expectedAudience,
      allowedIssuers,
    });

    if (result.valid && result.identity) {
      // Map Entra roles to capabilities if present
      const roles = result.identity.claims.roles || [];
      if (roles.length > 0) {
        result.identity.capabilities = roles.map(role => `entra.role.${role}`);
      }
    }

    return { verified: result.valid, identity: result.identity };
  }
}

module.exports = { EntraIdAuthStrategy };
