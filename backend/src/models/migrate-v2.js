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

    // Add consecutive_failures column for webhook retry budget tracking
    await client.query(`ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0`);
    console.log('  - Altered table: webhooks (added consecutive_failures)');

    // webhook_deliveries
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id BIGSERIAL PRIMARY KEY,
        webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
        event_id VARCHAR(255),
        event_type VARCHAR(50),
        attempt INTEGER,
        success BOOLEAN,
        status_code INTEGER,
        response_snippet TEXT,
        error TEXT,
        delivered_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  - Created table: webhook_deliveries');

    // Alter existing agent_identities table
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id)`);
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS created_by UUID`);
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS updated_by UUID`);
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS legacy_signing_disabled BOOLEAN DEFAULT false`);
    console.log('  - Altered table: agent_identities (added org_id, created_by, updated_by, updated_at, deleted_at, legacy_signing_disabled)');

    // Add login attempt tracking columns to users
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ`);
    console.log('  - Altered table: users (added failed_login_count, locked_until)');

    // CHECK constraints on enum columns
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'member', 'viewer'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE policy_rules ADD CONSTRAINT policy_action_check CHECK (action IN ('revoke', 'flag', 'notify', 'disable'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE agent_identities ADD CONSTRAINT agent_identities_status_check CHECK (status IN ('active', 'flagged', 'revoked', 'disabled'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    console.log('  - Added CHECK constraints on enum columns');

    // Add owner_user_id FK after users table exists
    await client.query(`ALTER TABLE organizations DROP CONSTRAINT IF EXISTS fk_org_owner`);
    await client.query(`ALTER TABLE organizations ADD CONSTRAINT fk_org_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)`);
    console.log('  - Added constraint: fk_org_owner on organizations(owner_user_id)');

    // Hard-delete CASCADE FKs for org-dependent tables
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_id_fkey`);
    await client.query(`ALTER TABLE users ADD CONSTRAINT users_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`);

    await client.query(`ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_org_id_fkey`);
    await client.query(`ALTER TABLE api_keys ADD CONSTRAINT api_keys_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`);

    await client.query(`ALTER TABLE webhooks DROP CONSTRAINT IF EXISTS webhooks_org_id_fkey`);
    await client.query(`ALTER TABLE webhooks ADD CONSTRAINT webhooks_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`);

    await client.query(`ALTER TABLE policy_rules DROP CONSTRAINT IF EXISTS policy_rules_org_id_fkey`);
    await client.query(`ALTER TABLE policy_rules ADD CONSTRAINT policy_rules_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`);

    await client.query(`ALTER TABLE agent_groups DROP CONSTRAINT IF EXISTS agent_groups_org_id_fkey`);
    await client.query(`ALTER TABLE agent_groups ADD CONSTRAINT agent_groups_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE`);
    console.log('  - Added ON DELETE CASCADE FKs for org-dependent tables');

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
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agents_active ON agent_identities(org_id, status, bags_score DESC) WHERE is_demo = false AND revoked_at IS NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_policy_rules_active ON policy_rules(org_id) WHERE enabled = true`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(org_id) WHERE enabled = true`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(org_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id, delivered_at DESC)`);
    console.log('  - Created v2 indexes');

    // auth_attempts table for login auditing
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_attempts (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(255),
        ip_address VARCHAR(45),
        user_agent TEXT,
        success BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_auth_attempts_email ON auth_attempts(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_auth_attempts_created ON auth_attempts(created_at)`);
    console.log('  - Created table: auth_attempts');

    // billing_events — metered billable operations per org
    await client.query(`
      CREATE TABLE IF NOT EXISTS billing_events (
        id BIGSERIAL PRIMARY KEY,
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        api_key_id UUID,
        user_id UUID,
        operation_type VARCHAR(50) NOT NULL,
        endpoint VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_billing_events_org_period ON billing_events (org_id, created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_billing_events_type ON billing_events (operation_type, created_at)`);
    console.log('  - Created table: billing_events');

    // org_plans — per-org subscription tier and Stripe references
    await client.query(`
      CREATE TABLE IF NOT EXISTS org_plans (
        id BIGSERIAL PRIMARY KEY,
        org_id UUID UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
        tier VARCHAR(20) NOT NULL DEFAULT 'free',
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  - Created table: org_plans');

    // Seed org_plans for any existing organizations that don't have one yet
    await client.query(`
      INSERT INTO org_plans (org_id, tier, current_period_start, current_period_end)
      SELECT id, 'free', date_trunc('month', NOW()), date_trunc('month', NOW()) + INTERVAL '1 month'
      FROM organizations
      WHERE id NOT IN (SELECT org_id FROM org_plans WHERE org_id IS NOT NULL)
      ON CONFLICT DO NOTHING
    `);
    console.log('  - Seeded org_plans for existing organizations');

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
