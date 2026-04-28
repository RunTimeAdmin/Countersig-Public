'use strict';

const authConfig = {
  strategies: {
    crypto: {
      enabled: true,
    },
    oauth2: {
      enabled: process.env.OAUTH2_ENABLED === 'true',
      allowedIssuers: (process.env.OAUTH2_ALLOWED_ISSUERS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      allowedAudiences: (process.env.OAUTH2_ALLOWED_AUDIENCES || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    },
    entra_id: {
      enabled: process.env.ENTRA_ID_ENABLED === 'true',
      tenantId: process.env.ENTRA_TENANT_ID || '',
    },
  },

  /** Get config for a specific strategy */
  getStrategyConfig(name) {
    return this.strategies[name] || null;
  },

  /** Check if a strategy is enabled */
  isStrategyEnabled(name) {
    const config = this.strategies[name];
    return config ? config.enabled : false;
  },
};

module.exports = authConfig;
