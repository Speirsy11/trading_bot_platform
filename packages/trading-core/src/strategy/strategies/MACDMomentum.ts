import type { Candle } from "@tb/types";
import { z } from "zod";

import type { IStrategy, Signal } from "../IStrategy";
import type { StrategyContext } from "../StrategyContext";

const paramsSchema = z
  .object({
    fastPeriod: z.number().int().min(2).max(100).default(12),
    slowPeriod: z.number().int().min(5).max(200).default(26),
    signalPeriod: z.number().int().min(2).max(50).default(9),
    trendPeriod: z.number().int().min(20).max(300).default(100),
    atrPeriod: z.number().int().min(2).max(100).default(14),
    atrStop: z.number().min(0).max(10).default(2),
  })
  .refine((p) => p.fastPeriod < p.slowPeriod, {
    message: "fastPeriod must be less than slowPeriod",
  });

export class MACDMomentum implements IStrategy {
  readonly name = "MACD Momentum";
  readonly description =
    "Spot long-only momentum strategy: buy MACD histogram recoveries above trend and exit when momentum or trend fails.";

  readonly paramsSchema = paramsSchema;

  private ctx!: StrategyContext;
  private params!: z.infer<typeof paramsSchema>;
  private prevHistogram: number | null = null;

  async initialize(ctx: StrategyContext): Promise<void> {
    this.ctx = ctx;
    this.params = this.paramsSchema.parse(ctx.config.strategyParams);
  }

  async onCandle(candle: Candle, history: Candle[]): Promise<Signal[]> {
    const closes = history.map((c) => c.close);
    const warmup = Math.max(
      this.params.slowPeriod + this.params.signalPeriod - 1,
      this.params.trendPeriod,
      this.params.atrPeriod + 1
    );
    if (history.length < warmup) return [];

    const macd = this.ctx.indicators.macd(
      closes,
      this.params.fastPeriod,
      this.params.slowPeriod,
      this.params.signalPeriod
    );
    const trend = this.ctx.indicators.ema(closes, this.params.trendPeriod);
    const atr = this.ctx.indicators.atr(history, this.params.atrPeriod);
    const currentHistogram = macd.histogram.at(-1);
    const currentTrend = trend.at(-1);
    const latestAtr = atr.at(-1) ?? 0;
    if (currentHistogram === undefined || currentTrend === undefined) return [];

    const signals: Signal[] = [];
    if (this.prevHistogram !== null) {
      if (this.prevHistogram <= 0 && currentHistogram > 0 && candle.close > currentTrend) {
        signals.push({
          action: "BUY",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          stopLoss:
            this.params.atrStop > 0 && latestAtr > 0
              ? candle.close - latestAtr * this.params.atrStop
              : undefined,
          reason: `MACD histogram crossed positive above EMA(${this.params.trendPeriod})`,
        });
      }

      if (this.prevHistogram >= 0 && currentHistogram < 0) {
        signals.push({
          action: "CLOSE_LONG",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: "MACD histogram crossed negative",
        });
      } else if (candle.close < currentTrend) {
        signals.push({
          action: "CLOSE_LONG",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: `Close fell below EMA(${this.params.trendPeriod}) trend filter`,
        });
      }
    }

    this.prevHistogram = currentHistogram;
    return signals;
  }

  async cleanup(): Promise<void> {
    this.prevHistogram = null;
  }
}
