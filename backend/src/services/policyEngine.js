/**
 * Policy Engine
 * Evaluates events against policy rules and executes actions
 */

const { query } = require('../models/db');
const eventBus = require('./eventBus');
const { invalidateAgentCaches } = require('./badgeBuilder');
const { getLogger } = require('../utils/logger');

const VALID_ACTIONS = ['revoke', 'flag', 'notify', 'disable'];
const VALID_OPERATORS = ['<', '>', '<=', '>=', '==', '!=', 'contains'];

/**
 * Evaluate a condition against event data
 * @param {Object} condition - Condition object with field/op/value or event_type
 * @param {Object} event - Event object
 * @returns {boolean}
 */
function evaluateCondition(condition, event) {
  if (!condition || typeof condition !== 'object') {
    return false;
  }

  if (condition.event_type !== undefined) {
    return event.type === condition.event_type;
  }

  if (condition.field === undefined || condition.op === undefined || condition.value === undefined) {
    return false;
  }

  const fieldValue = event.data ? event.data[condition.field] : undefined;
  const targetValue = condition.value;

  switch (condition.op) {
    case '<':
      return fieldValue < targetValue;
    case '>':
      return fieldValue > targetValue;
    case '<=':
      return fieldValue <= targetValue;
    case '>=':
      return fieldValue >= targetValue;
    case '==':
      return fieldValue === targetValue;
    case '!=':
      return fieldValue !== targetValue;
    case 'contains':
      if (typeof fieldValue === 'string' && typeof targetValue === 'string') {
        return fieldValue.includes(targetValue);
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(targetValue);
      }
      return false;
    default:
      return false;
  }
}

/**
 * Execute a policy action
 * @param {Object} rule - Policy rule row
 * @param {Object} event - Event that triggered the rule
 * @returns {Object}
 */
async function executeAction(rule, event) {
  const agentId = event.data ? event.data.agentId : null;
  const result = {
    ruleId: rule.id,
    action: rule.action,
    executed: true
  };

  try {
    switch (rule.action) {
      case 'revoke': {
        if (agentId) {
          await query(
            "UPDATE agent_identities SET status = 'revoked', revoked_at = NOW() WHERE agent_id = $1",
            [agentId]
          );
          await invalidateAgentCaches(agentId);
          getLogger().info(`[PolicyEngine] Revoked agent ${agentId} via rule ${rule.id}`);
        }
        break;
      }
      case 'flag': {
        if (agentId) {
          const agentResult = await query(
            'SELECT pubkey FROM agent_identities WHERE agent_id = $1',
            [agentId]
          );
          const pubkey = agentResult.rows.length > 0 ? agentResult.rows[0].pubkey : 'unknown';
          await query(
            `INSERT INTO agent_flags (agent_id, pubkey, reporter_pubkey, reason)
             VALUES ($1, $2, $3, $4)`,
            [agentId, pubkey, 'system', `Policy rule triggered: ${rule.name}`]
          );
          await invalidateAgentCaches(agentId);
          getLogger().info(`[PolicyEngine] Flagged agent ${agentId} via rule ${rule.id}`);
        }
        break;
      }
      case 'notify': {
        await eventBus.publish('policy.triggered', {
          ruleId: rule.id,
          ruleName: rule.name,
          action: rule.action,
          condition: rule.condition,
          eventType: event.type,
          orgId: event.data ? event.data.orgId : null,
          agentId
        });
        getLogger().info(`[PolicyEngine] Notified for rule ${rule.id}`);
        break;
      }
      case 'disable': {
        if (agentId) {
          await query(
            "UPDATE agent_identities SET status = 'disabled' WHERE agent_id = $1",
            [agentId]
          );
          await invalidateAgentCaches(agentId);
          getLogger().info(`[PolicyEngine] Disabled agent ${agentId} via rule ${rule.id}`);
        }
        break;
      }
      default:
        result.executed = false;
        getLogger().warn(`[PolicyEngine] Unknown action: ${rule.action}`);
    }
  } catch (err) {
    result.executed = false;
    result.error = err.message;
    getLogger().error({ err }, `[PolicyEngine] Action execution failed for rule ${rule.id}`);
  }

  return result;
}

/**
 * Evaluate an event against all enabled policy rules for its organization
 * @param {Object} event - Event object
 * @returns {Array}
 */
async function evaluateEvent(event) {
  const startTime = Date.now();
  const orgId = event.data ? event.data.orgId : null;
  if (!orgId) {
    return [];
  }

  try {
    const result = await query(
      'SELECT * FROM policy_rules WHERE org_id = $1 AND enabled = true',
      [orgId]
    );

    const matched = result.rows.filter(rule => evaluateCondition(rule.condition, event));
    const results = await Promise.allSettled(
      matched.map(rule => executeAction(rule, event))
    );
    const triggered = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    const elapsed = Date.now() - startTime;
    if (elapsed > 100) {
      getLogger().warn(`[PolicyEngine] Slow rule evaluation: ${elapsed}ms for event ${event.type} (${matched.length} rules)`);
    }

    return triggered;
  } catch (err) {
    getLogger().error({ err }, '[PolicyEngine] Error evaluating event');
    return [];
  }
}

/**
 * Initialize policy listeners on the event bus
 * Should be called once at server startup
 */
function initPolicyListeners() {
  eventBus.on('*', (event) => {
    evaluateEvent(event).catch((err) => {
      getLogger().error({ err }, '[PolicyEngine] Listener error');
    });
  });
  getLogger().info('[PolicyEngine] Policy listeners initialized');
}

module.exports = {
  evaluateEvent,
  evaluateCondition,
  executeAction,
  initPolicyListeners
};
