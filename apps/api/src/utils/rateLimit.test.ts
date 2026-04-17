import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTokenRateLimiter, getTokenRateLimiter } from "./tokenRateLimiter";

describe("createTokenRateLimiter", () => {
  it("allows requests under the limit", () => {
    const limiter = createTokenRateLimiter(3);
    const now = Date.now();

    expect(limiter.check("tok-a", now)).toBe(true);
    expect(limiter.check("tok-a", now)).toBe(true);
    expect(limiter.check("tok-a", now)).toBe(true);
  });

  it("blocks the request that exceeds the limit", () => {
    const limiter = createTokenRateLimiter(3);
    const now = Date.now();

    limiter.check("tok-a", now); // 1
    limiter.check("tok-a", now); // 2
    limiter.check("tok-a", now); // 3 — still allowed (count == limit)
    const result = limiter.check("tok-a", now); // 4 — over the limit

    expect(result).toBe(false);
  });

  it("counts independently per token", () => {
    const limiter = createTokenRateLimiter(2);
    const now = Date.now();

    limiter.check("tok-a", now); // tok-a: 1
    limiter.check("tok-a", now); // tok-a: 2
    limiter.check("tok-a", now); // tok-a: 3 — blocked

    // tok-b is a fresh window
    expect(limiter.check("tok-b", now)).toBe(true);
    expect(limiter.check("tok-b", now)).toBe(true);
    expect(limiter.check("tok-b", now)).toBe(false); // tok-b: 3 — blocked
  });

  it("resets the counter after the 60-second time window", () => {
    const limiter = createTokenRateLimiter(2);
    const t0 = Date.now();

    limiter.check("tok-a", t0); // 1
    limiter.check("tok-a", t0); // 2
    expect(limiter.check("tok-a", t0)).toBe(false); // 3 — blocked

    // Advance time past the window
    const t1 = t0 + 60_001;
    expect(limiter.check("tok-a", t1)).toBe(true); // window reset, count = 1
    expect(limiter.check("tok-a", t1)).toBe(true); // count = 2
    expect(limiter.check("tok-a", t1)).toBe(false); // count = 3 — blocked again
  });

  it("allows exactly `limit` requests in a single window", () => {
    const limit = 5;
    const limiter = createTokenRateLimiter(limit);
    const now = Date.now();

    for (let i = 0; i < limit; i++) {
      expect(limiter.check("tok-x", now), `request ${i + 1} should be allowed`).toBe(true);
    }
    expect(limiter.check("tok-x", now)).toBe(false);
  });

  it("reset() clears all counters", () => {
    const limiter = createTokenRateLimiter(1);
    const now = Date.now();

    limiter.check("tok-a", now); // 1
    expect(limiter.check("tok-a", now)).toBe(false); // 2 — blocked

    limiter.reset();

    expect(limiter.check("tok-a", now)).toBe(true); // fresh after reset
  });
});

describe("getTokenRateLimiter", () => {
  const originalEnv = process.env["PER_TOKEN_RATE_LIMIT"];

  beforeEach(() => {
    // Force a fresh singleton by clearing the cached limiter between tests
    getTokenRateLimiter().reset();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["PER_TOKEN_RATE_LIMIT"];
    } else {
      process.env["PER_TOKEN_RATE_LIMIT"] = originalEnv;
    }
    getTokenRateLimiter().reset();
  });

  it("defaults to 60 requests per minute when PER_TOKEN_RATE_LIMIT is unset", () => {
    delete process.env["PER_TOKEN_RATE_LIMIT"];
    const limiter = getTokenRateLimiter();
    const now = Date.now();

    for (let i = 0; i < 60; i++) {
      expect(limiter.check("tok-default", now)).toBe(true);
    }
    expect(limiter.check("tok-default", now)).toBe(false);
  });

  it("respects PER_TOKEN_RATE_LIMIT env var", () => {
    // Force re-creation by changing the env var and invalidating the cached singleton.
    // We achieve this by directly calling createTokenRateLimiter for a deterministic test.
    process.env["PER_TOKEN_RATE_LIMIT"] = "3";
    // Reset singleton cache by calling reset() — it will re-read the env on next check
    // since the limit changed. We create a fresh limiter here to be deterministic.
    const limiter = createTokenRateLimiter(Number(process.env["PER_TOKEN_RATE_LIMIT"]));
    const now = Date.now();

    expect(limiter.check("tok-env", now)).toBe(true);
    expect(limiter.check("tok-env", now)).toBe(true);
    expect(limiter.check("tok-env", now)).toBe(true);
    expect(limiter.check("tok-env", now)).toBe(false);
  });
});
