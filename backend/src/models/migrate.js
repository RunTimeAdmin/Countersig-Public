/**
 * Database migration script
 * Creates all required tables and indexes
 * Run with: node src/models/migrate.js
 */

require('dotenv').config();
const { pool } = require('./db');
const { runV2Migration } = require('./migrate-v2');
const { migrateV3 } = require('./migrate-v3');
const { migrateV4 } = require('./migrate-v4');
const { migrateV5 } = require('./migrate-v5');

const CREATE_TABLES_SQL = `
-- Agent identities table
CREATE TABLE IF NOT EXISTS agent_identities (
  agent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pubkey VARCHAR(88) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  token_mint VARCHAR(88),
  capability_set JSONB DEFAULT '[]',
  creator_x VARCHAR(255),
  creator_wallet VARCHAR(88),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'verified',
  bags_score INTEGER DEFAULT 0,
  successful_actions INTEGER DEFAULT 0,
  failed_actions INTEGER DEFAULT 0,
  total_fees_earned NUMERIC(20,9) DEFAULT 0,
  is_demo BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ DEFAULT NULL,
  CONSTRAINT uq_agent_pubkey_name UNIQUE (pubkey, name)
);

-- Agent verifications table
CREATE TABLE IF NOT EXISTS agent_verifications (
  id SERIAL PRIMARY KEY,
  agent_id UUID REFERENCES agent_identities(agent_id) ON DELETE CASCADE,
  pubkey VARCHAR(88) NOT NULL,
  nonce VARCHAR(64) UNIQUE NOT NULL,
  challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent flags table
CREATE TABLE IF NOT EXISTS agent_flags (
  id SERIAL PRIMARY KEY,
  agent_id UUID REFERENCES agent_identities(agent_id) ON DELETE CASCADE,
  pubkey VARCHAR(88) NOT NULL,
  reporter_pubkey VARCHAR(88),
  reason TEXT NOT NULL,
  evidence JSONB,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_identities_pubkey ON agent_identities(pubkey);
CREATE INDEX IF NOT EXISTS idx_agent_identities_status ON agent_identities(status);
CREATE INDEX IF NOT EXISTS idx_agent_identities_bags_score ON agent_identities(bags_score);
CREATE INDEX IF NOT EXISTS idx_agent_identities_creator_wallet ON agent_identities(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_agent_verifications_agent_id ON agent_verifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_verifications_pubkey ON agent_verifications(pubkey);
CREATE INDEX IF NOT EXISTS idx_agent_flags_agent_id ON agent_flags(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_flags_pubkey ON agent_flags(pubkey);
CREATE INDEX IF NOT EXISTS idx_agent_flags_resolved ON agent_flags(resolved);
CREATE INDEX IF NOT EXISTS idx_agent_flags_agent_id_resolved ON agent_flags(agent_id, resolved);
`;

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database migration...');
    
    await client.query('BEGIN');
    await client.query(CREATE_TABLES_SQL);
    
    // Add is_demo column if not exists (for existing tables)
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false`);
    
    // Add revoked_at column if not exists (for existing tables)
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ DEFAULT NULL`);
    
    // Add index for revoked_at for efficient filtering
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_identities_revoked_at ON agent_identities(revoked_at)`);
    
    await client.query('COMMIT');
    
    await runV2Migration(pool);
    
    await migrateV3(pool);

    await migrateV4(pool);

    await migrateV5(pool);

    console.log('✓ Database migration completed successfully');
    console.log('  - Created table: agent_identities');
    console.log('  - Created table: agent_verifications');
    console.log('  - Created table: agent_flags');
    console.log('  - Added revoked_at column to agent_identities');
    console.log('  - Created indexes for performance');
    
    process.exit(0);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (rollbackErr) { /* ignore */ }
    console.error('✗ Database migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrate();
}

module.exports = { migrate };
