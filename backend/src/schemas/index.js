/**
 * Zod Validation Schemas
 * Centralized input validation for all mutation endpoints.
 */

const { z } = require('zod');

// ── Shared field schemas ──────────────────────────────────
const nameField = z.string().min(1, 'Name is required').max(255).trim();
const descriptionField = z.string().max(5000).optional();
const tokenMintField = z.string().max(88).optional();
const creatorXField = z.string().max(255).optional();
const creatorWalletField = z.string().max(88).optional();
const signatureField = z.string().min(1, 'Signature is required').max(512);
const capabilitiesField = z.array(z.string().max(64)).max(50).optional();

// ── Agent Update ──────────────────────────────────────────
const agentUpdateSchema = z.object({
  signature: signatureField,
  timestamp: z.number({ required_error: 'Timestamp is required' }),
  name: z.string().min(1).max(255).trim().optional(),
  tokenMint: tokenMintField,
  capabilities: capabilitiesField,
  creatorX: creatorXField,
  description: descriptionField,
}).passthrough(); // allow extra fields like chainType that may be sent

// ── Attestation ───────────────────────────────────────────
const attestationSchema = z.object({
  success: z.boolean({ required_error: 'success is required and must be a boolean' }),
  action: z.string().max(100).regex(/^[a-zA-Z0-9._:-]+$/, 'action must contain only alphanumeric characters, dots, hyphens, underscores, and colons').optional(),
}).passthrough();

// ── Registration (crypto) ─────────────────────────────────
const cryptoRegistrationSchema = z.object({
  credential_type: z.literal('crypto').default('crypto'),
  pubkey: z.string().min(32).max(130),
  name: nameField,
  signature: signatureField,
  message: z.string().min(1).max(2048),
  nonce: z.string().min(1).max(256),
  tokenMint: tokenMintField,
  capabilities: capabilitiesField,
  creatorX: creatorXField,
  creatorWallet: creatorWalletField,
  description: descriptionField,
  chainType: z.string().max(50).optional(),
  isDemo: z.boolean().optional(),
}).passthrough();

// ── Registration (oauth2/entra_id) ────────────────────────
const oauthRegistrationSchema = z.object({
  credential_type: z.enum(['oauth2', 'entra_id']),
  token: z.string().min(1).max(8192),
  name: nameField,
  description: descriptionField,
  capabilities: capabilitiesField,
}).passthrough();

// ── Policy ────────────────────────────────────────────────
const VALID_OPERATORS = ['<', '>', '<=', '>=', '==', '!=', 'contains'];
const VALID_ACTIONS = ['revoke', 'flag', 'notify', 'disable'];

const policySchema = z.object({
  name: nameField,
  condition: z.object({
    field: z.string().max(100).optional(),
    event_type: z.string().max(100).optional(),
    op: z.enum(VALID_OPERATORS).optional(),
    value: z.union([z.string().max(1000), z.number(), z.boolean()]).optional(),
  }).refine(c => c.field || c.event_type, {
    message: "Condition must have 'field' or 'event_type'",
  }).refine(c => !c.field || c.op, {
    message: "Condition with 'field' requires 'op'",
  }),
  action: z.enum(VALID_ACTIONS),
  enabled: z.boolean().default(true),
}).passthrough();

// ── Identity Provider ─────────────────────────────────────
const identityProviderSchema = z.object({
  providerType: z.enum(['oauth2', 'entra_id', 'okta', 'auth0']),
  issuerUrl: z.string().url('issuerUrl must be a valid URL').max(500),
  clientId: z.string().max(255).optional(),
  allowedAudiences: z.array(z.string().max(255)).max(20).default([]),
  claimMappings: z.record(z.string().max(100), z.string().max(255)).optional().default({}),
  enabled: z.boolean().default(true),
}).passthrough();

// ── Webhook ───────────────────────────────────────────────
const VALID_EVENTS = [
  'agent.registered', 'agent.updated', 'agent.revoked',
  'agent.flagged', 'agent.verified', 'attestation.created',
  'policy.triggered',
];

const eventFiltersSchema = z.object({
  agentId: z.string().uuid().optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  actions: z.array(z.string().max(50)).max(10).optional(),
  eventPattern: z.string().max(100).optional(),
}).optional().nullable();

const transformTemplateSchema = z.record(z.string().max(50), z.string().max(200))
  .optional().nullable();

const webhookSchema = z.object({
  url: z.string().max(2000).url('Webhook URL must be a valid URL'),
  events: z.array(z.enum(VALID_EVENTS)).min(1, 'At least one event type is required').max(20),
  secret: z.string().min(32, 'Custom webhook secret must be at least 32 characters').max(255).optional(),
  event_filters: eventFiltersSchema,
  transform_template: transformTemplateSchema,
}).passthrough();

const webhookUpdateSchema = z.object({
  url: z.string().max(2000).url('Webhook URL must be a valid URL').optional(),
  events: z.array(z.enum(VALID_EVENTS)).min(1).max(20).optional(),
  enabled: z.boolean().optional(),
  event_filters: eventFiltersSchema,
  transform_template: transformTemplateSchema,
}).passthrough();

// ── API Key ───────────────────────────────────────────────
const VALID_SCOPES = [
  'read', 'write',
  'agents:read', 'agents:write',
  'audit:read', 'audit:export',
  'webhooks:read', 'webhooks:write',
  'policies:read', 'policies:write',
  'org:read', 'org:write',
  'admin',
];

const apiKeySchema = z.object({
  name: nameField,
  scopes: z.array(z.enum(VALID_SCOPES)).min(1).default(['read']),
  expiresAt: z.string().optional(),
}).passthrough();

module.exports = {
  agentUpdateSchema,
  attestationSchema,
  cryptoRegistrationSchema,
  oauthRegistrationSchema,
  policySchema,
  identityProviderSchema,
  webhookSchema,
  webhookUpdateSchema,
  apiKeySchema,
  VALID_EVENTS,
  VALID_OPERATORS,
  VALID_ACTIONS,
  VALID_SCOPES,
};
