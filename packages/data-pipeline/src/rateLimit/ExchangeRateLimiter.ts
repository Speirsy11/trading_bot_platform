import type Redis from "ioredis";

import { RATE_LIMIT_DEFAULTS, type RateLimitOptions } from "./RateLimitConfig.js";

export class ExchangeRateLimiter {
  private redis: Redis | null;
  private configs: Map<string, RateLimitOptions>;
  // In-memory fallback when Redis is not available
  private localWindows: Map<string, number[]>;

  constructor(redis?: Redis) {
    this.redis = redis ?? null;
    this.configs = new Map(Object.entries(RATE_LIMIT_DEFAULTS));
    this.localWindows = new Map();
  }

  setConfig(exchange: string, config: RateLimitOptions) {
    this.configs.set(exchange, config);
  }

  private getConfig(exchange: string): RateLimitOptions {
    return this.configs.get(exchange) ?? { maxRequests: 10, windowMs: 1_000 };
  }

  async acquire(exchange: string): Promise<{ allowed: boolean; waitMs: number }> {
    if (this.redis) {
      return this.acquireRedis(exchange);
    }
    return this.acquireLocal(exchange);
  }

  private async acquireRedis(exchange: string): Promise<{ allowed: boolean; waitMs: number }> {
    const config = this.getConfig(exchange);
    const key = `ratelimit:${exchange}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    const pipeline = this.redis!.pipeline();
    // Remove expired entries
    pipeline.zremrangebyscore(key, 0, windowStart);
    // Count current window
    pipeline.zcard(key);
    // Add current request
    pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);
    // Set TTL
    pipeline.pexpire(key, config.windowMs);

    const results = await pipeline.exec();
    const currentCount = (results?.[1]?.[1] as number) ?? 0;

    if (currentCount >= config.maxRequests) {
      // Find the oldest entry to compute wait time
      const oldest = await this.redis!.zrange(key, 0, 0, "WITHSCORES");
      const oldestTs = oldest.length >= 2 ? parseInt(oldest[1]!, 10) : now;
      const waitMs = Math.max(0, oldestTs + config.windowMs - now);
      // Remove the entry we just added since request is denied
      await this.redis!.zremrangebyscore(key, now.toString(), now.toString());
      return { allowed: false, waitMs };
    }

    return { allowed: true, waitMs: 0 };
  }

  private acquireLocal(exchange: string): { allowed: boolean; waitMs: number } {
    const config = this.getConfig(exchange);
    const key = exchange;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let timestamps = this.localWindows.get(key) ?? [];
    // Remove expired
    timestamps = timestamps.filter((ts) => ts > windowStart);

    if (timestamps.length >= config.maxRequests) {
      const oldest = timestamps[0]!;
      const waitMs = Math.max(0, oldest + config.windowMs - now);
      this.localWindows.set(key, timestamps);
      return { allowed: false, waitMs };
    }

    timestamps.push(now);
    this.localWindows.set(key, timestamps);
    return { allowed: true, waitMs: 0 };
  }

  async waitForSlot(exchange: string): Promise<void> {
    let result = await this.acquire(exchange);
    while (!result.allowed) {
      await new Promise((resolve) => setTimeout(resolve, result.waitMs));
      result = await this.acquire(exchange);
    }
  }
}
