/**
 * Hybrid Event Bus
 * Uses Node.js EventEmitter + Redis pub/sub for multi-instance support
 */

const EventEmitter = require('events');
const { redis } = require('../models/redis');

class AgentEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    this.channel = 'agentid:events';
    this.subscriber = null;
    this._setupRedisSubscriber();
  }

  _setupRedisSubscriber() {
    try {
      if (redis && typeof redis.duplicate === 'function') {
        this.subscriber = redis.duplicate();
        this.subscriber.subscribe(this.channel, (err) => {
          if (err) {
            console.warn('[EventBus] Redis subscribe failed:', err.message);
          }
        });
        this.subscriber.on('message', (channel, message) => {
          if (channel === this.channel) {
            try {
              const event = JSON.parse(message);
              event._remote = true;
              super.emit(event.type, event);
              super.emit('*', event);
            } catch (parseErr) {
              console.error('[EventBus] Failed to parse Redis message:', parseErr.message);
            }
          }
        });
      }
    } catch (err) {
      console.warn('[EventBus] Redis pub/sub not available, using local only:', err.message);
    }
  }

  async publish(type, data) {
    const event = {
      type,
      data,
      timestamp: new Date().toISOString(),
      id: require('crypto').randomUUID()
    };

    super.emit(type, event);
    super.emit('*', event);

    try {
      if (redis && !event._remote) {
        await redis.publish(this.channel, JSON.stringify(event));
      }
    } catch (err) {
      console.error('[EventBus] Redis publish failed:', err.message);
    }

    return event;
  }

  async shutdown() {
    if (this.subscriber) {
      try {
        await this.subscriber.unsubscribe(this.channel);
        await this.subscriber.quit();
      } catch (err) {
        console.warn('[EventBus] Error shutting down Redis subscriber:', err.message);
      }
    }
    this.removeAllListeners();
  }
}

const eventBus = new AgentEventBus();
module.exports = eventBus;
