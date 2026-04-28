/**
 * Database v4 migration script
 * Adds enterprise auth schema: credential_type, external_id, idp_provider columns
 * and org_identity_providers table
 */

const { Pool } = require('pg');
const config = require('../config');

async function migrateV4(pool) {
  // Support both being called with an existing pool (from migrate.js) or standalone
  const ownPool = !pool;
  const pg = pool || new Pool({
    connectionString: config.databaseUrl,
    ...(config.nodeEnv === 'production' && {
      ssl: {
        rejectUnauthorized: !!process.env.DB_CA_CERT,
        ca: process.env.DB_CA_CERT ? Buffer.from(process.env.DB_CA_CERT, 'base64').toString() : undefined
      }
    })
  });

  const client = await pg.connect();
  try {
    await client.query('BEGIN');

    console.log('[Migrate V4] Adding enterprise auth schema...');

    // Add credential_type column to agent_identities
    await client.query(`
      ALTER TABLE agent_identities 
      ADD COLUMN IF NOT EXISTS credential_type VARCHAR(20) DEFAULT 'crypto'
    `);

    // Add external_id for OAuth subject IDs, Entra object IDs, etc.
    await client.query(`
      ALTER TABLE agent_identities 
      ADD COLUMN IF NOT EXISTS external_id VARCHAR(255)
    `);

    // Add idp_provider for storing the identity provider issuer URL
    await client.query(`
      ALTER TABLE agent_identities 
      ADD COLUMN IF NOT EXISTS idp_provider VARCHAR(255)
    `);

    // Create org_identity_providers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS org_identity_providers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        provider_type VARCHAR(50) NOT NULL,
        issuer_url VARCHAR(500) NOT NULL,
        client_id VARCHAR(255),
        allowed_audiences JSONB DEFAULT '[]',
        claim_mappings JSONB DEFAULT '{}',
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(org_id, issuer_url)
      )
    `);

    // Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agents_credential_type 
      ON agent_identities(credential_type)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agents_external_id 
      ON agent_identities(external_id) WHERE external_id IS NOT NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_org_idps_org 
      ON org_identity_providers(org_id)
    `);

    await client.query('COMMIT');
    console.log('[Migrate V4] Enterprise auth schema applied successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    // Idempotent — if columns/tables already exist, that's fine
    if (err.code === '42701' || err.code === '42P07') {
      console.log('[Migrate V4] Enterprise auth schema already up to date');
    } else {
      console.error('[Migrate V4] Migration failed:', err.message);
      throw err;
    }
  } finally {
    client.release();
    if (ownPool) {
      await pg.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  migrateV4()
    .then(() => { console.log('V4 migration done.'); process.exit(0); })
    .catch((err) => { console.error('V4 migration error:', err); process.exit(1); });
}

module.exports = { migrateV4 };
