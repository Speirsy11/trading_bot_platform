import type { Candle } from "@tb/types";
import { z } from "zod";

import type { IStrategy, Signal } from "../IStrategy";
import type { StrategyContext } from "../StrategyContext";

const paramsSchema = z
  .object({
    fastPeriod: z.number().int().min(2).max(200).default(9),
    slowPeriod: z.number().int().min(5).max(500).default(21),
    sentimentWindowHours: z.number().positive().default(24),
    minBuySentiment: z.number().min(-1).max(1).default(-0.15),
    maxCloseLongSentiment: z.number().min(-1).max(1).default(0.15),
  })
  .refine((p) => p.fastPeriod < p.slowPeriod, {
    message: "fastPeriod must be less than slowPeriod",
  });

export class SentimentAwareSMACrossover implements IStrategy {
  readonly name = "Sentiment-Aware SMA Crossover";
  readonly description =
    "SMA crossover strategy that filters entries with external news/sentiment context.";
  readonly paramsSchema = paramsSchema;

  private ctx!: StrategyContext;
  private params!: z.infer<typeof paramsSchema>;
  private prevFastSMA: number | null = null;
  private prevSlowSMA: number | null = null;

  async initialize(ctx: StrategyContext): Promise<void> {
    this.ctx = ctx;
    this.params = this.paramsSchema.parse(ctx.config.strategyParams);
  }

  async onCandle(candle: Candle, history: Candle[]): Promise<Signal[]> {
    const closes = history.map((c) => c.close);
    if (closes.length < this.params.slowPeriod) return [];

    const fastSMA = this.ctx.indicators.sma(closes, this.params.fastPeriod);
    const slowSMA = this.ctx.indicators.sma(closes, this.params.slowPeriod);
    const currentFast = fastSMA[fastSMA.length - 1]!;
    const currentSlow = slowSMA[slowSMA.length - 1]!;
    const signals: Signal[] = [];

    if (this.prevFastSMA !== null && this.prevSlowSMA !== null) {
      if (this.prevFastSMA <= this.prevSlowSMA && currentFast > currentSlow) {
        signals.push({
          action: "BUY",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: `Golden cross: SMA(${this.params.fastPeriod}) crossed above SMA(${this.params.slowPeriod})`,
        });
      }

      if (this.prevFastSMA >= this.prevSlowSMA && currentFast < currentSlow) {
        signals.push({
          action: "CLOSE_LONG",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: `Death cross: SMA(${this.params.fastPeriod}) crossed below SMA(${this.params.slowPeriod})`,
        });
      }
    }

    this.prevFastSMA = currentFast;
    this.prevSlowSMA = currentSlow;

    if (signals.length === 0) return [];

    const topic = this.ctx.config.symbol.split("/")[0] ?? this.ctx.config.symbol;
    const summary = await this.ctx.context.getSentimentSummary({
      topic,
      asOf: new Date(candle.time),
      windowHours: this.params.sentimentWindowHours,
    });

    return signals.filter((signal) => {
      if (signal.action === "BUY" && summary.averageScore < this.params.minBuySentiment) {
        this.ctx.logger.info("Blocked BUY because sentiment is too negative", {
          averageScore: summary.averageScore,
          minBuySentiment: this.params.minBuySentiment,
        });
        return false;
      }
      if (
        signal.action === "CLOSE_LONG" &&
        summary.averageScore > this.params.maxCloseLongSentiment
      ) {
        this.ctx.logger.info("Blocked CLOSE_LONG because sentiment is too positive", {
          averageScore: summary.averageScore,
          maxCloseLongSentiment: this.params.maxCloseLongSentiment,
        });
        return false;
      }
      signal.reason = `${signal.reason ?? "SMA crossover"}; sentiment=${summary.averageScore.toFixed(3)} docs=${summary.documents}`;
      return true;
    });
  }

  async cleanup(): Promise<void> {
    this.prevFastSMA = null;
    this.prevSlowSMA = null;
  }
}
