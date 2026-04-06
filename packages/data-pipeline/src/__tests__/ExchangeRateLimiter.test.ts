import { describe, it, expect, beforeEach } from "vitest";

import { ExchangeRateLimiter } from "../rateLimit/ExchangeRateLimiter";

describe("ExchangeRateLimiter", () => {
  describe("local mode (no Redis)", () => {
    let limiter: ExchangeRateLimiter;

    beforeEach(() => {
      limiter = new ExchangeRateLimiter();
    });

    it("allows requests within rate limit", async () => {
      // Set a generous limit for testing
      limiter.setConfig("test-exchange", { maxRequests: 5, windowMs: 1000 });

      const r1 = await limiter.acquire("test-exchange");
      expect(r1.allowed).toBe(true);

      const r2 = await limiter.acquire("test-exchange");
      expect(r2.allowed).toBe(true);
    });

    it("blocks requests exceeding rate limit", async () => {
      limiter.setConfig("test-exchange", { maxRequests: 2, windowMs: 10_000 });

      await limiter.acquire("test-exchange"); // 1
      await limiter.acquire("test-exchange"); // 2

      const r3 = await limiter.acquire("test-exchange");
      expect(r3.allowed).toBe(false);
      expect(r3.waitMs).toBeGreaterThan(0);
    });

    it("allows requests after window expires", async () => {
      limiter.setConfig("test-exchange", { maxRequests: 1, windowMs: 50 });

      await limiter.acquire("test-exchange"); // 1

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      const r2 = await limiter.acquire("test-exchange");
      expect(r2.allowed).toBe(true);
    });

    it("uses default config for unknown exchanges", async () => {
      const result = await limiter.acquire("unknown-exchange");
      expect(result.allowed).toBe(true);
    });

    it("tracks separate windows per exchange", async () => {
      limiter.setConfig("exchange-a", { maxRequests: 1, windowMs: 10_000 });
      limiter.setConfig("exchange-b", { maxRequests: 1, windowMs: 10_000 });

      await limiter.acquire("exchange-a");
      await limiter.acquire("exchange-b");

      const r1 = await limiter.acquire("exchange-a");
      expect(r1.allowed).toBe(false);

      const r2 = await limiter.acquire("exchange-b");
      expect(r2.allowed).toBe(false);
    });
  });
});
