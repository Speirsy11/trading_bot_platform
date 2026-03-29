export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMIT_DEFAULTS: Record<string, RateLimitOptions> = {
  binance: { maxRequests: 1200, windowMs: 60_000 },
  kraken: { maxRequests: 15, windowMs: 1_000 },
  kucoin: { maxRequests: 10, windowMs: 1_000 },
  bybit: { maxRequests: 10, windowMs: 1_000 },
  coinbase: { maxRequests: 30, windowMs: 1_000 },
};
