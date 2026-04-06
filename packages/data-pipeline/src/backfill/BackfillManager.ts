import type { Database } from "@tb/db";

import type { ExchangeRateLimiter } from "../rateLimit/ExchangeRateLimiter";

import { BackfillJob, type BackfillJobConfig } from "./BackfillJob";

const TIMEFRAME_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

const MAX_CANDLES_PER_REQUEST: Record<string, number> = {
  binance: 1000,
  kraken: 720,
  kucoin: 1500,
  bybit: 200,
  coinbase: 300,
};

export class BackfillManager {
  private db: Database;
  private rateLimiter: ExchangeRateLimiter;

  constructor(db: Database, rateLimiter: ExchangeRateLimiter) {
    this.db = db;
    this.rateLimiter = rateLimiter;
  }

  prioritize(
    exchange: string,
    symbol: string,
    timeframe: string,
    startTime: Date,
    endTime: Date
  ): number {
    const now = Date.now();
    const daysSinceEnd = (now - endTime.getTime()) / (24 * 60 * 60_000);

    // Recent data = higher priority
    let priority = Math.floor(daysSinceEnd);

    // Larger timeframes = higher priority (more useful for backtesting)
    const tfMs = TIMEFRAME_MS[timeframe] ?? 60_000;
    if (tfMs >= 60 * 60_000) priority -= 10; // Hourly+
    if (tfMs >= 4 * 60 * 60_000) priority -= 5; // 4h+

    // Major pairs = higher priority
    if (symbol.startsWith("BTC/") || symbol.startsWith("ETH/")) {
      priority -= 5;
    }

    return priority;
  }

  async createBackfillJob(
    exchange: string,
    symbol: string,
    timeframe: string,
    startTime: Date,
    endTime: Date
  ): Promise<BackfillJobConfig> {
    const tfMs = TIMEFRAME_MS[timeframe] ?? 60_000;
    const maxCandles = MAX_CANDLES_PER_REQUEST[exchange] ?? 500;

    return {
      exchange,
      symbol,
      timeframe,
      startTime,
      endTime,
      batchSizeMs: tfMs * maxCandles,
      maxCandlesPerRequest: maxCandles,
    };
  }

  async runBackfill(config: BackfillJobConfig) {
    const job = new BackfillJob(this.db, this.rateLimiter);
    try {
      return await job.run(config);
    } finally {
      await job.close();
    }
  }
}
