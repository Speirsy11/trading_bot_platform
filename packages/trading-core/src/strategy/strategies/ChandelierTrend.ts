import type { Candle } from "@tb/types";
import { z } from "zod";

import type { IStrategy, Signal } from "../IStrategy";
import type { StrategyContext } from "../StrategyContext";

const paramsSchema = z
  .object({
    entryPeriod: z.number().int().min(5).max(250).default(55),
    exitPeriod: z.number().int().min(5).max(250).default(22),
    trendPeriod: z.number().int().min(20).max(300).default(200),
    atrPeriod: z.number().int().min(2).max(100).default(14),
    atrStop: z.number().min(0.5).max(10).default(3),
  })
  .refine((p) => p.exitPeriod <= p.trendPeriod, {
    message: "exitPeriod must be less than or equal to trendPeriod",
  });

export class ChandelierTrend implements IStrategy {
  readonly name = "Chandelier Trend";
  readonly description =
    "Spot long-only breakout strategy: buy trend-filtered highs and exit on ATR chandelier breakdowns.";

  readonly paramsSchema = paramsSchema;

  private ctx!: StrategyContext;
  private params!: z.infer<typeof paramsSchema>;

  async initialize(ctx: StrategyContext): Promise<void> {
    this.ctx = ctx;
    this.params = this.paramsSchema.parse(ctx.config.strategyParams);
  }

  async onCandle(candle: Candle, history: Candle[]): Promise<Signal[]> {
    const warmup =
      Math.max(this.params.entryPeriod + 1, this.params.exitPeriod, this.params.trendPeriod) + 1;
    if (history.length < warmup) return [];

    const previous = history.slice(0, -1);
    const entryHigh = Math.max(...previous.slice(-this.params.entryPeriod).map((c) => c.high));
    const closes = history.map((c) => c.close);
    const trend = this.ctx.indicators.ema(closes, this.params.trendPeriod);
    const atr = this.ctx.indicators.atr(history, this.params.atrPeriod);
    const currentTrend = trend.at(-1);
    const latestAtr = atr.at(-1) ?? 0;
    if (currentTrend === undefined || latestAtr <= 0) return [];

    const chandelierHigh = Math.max(...history.slice(-this.params.exitPeriod).map((c) => c.high));
    const chandelierStop = chandelierHigh - latestAtr * this.params.atrStop;

    if (candle.close > entryHigh && candle.close > currentTrend && chandelierStop < candle.close) {
      return [
        {
          action: "BUY",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          stopLoss: chandelierStop,
          reason: `Close broke ${this.params.entryPeriod}-candle high above EMA(${this.params.trendPeriod})`,
        },
      ];
    }

    if (candle.close < chandelierStop || candle.close < currentTrend) {
      return [
        {
          action: "CLOSE_LONG",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason:
            candle.close < chandelierStop
              ? `Close fell below ${this.params.atrStop} ATR chandelier stop`
              : `Close fell below EMA(${this.params.trendPeriod}) trend filter`,
        },
      ];
    }

    return [];
  }

  async cleanup(): Promise<void> {}
}
