/** In-memory sliding-window per-token rate limiter. No Redis required. */

interface WindowEntry {
  count: number;
  resetAt: number;
}

export interface TokenRateLimiter {
  /** Returns true if the request is allowed; false if the limit is exceeded. */
  check(token: string, nowMs?: number): boolean;
  /** Clears all state — useful for tests. */
  reset(): void;
}

export function createTokenRateLimiter(limitPerMinute: number): TokenRateLimiter {
  const counters = new Map<string, WindowEntry>();

  return {
    check(token: string, nowMs: number = Date.now()): boolean {
      const entry = counters.get(token);

      if (!entry || entry.resetAt < nowMs) {
        counters.set(token, { count: 1, resetAt: nowMs + 60_000 });
        return true;
      }

      entry.count++;
      return entry.count <= limitPerMinute;
    },

    reset(): void {
      counters.clear();
    },
  };
}

/**
 * Lazily-created singleton, respecting PER_TOKEN_RATE_LIMIT at construction time.
 * Recreated if the env var has changed (test-friendly via reset()).
 */
let _limiter: TokenRateLimiter | null = null;
let _limiterCreatedWithLimit: number | null = null;

export function getTokenRateLimiter(): TokenRateLimiter {
  const limit = Number(process.env["PER_TOKEN_RATE_LIMIT"] ?? 60);
  if (!_limiter || _limiterCreatedWithLimit !== limit) {
    _limiter = createTokenRateLimiter(limit);
    _limiterCreatedWithLimit = limit;
  }
  return _limiter;
}
