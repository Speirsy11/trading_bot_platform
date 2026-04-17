import type { Candle } from "@tb/types";
import ccxt, { type Exchange } from "ccxt";

import type { ExchangeRateLimiter } from "../rateLimit/ExchangeRateLimiter";
import { AdaptiveRateLimiter } from "../rateLimiter";
import { CandleValidator } from "../validation/CandleValidator";

const RATE_LIMIT_ERRORS = /429|ddos|rate\s*limit/i;
const MAX_RETRIES = 5;

export class OHLCVCollector {
  private exchanges: Map<string, Exchange>;
  private rateLimiter: ExchangeRateLimiter;
  private adaptiveLimiter: AdaptiveRateLimiter;
  private validator: CandleValidator;

  constructor(rateLimiter: ExchangeRateLimiter) {
    this.exchanges = new Map();
    this.rateLimiter = rateLimiter;
    this.adaptiveLimiter = new AdaptiveRateLimiter();
    this.validator = new CandleValidator();
  }

  getExchange(exchangeId: string): Exchange {
    let exchange = this.exchanges.get(exchangeId);
    if (!exchange) {
      if (!ccxt.exchanges.includes(exchangeId)) {
        throw new Error(`Unsupported exchange: ${exchangeId}`);
      }
      const ExchangeClass = (
        ccxt as unknown as Record<string, new (config?: Record<string, unknown>) => Exchange>
      )[exchangeId];
      if (!ExchangeClass) {
        throw new Error(`Unsupported exchange: ${exchangeId}`);
      }
      exchange = new ExchangeClass({ enableRateLimit: false });
      this.exchanges.set(exchangeId, exchange);
    }
    return exchange;
  }

  async fetchOHLCV(
    exchangeId: string,
    symbol: string,
    timeframe: string,
    since?: number,
    limit?: number
  ): Promise<Candle[]> {
    let attempt = 0;

    for (;;) {
      await this.rateLimiter.waitForSlot(exchangeId);
      await this.adaptiveLimiter.wait(exchangeId);

      try {
        const exchange = this.getExchange(exchangeId);
        const rawCandles = await exchange.fetchOHLCV(symbol, timeframe, since, limit);

        this.adaptiveLimiter.onSuccess(exchangeId);

        return rawCandles.map((c) => ({
          time: c[0] as number,
          open: c[1] as number,
          high: c[2] as number,
          low: c[3] as number,
          close: c[4] as number,
          volume: c[5] as number,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (RATE_LIMIT_ERRORS.test(message) && attempt < MAX_RETRIES) {
          attempt++;
          this.adaptiveLimiter.onRateLimit(exchangeId);
          await this.adaptiveLimiter.wait(exchangeId);
          continue;
        }
        throw error;
      }
    }
  }

  async fetchIncremental(
    exchangeId: string,
    symbol: string,
    timeframe: string,
    latestTimestamp: Date | null,
    defaultLookbackMs: number = 30 * 24 * 60 * 60 * 1000
  ): Promise<{ valid: Candle[]; invalid: Candle[] }> {
    const since = latestTimestamp ? latestTimestamp.getTime() : Date.now() - defaultLookbackMs;

    const candles = await this.fetchOHLCV(exchangeId, symbol, timeframe, since);

    // Filter out the current (incomplete) candle
    const now = Date.now();
    const completeCandles = candles.filter((c) => c.time < now);

    // Validate
    const { valid, invalid } = this.validator.validateBatch(completeCandles);

    return { valid, invalid };
  }

  async close() {
    for (const exchange of this.exchanges.values()) {
      if (typeof exchange.close === "function") {
        await exchange.close();
      }
    }
    this.exchanges.clear();
  }
}
