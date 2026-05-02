# Multi-Organization Enterprise Guide

Enterprise-grade documentation for Countersig's Multi-Organization support — enabling teams to manage multiple organizations with fine-grained role-based access control.

**Version:** 1.0.0  
**Last Updated:** May 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Organization Model](#2-organization-model)
3. [Role Hierarchy](#3-role-hierarchy)
4. [Getting Started](#4-getting-started)
5. [Managing Members](#5-managing-members)
6. [Invitation System](#6-invitation-system)
7. [Organization Switching](#7-organization-switching)
8. [Frontend Integration](#8-frontend-integration)
9. [API Reference](#9-api-reference)
10. [Security Considerations](#10-security-considerations)

---

## 1. Overview

Countersig's Multi-Organization support allows a single user account to belong to multiple organizations simultaneously. This is essential for enterprise deployments where:

- **Consultants** need access to multiple client organizations
- **Platform administrators** manage several teams from one account
- **Mergers & acquisitions** require gradual consolidation of org structures
- **Contractors** collaborate across organizational boundaries

Each organization maintains full tenant isolation — agents, policies, API keys, and audit logs are scoped per-organization. Users can switch between organizations seamlessly, with their role and permissions adjusting automatically based on their membership in each org.

---

## 2. Organization Model

### The `org_members` Junction Table

Multi-org support is built on a many-to-many relationship between users and organizations via the `org_members` junction table:

```sql
CREATE TABLE org_members (
  org_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  role      VARCHAR(20) NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (org_id, user_id)
);
```

Key design decisions:

| Column | Purpose |
|--------|---------|
| `org_id` + `user_id` | Composite primary key — a user can only appear once per org |
| `role` | Per-org role (a user can be `admin` in one org and `viewer` in another) |
| `invited_by` | Tracks who invited this member for audit purposes |
| `deleted_at` | Soft delete — membership removal is reversible |

### The `org_invites` Table

Invitations are tracked in a dedicated table with automatic 7-day expiration:

```sql
CREATE TABLE org_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email      VARCHAR(255) NOT NULL,
  role       VARCHAR(20) NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES users(id),
  status     VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  UNIQUE(org_id, email)
);
```

The `UNIQUE(org_id, email)` constraint ensures only one active invitation per email per organization. Re-inviting the same email resets the expiry timer.

---

## 3. Role Hierarchy

Countersig uses a four-level role hierarchy with numeric precedence:

| Role | Level | Capabilities |
|------|-------|-------------|
| **admin** | 4 | Full organization control — manage members, update org settings, configure identity providers, manage compliance, invite users at any role level |
| **manager** | 3 | Team management — list members, create invites (up to manager level), manage invites, view org stats |
| **member** | 2 | Standard access — register agents, manage own agents, view org data |
| **viewer** | 1 | Read-only access — view agents, policies, and org information |

### Hierarchy Enforcement

Authorization uses a numeric comparison model. A user with role level N can access any endpoint requiring level ≤ N:

```javascript
const ROLE_HIERARCHY = {
  admin: 4,
  manager: 3,
  member: 2,
  viewer: 1
};
```

When inviting users, the inviter cannot assign a role with a higher level than their own. For example, a `manager` (level 3) cannot invite someone as an `admin` (level 4).

---

## 4. Getting Started

### Creating an Organization

When a user registers, an organization is automatically created and the user becomes its `admin`:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@acme.com",
    "password": "secureP@ssw0rd!2024",
    "name": "Alice",
    "orgName": "Acme Corp"
  }'
```

Response:

```json
{
  "user": { "id": "uuid-...", "email": "alice@acme.com", "name": "Alice", "role": "admin" },
  "org": { "id": "uuid-...", "name": "Acme Corp", "slug": "acme-corp" }
}
```

The registering user is automatically added to the `org_members` table as an `admin` and set as the organization's `owner_user_id`.

---

## 5. Managing Members

### Listing Members

Retrieve all active members of an organization (requires `manager` or `admin` role):

```bash
curl http://localhost:3000/orgs/{orgId}/members \
  -H "Cookie: cs_access=<token>"
```

Response:

```json
[
  {
    "id": "uuid-...",
    "email": "alice@acme.com",
    "name": "Alice",
    "role": "admin",
    "joined_at": "2026-04-01T12:00:00Z"
  },
  {
    "id": "uuid-...",
    "email": "bob@acme.com",
    "name": "Bob",
    "role": "member",
    "joined_at": "2026-04-05T09:30:00Z"
  }
]
```

### Updating a Member's Role

Change a member's role (requires `admin` role). Admins cannot change their own role:

```bash
curl -X PUT http://localhost:3000/orgs/{orgId}/members/{userId} \
  -H "Content-Type: application/json" \
  -H "Cookie: cs_access=<token>" \
  -d '{ "role": "manager" }'
```

Response:

```json
{
  "org_id": "uuid-...",
  "user_id": "uuid-...",
  "role": "manager"
}
```

### Removing a Member (Soft Delete)

Remove a member from the organization. This sets `deleted_at` on the membership record rather than deleting it, allowing re-invitation later:

```bash
curl -X DELETE http://localhost:3000/orgs/{orgId}/members/{userId} \
  -H "Cookie: cs_access=<token>"
```

Response:

```json
{ "success": true }
```

> **Note:** Admins cannot remove themselves from the organization.

---

## 6. Invitation System

### Invite Lifecycle

```
Created → Pending → Accepted / Declined / Expired
```

1. **Created**: An admin or manager sends an invite to an email address
2. **Pending**: The invite awaits action from the invitee (valid for 7 days)
3. **Accepted**: The user joins the organization with the specified role
4. **Declined**: The user explicitly refuses the invite
5. **Expired**: The 7-day window passes without action

### Creating an Invite

Invite a user by email (requires `manager` or `admin` role):

```bash
curl -X POST http://localhost:3000/orgs/{orgId}/invites \
  -H "Content-Type: application/json" \
  -H "Cookie: cs_access=<token>" \
  -d '{
    "email": "carol@example.com",
    "role": "member"
  }'
```

Response:

```json
{
  "invite": {
    "id": "uuid-...",
    "org_id": "uuid-...",
    "email": "carol@example.com",
    "role": "member",
    "invited_by": "uuid-...",
    "status": "pending",
    "created_at": "2026-05-01T10:00:00Z",
    "expires_at": "2026-05-08T10:00:00Z"
  }
}
```

If the user is already a member, a `409 Conflict` is returned. Re-inviting the same email resets the invitation timer.

### Viewing Pending Invites (User)

An authenticated user can see all pending invites addressed to their email:

```bash
curl http://localhost:3000/auth/invites \
  -H "Cookie: cs_access=<token>"
```

Response:

```json
{
  "invites": [
    {
      "id": "uuid-...",
      "org_id": "uuid-...",
      "org_name": "Acme Corp",
      "org_slug": "acme-corp",
      "role": "member",
      "invited_by_name": "Alice",
      "created_at": "2026-05-01T10:00:00Z",
      "expires_at": "2026-05-08T10:00:00Z"
    }
  ]
}
```

### Accepting an Invite

```bash
curl -X POST http://localhost:3000/auth/invites/{inviteId}/accept \
  -H "Cookie: cs_access=<token>"
```

Response:

```json
{
  "message": "Invite accepted",
  "orgs": [
    { "id": "uuid-...", "name": "Personal Org", "slug": "personal", "role": "admin", "joined_at": "..." },
    { "id": "uuid-...", "name": "Acme Corp", "slug": "acme-corp", "role": "member", "joined_at": "..." }
  ]
}
```

### Declining an Invite

```bash
curl -X POST http://localhost:3000/auth/invites/{inviteId}/decline \
  -H "Cookie: cs_access=<token>"
```

Response:

```json
{ "message": "Invite declined" }
```

### Canceling an Invite (Org Admin/Manager)

```bash
curl -X DELETE http://localhost:3000/orgs/{orgId}/invites/{inviteId} \
  -H "Cookie: cs_access=<token>"
```

Response:

```json
{ "message": "Invite cancelled" }
```

### Listing Org Invites (Admin/Manager)

View all active pending invites for the organization:

```bash
curl http://localhost:3000/orgs/{orgId}/invites \
  -H "Cookie: cs_access=<token>"
```

Response:

```json
{
  "invites": [
    {
      "id": "uuid-...",
      "email": "carol@example.com",
      "role": "member",
      "invited_by_name": "Alice",
      "invited_by_email": "alice@acme.com",
      "created_at": "2026-05-01T10:00:00Z",
      "expires_at": "2026-05-08T10:00:00Z"
    }
  ]
}
```

---

## 7. Organization Switching

### How It Works

When a user switches organizations, a new JWT token pair is issued with the target organization's `org_id` and the user's role in that org embedded in the claims. This ensures all subsequent API calls are scoped to the correct organization.

### Flow

1. User calls `POST /auth/switch-org` with the target `orgId`
2. Server verifies membership via `getUserRoleInOrg()`
3. Server generates new access + refresh tokens with updated `org_id` and `role`
4. New tokens are set as HTTP-only cookies
5. Updated user context and full org list returned in response

### Switching Organizations

```bash
curl -X POST http://localhost:3000/auth/switch-org \
  -H "Content-Type: application/json" \
  -H "Cookie: cs_access=<token>" \
  -d '{ "orgId": "target-org-uuid" }'
```

Response:

```json
{
  "accessToken": "eyJhbG...",
  "user": { "id": "uuid-...", "email": "alice@acme.com", "orgId": "target-org-uuid", "role": "member" },
  "orgs": [
    { "id": "uuid-1", "name": "Personal Org", "slug": "personal", "role": "admin", "joined_at": "..." },
    { "id": "uuid-2", "name": "Acme Corp", "slug": "acme-corp", "role": "member", "joined_at": "..." }
  ]
}
```

### Listing User Organizations

```bash
curl http://localhost:3000/auth/orgs \
  -H "Cookie: cs_access=<token>"
```

Response:

```json
{
  "orgs": [
    { "id": "uuid-...", "name": "My Org", "slug": "my-org", "role": "admin", "joined_at": "2026-04-01T00:00:00Z" },
    { "id": "uuid-...", "name": "Client Org", "slug": "client-org", "role": "viewer", "joined_at": "2026-04-15T00:00:00Z" }
  ]
}
```

---

## 8. Frontend Integration

### OrgSwitcher Component

The `OrgSwitcher` component provides a dropdown for users to switch between their organizations in real-time. It:

- Displays the current organization name
- Lists all organizations the user belongs to with their role
- Calls `POST /auth/switch-org` on selection
- Updates the global auth context after switching

### AuthProvider Orgs Context

The `AuthProvider` component manages organization state:

- On login/refresh, the full org list is stored in context
- `currentOrg` tracks the active organization
- After switching orgs, the provider refreshes user state with the new token
- The org list is updated whenever invites are accepted

### Settings Team Management

The Settings page includes a team management section where admins can:

- View all org members with their roles
- Send invitations to new team members
- Update member roles via dropdown
- Remove members from the organization
- View and cancel pending invitations

---

## 9. API Reference

### Authentication Endpoints

#### GET /auth/orgs

List all organizations the authenticated user belongs to.

- **Auth:** Required (cookie-based JWT)
- **Role:** Any authenticated user

#### POST /auth/switch-org

Switch the active organization context. Issues new token pair.

- **Auth:** Required
- **Body:** `{ "orgId": "uuid" }`
- **Errors:** `400` if orgId missing, `403` if not a member

#### GET /auth/invites

List pending invitations for the authenticated user (matched by email).

- **Auth:** Required
- **Role:** Any authenticated user

#### POST /auth/invites/:inviteId/accept

Accept a pending organization invite. Adds user to org_members.

- **Auth:** Required
- **Errors:** `404` if not found/processed, `403` if wrong user, `410` if expired

#### POST /auth/invites/:inviteId/decline

Decline a pending organization invite. Marks invite as declined.

- **Auth:** Required
- **Errors:** `404` if not found/processed, `403` if wrong user

### Organization Endpoints

#### POST /orgs/:orgId/invite

Invite a user to the organization (legacy endpoint).

- **Auth:** Required
- **Role:** `manager` or `admin`
- **Body:** `{ "email": "user@example.com", "role": "member" }`

#### POST /orgs/:orgId/invites

Create an invitation (preferred endpoint). Checks for existing membership.

- **Auth:** Required
- **Role:** `manager` or `admin`
- **Body:** `{ "email": "user@example.com", "role": "member" }`
- **Errors:** `409` if user already a member

#### GET /orgs/:orgId/invites

List all pending (non-expired) invites for the organization.

- **Auth:** Required
- **Role:** `manager` or `admin`

#### DELETE /orgs/:orgId/invites/:inviteId

Cancel a pending invite (hard delete).

- **Auth:** Required
- **Role:** `manager` or `admin`
- **Errors:** `404` if invite not found

#### GET /orgs/:orgId/members

List all active members of the organization.

- **Auth:** Required
- **Role:** `manager` or `admin`

#### PUT /orgs/:orgId/members/:userId

Update a member's role.

- **Auth:** Required
- **Role:** `admin`
- **Body:** `{ "role": "manager" }`
- **Errors:** `400` if changing own role, `404` if member not found

#### DELETE /orgs/:orgId/members/:userId

Soft-remove a member from the organization.

- **Auth:** Required
- **Role:** `admin`
- **Scope:** `admin`
- **Errors:** `400` if removing self, `404` if member not found

---

## 10. Security Considerations

### orgContext Middleware — Tenant Isolation

Every organization-scoped route passes through the `orgContext` middleware, which:

1. Extracts the `:orgId` from route parameters
2. Queries `org_members` to verify the authenticated user has an active (non-deleted) membership
3. Caches the membership role on `req.orgMember` for downstream use
4. Rejects requests with `403 Access denied` if no valid membership exists

This ensures that even if a user guesses another org's UUID, they cannot access its resources.

### JWT Re-Issuance on Org Switch

When switching organizations:

- A completely new token pair (access + refresh) is generated
- The new JWT embeds the target org's `org_id` and the user's role in that org
- The old token is not explicitly revoked (it expires naturally)
- All subsequent middleware reads the org context from the fresh JWT

### Role Fallback

The `authorize` middleware uses a fallback strategy for role resolution:

```javascript
const userRole = (req.orgMember && req.orgMember.role) || req.user.role;
```

1. **Primary:** Live role from `org_members` (set by `orgContext` middleware)
2. **Fallback:** Role from the JWT token (from `req.user.role`)

This ensures authorization works correctly even if the orgContext middleware hasn't run (e.g., for non-org-scoped routes).

### Invitation Security

- Invites are email-bound: only the user whose email matches can accept
- 7-day automatic expiration prevents stale invites
- `UNIQUE(org_id, email)` prevents invite spam to the same address
- Role escalation is blocked: inviters cannot assign roles higher than their own
- Expired invites are excluded from all query results via `expires_at > NOW()` filters

### Soft Delete

Member removal uses soft delete (`deleted_at` timestamp) rather than hard delete. This:

- Preserves audit history
- Allows re-invitation without data loss
- Maintains referential integrity for historical records
