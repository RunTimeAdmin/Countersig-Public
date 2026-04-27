/**
 * Database v2 migration script
 * Creates organizations, users, api_keys, audit_logs, agent_groups,
 * agent_group_members, policy_rules, webhooks tables and extends agent_identities.
 */

async function runV2Migration(pool) {
  const client = await pool.connect();

  try {
    console.log('Starting v2 database migration...');
    await client.query('BEGIN');

    // organizations
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        owner_user_id UUID,
        plan VARCHAR(50) DEFAULT 'free',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    console.log('  - Created table: organizations');

    // users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        org_id UUID REFERENCES organizations(id),
        role VARCHAR(20) DEFAULT 'member',
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    console.log('  - Created table: users');

    // api_keys
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id),
        user_id UUID REFERENCES users(id),
        key_hash VARCHAR(255) NOT NULL,
        key_prefix VARCHAR(12) NOT NULL,
        name VARCHAR(255),
        scopes JSONB DEFAULT '["read"]',
        last_used TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        revoked_at TIMESTAMPTZ
      )
    `);
    console.log('  - Created table: api_keys');

    // audit_logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        org_id UUID REFERENCES organizations(id),
        actor_id UUID,
        actor_type VARCHAR(20),
        action VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50),
        resource_id UUID,
        changes JSONB,
        metadata JSONB,
        risk_score INTEGER DEFAULT 0,
        prev_hash VARCHAR(64),
        entry_hash VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  - Created table: audit_logs');

    // agent_groups
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  - Created table: agent_groups');

    // agent_group_members
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_group_members (
        group_id UUID REFERENCES agent_groups(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES agent_identities(agent_id) ON DELETE CASCADE,
        PRIMARY KEY (group_id, agent_id)
      )
    `);
    console.log('  - Created table: agent_group_members');

    // policy_rules
    await client.query(`
      CREATE TABLE IF NOT EXISTS policy_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id),
        name VARCHAR(255),
        condition JSONB,
        action VARCHAR(50),
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  - Created table: policy_rules');

    // webhooks
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id),
        url TEXT NOT NULL,
        events JSONB,
        secret VARCHAR(255),
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  - Created table: webhooks');

    // Alter existing agent_identities table
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id)`);
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS created_by UUID`);
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS updated_by UUID`);
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
    console.log('  - Altered table: agent_identities (added org_id, created_by, updated_by, updated_at, deleted_at)');

    // Add owner_user_id FK after users table exists
    await client.query(`ALTER TABLE organizations DROP CONSTRAINT IF EXISTS fk_org_owner`);
    await client.query(`ALTER TABLE organizations ADD CONSTRAINT fk_org_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)`);
    console.log('  - Added constraint: fk_org_owner on organizations(owner_user_id)');

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_identities_org ON agent_identities(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_groups_org ON agent_groups(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_policy_rules_org ON policy_rules(org_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(org_id)`);
    console.log('  - Created v2 indexes');

    await client.query('COMMIT');
    console.log('✓ v2 database migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ v2 database migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { runV2Migration };
