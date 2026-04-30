# Countersig 2.0 Migration Guide

This guide documents how to upgrade an existing Countersig v1.0 deployment to v2.0.

---

## Overview

Countersig 2.0 introduces organizations, user authentication, RBAC, audit logging, policies, and webhooks. Most v1 public read endpoints remain unchanged, but state-mutating operations now require authentication.

---

## Database Migration

The v2 schema adds several new tables and alters `agent_identities` to support multi-tenancy.

### New Tables

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant isolation and org metadata |
| `users` | JWT-authenticated users with role assignments |
| `api_keys` | Programmatic access keys scoped to organizations |
| `audit_logs` | Tamper-evident hash-chained event log |
| `agent_groups` | Logical grouping of agents within an org |
| `policy_rules` | Condition-action automation rules |
| `webhooks` | Outbound event delivery subscriptions |

### Altered Tables

`agent_identities` now includes:
- `org_id` (UUID, FK to organizations) — all agents belong to an org
- `created_by` (UUID, FK to users) — tracks who registered the agent
- `updated_at` (TIMESTAMPTZ) — last modification timestamp

### Running the Migration

```bash
cd backend
node -e "
require('dotenv').config();
const { pool } = require('./src/models/db');
const { runV2Migration } = require('./src/models/migrate-v2');
runV2Migration(pool)
  .then(() => { console.log('V2 migration complete'); process.exit(0); })
  .catch(e => { console.error('V2 migration failed:', e); process.exit(1); });
"
```

The migration script is idempotent — it safely skips tables that already exist.

---

## Environment Variables

Update your `.env` file with the following new required variables:

```bash
# === Authentication ===
JWT_SECRET=change-this-to-a-long-random-string-in-production
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# === Email (for org invites) ===
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@countersig.dev

# === Organization ===
DEFAULT_ORG_NAME=Default Organization

# === API Keys ===
API_KEY_PREFIX=cs_
```

**Critical:** `JWT_SECRET` must be cryptographically strong (minimum 32 characters). Rotate it immediately if you suspect compromise — all sessions will be invalidated.

### Updated Production URLs

```bash
CORS_ORIGIN=https://countersig.com
COUNTERSIG_BASE_URL=https://countersig.com
```

---

## Breaking Changes

### Authentication Required for Mutations

The following endpoints now require JWT authentication or a valid API key:

| Endpoint | v1 Behavior | v2 Behavior |
|----------|-------------|-------------|
| `POST /register` | Public, anonymous | Requires authenticated user (agent scoped to user's org) |
| `POST /agents/:pubkey/attest` | Public | Requires `member` role or API key |
| `POST /agents/:pubkey/flag` | Public | Requires `member` role or API key |
| `PUT /agents/:pubkey/update` | PKI signature only | Requires PKI signature **and** authenticated user |

### New Registration Flow

In v1, anyone could register an agent. In v2:

1. Create a user account via `POST /auth/register`
2. Log in via `POST /auth/login` to receive session cookies
3. Register the agent with the same PKI flow, but now the agent is automatically associated with your organization

### API Key Requirement for Automation

Server-to-server scripts that previously called public endpoints must now:

1. Authenticate as a user
2. Create an API key via `POST /api-keys`
3. Use the `X-API-Key` header in automated requests

---

## Backward Compatibility

The following v1 endpoints remain **fully public and unchanged**:

| Endpoint | Status |
|----------|--------|
| `GET /agents` | Public read, no auth required |
| `GET /agents/:pubkey` | Public read, no auth required |
| `GET /discover` | Public read, no auth required |
| `GET /badge/:pubkey` | Public read, no auth required |
| `GET /badge/:pubkey/svg` | Public read, no auth required |
| `GET /reputation/:pubkey` | Public read, no auth required |
| `GET /widget/:pubkey` | Public read, no auth required |
| `GET /health` | Public health check |

Existing widgets and badges embedded on external sites will continue to function without modification.

---

## Step-by-Step Upgrade

### Step 1: Backup Database

```bash
# Create a full backup before any schema changes
pg_dump $DATABASE_URL > countersig-v1-backup-$(date +%Y%m%d).sql
```

### Step 2: Update Environment Variables

```bash
cd backend
cp .env .env.v1-backup

# Add new variables to .env
cat >> .env << 'EOF'

# === Countersig 2.0 ===
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@countersig.dev
DEFAULT_ORG_NAME=Default Organization
API_KEY_PREFIX=cs_
EOF
```

### Step 3: Install New Dependencies

```bash
cd backend
npm install
```

New dependencies include:
- `jsonwebtoken` — JWT signing and verification
- `bcryptjs` — Password hashing
- `cookie-parser` — Cookie handling
- `uuid` — UUID generation

### Step 4: Run Migration

```bash
cd backend
node -e "
require('dotenv').config();
const { pool } = require('./src/models/db');
const { runV2Migration } = require('./src/models/migrate-v2');
runV2Migration(pool)
  .then(() => { console.log('V2 migration complete'); process.exit(0); })
  .catch(e => { console.error('V2 migration failed:', e); process.exit(1); });
"
```

Expected output:
```
[✓] organizations table created
[✓] users table created
[✓] api_keys table created
[✓] audit_logs table created
[✓] agent_groups table created
[✓] policy_rules table created
[✓] webhooks table created
[✓] agent_identities altered (added org_id, created_by, updated_at)
Migration complete.
```

### Step 5: Create Initial Admin User

After migration, create the first admin user who will own all existing agents:

```bash
cd backend
node -e "
require('dotenv').config();
const { createUser } = require('./src/models/orgQueries');
const bcrypt = require('bcryptjs');

(async () => {
  const password = await bcrypt.hash('YourSecurePassword', 12);
  const user = await createUser({
    email: 'admin@yourdomain.com',
    password,
    name: 'System Admin',
    orgName: 'Legacy Organization'
  });
  console.log('Admin user created:', user.id);
  console.log('Organization created:', user.orgId);
  process.exit(0);
})();
"
```

Then migrate existing agents to the new organization:

```bash
node -e "
require('dotenv').config();
const { pool } = require('./src/models/db');

(async () => {
  // Get the first organization
  const org = await pool.query('SELECT id FROM organizations LIMIT 1');
  const orgId = org.rows[0].id;

  // Assign all legacy agents to this org
  await pool.query('UPDATE agent_identities SET org_id = $1 WHERE org_id IS NULL', [orgId]);
  console.log('Legacy agents migrated to organization:', orgId);
  process.exit(0);
})();
"
```

### Step 6: Update Frontend Build

```bash
cd frontend

# Update API URL if needed
echo 'VITE_COUNTERSIG_API_URL=https://countersig.com' > .env

npm install
npm run build
```

### Step 7: Restart Services

```bash
# If using PM2
pm2 restart countersig

# If using Docker Compose
docker-compose down
docker-compose up -d

# Verify health check
curl https://countersig.com/health
```

---

## Post-Migration Verification

Run these checks to confirm a successful upgrade:

```bash
# 1. Health endpoint
curl https://countersig.com/health

# 2. Public read still works
curl https://countersig.com/agents

# 3. Authentication flow
curl -X POST https://countersig.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!","name":"Test User"}'

# 4. Organization stats (requires login)
curl https://countersig.com/orgs/your-org-id/stats \
  -H "Cookie: token=..."

# 5. Audit log integrity
curl https://countersig.com/orgs/your-org-id/audit/verify \
  -H "Cookie: token=..."
```

---

## Rollback Plan

If issues occur, you can rollback to v1:

```bash
# Restore database
cd backend
psql $DATABASE_URL < countersig-v1-backup-YYYYMMDD.sql

# Restore v1 environment
cp .env.v1-backup .env

# Restart services
pm2 restart countersig
```

> **Note:** Rollback will lose any data created after the v2 migration (new users, orgs, audit logs, etc.).

---

## Support

For migration issues:
- GitHub Issues: https://github.com/RunTimeAdmin/AgentID-2.0/issues
- Documentation: See `/docs` folder in repository
