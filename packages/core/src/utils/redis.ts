// packages/core/src/utils/redis.ts

import Redis from 'ioredis';

export interface RedisConfig {
  url: string;
  keyPrefix?: string;
}

export class RedisClient {
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private keyPrefix: string;

  constructor(config: RedisConfig) {
    this.keyPrefix = config.keyPrefix || 'omniswap:';

    // Parse URL to check for TLS (rediss://)
    const isTLS = config.url.startsWith('rediss://');
    
    const redisOptions: any = {
      keyPrefix: this.keyPrefix,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      // Enable TLS for Upstash (rediss://)
      ...(isTLS && { tls: { rejectUnauthorized: false } }),
    };

    // Main client for get/set operations
    this.client = new Redis(config.url, redisOptions);

    // Separate clients for pub/sub (without keyPrefix)
    const pubSubOptions: any = {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      ...(isTLS && { tls: { rejectUnauthorized: false } }),
    };

    this.subscriber = new Redis(config.url, pubSubOptions);
    this.publisher = new Redis(config.url, pubSubOptions);

    this.client.on('error', (err) => console.error('Redis Client Error:', err));
    this.client.on('connect', () => console.log('Redis Client connected'));
    this.subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));
    this.publisher.on('error', (err) => console.error('Redis Publisher Error:', err));
  }

  // ============ Basic Operations ============

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  // ============ JSON Operations ============

  async getJson<T>(key: string): Promise<T | null> {
    const data = await this.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  // ============ Hash Operations ============

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.client.hdel(key, field);
  }

  // ============ Pub/Sub ============

  async publish(channel: string, message: any): Promise<void> {
    const fullChannel = `${this.keyPrefix}${channel}`;
    await this.publisher.publish(fullChannel, JSON.stringify(message));
  }

  async subscribe(
    channel: string,
    callback: (message: any) => void
  ): Promise<void> {
    const fullChannel = `${this.keyPrefix}${channel}`;

    await this.subscriber.subscribe(fullChannel);

    this.subscriber.on('message', (ch, message) => {
      if (ch === fullChannel) {
        try {
          callback(JSON.parse(message));
        } catch {
          callback(message);
        }
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    const fullChannel = `${this.keyPrefix}${channel}`;
    await this.subscriber.unsubscribe(fullChannel);
  }

  // ============ List Operations (for queues) ============

  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.client.lpush(key, ...values);
  }

  async rpop(key: string): Promise<string | null> {
    return this.client.rpop(key);
  }

  async brpop(key: string, timeout: number): Promise<[string, string] | null> {
    return this.client.brpop(key, timeout);
  }

  async llen(key: string): Promise<number> {
    return this.client.llen(key);
  }

  // ============ Sorted Set Operations ============

  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.client.zadd(key, score, member);
  }

  async zrangebyscore(
    key: string,
    min: number,
    max: number
  ): Promise<string[]> {
    return this.client.zrangebyscore(key, min, max);
  }

  async zrem(key: string, member: string): Promise<void> {
    await this.client.zrem(key, member);
  }

  // ============ Utility ============

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    await this.subscriber.quit();
    await this.publisher.quit();
  }

  // Get the raw ioredis client (for BullMQ compatibility)
  getRawClient(): Redis {
    return this.client;
  }
}

// Singleton instance
let redisInstance: RedisClient | null = null;

export function getRedis(config?: RedisConfig): RedisClient {
  if (!redisInstance && config) {
    redisInstance = new RedisClient(config);
  }
  if (!redisInstance) {
    throw new Error('Redis not initialized. Call getRedis with config first.');
  }
  return redisInstance;
}

// Export type for ioredis
export type { Redis };
