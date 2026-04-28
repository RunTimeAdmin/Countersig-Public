/**
 * Database v3 migration script
 * Adds chain support columns and supported_chains reference table
 */

const { Pool } = require('pg');
const config = require('../config');

async function migrateV3(pool) {
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

    console.log('[Migrate V3] Adding chain support columns...');

    // Add chain_type to agent_identities
    await client.query(`
      ALTER TABLE agent_identities 
      ADD COLUMN IF NOT EXISTS chain_type VARCHAR(50) DEFAULT 'solana-bags' NOT NULL
    `);

    // Add chain_meta for chain-specific metadata
    await client.query(`
      ALTER TABLE agent_identities 
      ADD COLUMN IF NOT EXISTS chain_meta JSONB DEFAULT '{}'::jsonb
    `);

    // Index on chain_type for filtered queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_identities_chain_type 
      ON agent_identities(chain_type)
    `);

    // Composite index for chain-specific discovery
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_identities_chain_status 
      ON agent_identities(chain_type, status)
    `);

    // Add supported_chains reference table
    await client.query(`
      CREATE TABLE IF NOT EXISTS supported_chains (
        chain_type VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        chain_id VARCHAR(50),
        address_format VARCHAR(20) NOT NULL,
        signing_algo VARCHAR(50) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed supported chains
    await client.query(`
      INSERT INTO supported_chains (chain_type, name, chain_id, address_format, signing_algo) VALUES
        ('solana-bags', 'Solana (BAGS)', 'solana-mainnet', 'base58', 'Ed25519'),
        ('solana', 'Solana', 'solana-mainnet', 'base58', 'Ed25519'),
        ('ethereum', 'Ethereum', '1', 'hex', 'SECP256K1'),
        ('base', 'Base', '8453', 'hex', 'SECP256K1'),
        ('polygon', 'Polygon', '137', 'hex', 'SECP256K1')
      ON CONFLICT (chain_type) DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('[Migrate V3] Chain support migration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migrate V3] Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    if (ownPool) {
      await pg.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  migrateV3()
    .then(() => { console.log('V3 migration done.'); process.exit(0); })
    .catch((err) => { console.error('V3 migration error:', err); process.exit(1); });
}

module.exports = { migrateV3 };
