/**
 * Database v5 migration script
 * F-01: Usage metering (usage_events, billing_plans)
 * F-03: Trust propagation (trust_edges, agent_identities.trust_score)
 * F-04: Webhook filtering (webhooks.event_filters, webhooks.transform_template)
 * F-05: Agent health (agent_identities.last_heartbeat, agent_identities.health_status)
 * F-07: Data residency (organizations.data_region, organizations.compliance_flags)
 */

async function migrateV5(pool) {
  const client = await pool.connect();

  try {
    console.log('Starting v5 database migration...');
    await client.query('BEGIN');

    // F-01: Usage metering — usage_events
    await client.query(`
      CREATE TABLE IF NOT EXISTS usage_events (
        id BIGSERIAL PRIMARY KEY,
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        metric VARCHAR(50) NOT NULL,
        count INTEGER DEFAULT 1,
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_usage_events_org_metric ON usage_events(org_id, metric, recorded_at)`);
    console.log('  - Created table: usage_events');

    // F-01: Usage metering — billing_plans
    await client.query(`
      CREATE TABLE IF NOT EXISTS billing_plans (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        max_agents INTEGER NOT NULL,
        max_api_calls_daily INTEGER NOT NULL,
        max_webhooks INTEGER NOT NULL,
        price_cents INTEGER DEFAULT 0,
        features JSONB DEFAULT '{}'
      )
    `);
    console.log('  - Created table: billing_plans');

    // Seed billing plans (idempotent)
    await client.query(`
      INSERT INTO billing_plans (id, name, max_agents, max_api_calls_daily, max_webhooks, price_cents, features) VALUES
        ('free', 'Free', 5, 100, 2, 0, '{}'),
        ('pro', 'Pro', 50, 10000, 20, 9900, '{"webhook_filters":true,"health_monitoring":true}'),
        ('business', 'Business', 500, 100000, 100, 49900, '{"webhook_filters":true,"health_monitoring":true,"data_residency":true,"trust_propagation":true}')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('  - Seeded billing_plans (free, pro, business)');

    // F-03: Trust propagation — trust_edges
    await client.query(`
      CREATE TABLE IF NOT EXISTS trust_edges (
        id BIGSERIAL PRIMARY KEY,
        source_agent_id UUID NOT NULL,
        target_agent_id UUID NOT NULL,
        edge_type VARCHAR(20) DEFAULT 'attestation',
        weight REAL DEFAULT 1.0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(source_agent_id, target_agent_id, edge_type)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trust_edges_target ON trust_edges(target_agent_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trust_edges_source ON trust_edges(source_agent_id)`);
    console.log('  - Created table: trust_edges');

    // F-03: Trust propagation — agent_identities.trust_score
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS trust_score REAL`);
    console.log('  - Altered table: agent_identities (added trust_score)');

    // F-04: Webhook filtering
    await client.query(`ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS event_filters JSONB`);
    await client.query(`ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS transform_template JSONB`);
    console.log('  - Altered table: webhooks (added event_filters, transform_template)');

    // F-05: Agent health
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ`);
    await client.query(`ALTER TABLE agent_identities ADD COLUMN IF NOT EXISTS health_status VARCHAR(20) DEFAULT 'unknown'`);
    console.log('  - Altered table: agent_identities (added last_heartbeat, health_status)');

    // F-07: Data residency
    await client.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS data_region VARCHAR(20) DEFAULT 'us-east-1'`);
    await client.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS compliance_flags JSONB DEFAULT '{}'`);
    console.log('  - Altered table: organizations (added data_region, compliance_flags)');

    await client.query('COMMIT');
    console.log('✓ v5 database migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ v5 database migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { migrateV5 };
