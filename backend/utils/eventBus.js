const EventEmitter = require('events');
const logger = require('./logger');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(10000);
    this.redisPublisher = null;
    this.redisSubscriber = null;
    this.isRedisReady = false;
    this.channel = 'shortly:events:clicks';
    this.initRedis();
  }

  async initRedis() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return;

    try {
      const { createClient } = require('redis');
      this.redisPublisher = createClient({ url: redisUrl });
      this.redisSubscriber = createClient({ url: redisUrl });

      this.redisPublisher.on('error', (err) => {
        this.isRedisReady = false;
        logger.warn({ err: err.message }, 'EventBus Redis publisher error');
      });

      this.redisSubscriber.on('error', (err) => {
        this.isRedisReady = false;
        logger.warn({ err: err.message }, 'EventBus Redis subscriber error');
      });

      await Promise.all([this.redisPublisher.connect(), this.redisSubscriber.connect()]);

      await this.redisSubscriber.subscribe(this.channel, (message) => {
        try {
          const parsed = JSON.parse(message);
          super.emit('click', parsed);
        } catch (err) {
          logger.error({ err: err.message }, 'Failed to parse distributed click event');
        }
      });

      this.isRedisReady = true;
      logger.info('EventBus Redis pub/sub connected successfully');
    } catch (err) {
      this.isRedisReady = false;
      logger.warn({ err: err.message }, 'Redis pub/sub unavailable, using in-memory event bus');
    }
  }

  publishClick(eventData) {
    // Emit locally immediately for zero-latency local SSE clients
    if (!this.isRedisReady) {
      super.emit('click', eventData);
      return;
    }

    // Publish to Redis for distributed cluster broadcasting
    this.redisPublisher.publish(this.channel, JSON.stringify(eventData)).catch((err) => {
      logger.warn({ err: err.message }, 'Failed to publish click to Redis, falling back to local emit');
      super.emit('click', eventData);
    });
  }

  async close() {
    if (this.redisSubscriber) {
      try {
        await this.redisSubscriber.unsubscribe(this.channel);
        await this.redisSubscriber.quit();
      } catch {}
    }
    if (this.redisPublisher) {
      try {
        await this.redisPublisher.quit();
      } catch {}
    }
  }
}

const eventBus = new EventBus();

module.exports = eventBus;
