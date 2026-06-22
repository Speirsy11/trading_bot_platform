import type { Candle } from "@tb/types";
import { z } from "zod";

import type { IStrategy, Signal } from "../IStrategy";
import type { StrategyContext } from "../StrategyContext";

const paramsSchema = z
  .object({
    fastPeriod: z.number().int().min(2).max(200).default(50),
    slowPeriod: z.number().int().min(20).max(500).default(200),
    exitPeriod: z.number().int().min(5).max(200).default(22),
    atrPeriod: z.number().int().min(2).max(100).default(14),
    atrStop: z.number().min(0.5).max(10).default(3),
  })
  .refine((p) => p.fastPeriod < p.slowPeriod, {
    message: "fastPeriod must be less than slowPeriod",
  });

export class SMAChandelierTrend implements IStrategy {
  readonly name = "SMA Chandelier Trend";
  readonly description =
    "Spot long-only SMA regime strategy with re-entry on trend reclaim and ATR chandelier exits.";

  readonly paramsSchema = paramsSchema;

  private ctx!: StrategyContext;
  private params!: z.infer<typeof paramsSchema>;
  private prevFast: number | null = null;
  private prevSlow: number | null = null;
  private prevClose: number | null = null;

  async initialize(ctx: StrategyContext): Promise<void> {
    this.ctx = ctx;
    this.params = this.paramsSchema.parse(ctx.config.strategyParams);
  }

  async onCandle(candle: Candle, history: Candle[]): Promise<Signal[]> {
    const warmup = Math.max(
      this.params.slowPeriod,
      this.params.exitPeriod,
      this.params.atrPeriod + 1
    );
    if (history.length < warmup) return [];

    const closes = history.map((c) => c.close);
    const fast = this.ctx.indicators.sma(closes, this.params.fastPeriod).at(-1);
    const slow = this.ctx.indicators.sma(closes, this.params.slowPeriod).at(-1);
    const atr = this.ctx.indicators.atr(history, this.params.atrPeriod).at(-1) ?? 0;
    if (fast === undefined || slow === undefined || atr <= 0) return [];

    const recentHigh = Math.max(...history.slice(-this.params.exitPeriod).map((c) => c.high));
    const chandelierStop = recentHigh - atr * this.params.atrStop;
    const signals: Signal[] = [];

    if (this.prevFast !== null && this.prevSlow !== null && this.prevClose !== null) {
      const crossedUp = this.prevFast <= this.prevSlow && fast > slow;
      const reclaimedFast = fast > slow && this.prevClose <= fast && candle.close > fast;
      const stopFailed = candle.close < chandelierStop;
      const trendFailed = fast < slow || candle.close < slow;

      if ((crossedUp || reclaimedFast) && candle.close > slow && chandelierStop < candle.close) {
        signals.push({
          action: "BUY",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          stopLoss: chandelierStop,
          reason: crossedUp
            ? `SMA(${this.params.fastPeriod}) crossed above SMA(${this.params.slowPeriod})`
            : `Close reclaimed SMA(${this.params.fastPeriod}) in bullish SMA regime`,
        });
      }

      if (stopFailed || trendFailed) {
        signals.push({
          action: "CLOSE_LONG",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: stopFailed
            ? `Close fell below ${this.params.atrStop} ATR chandelier stop`
            : `SMA trend regime failed`,
        });
      }
    }

    this.prevFast = fast;
    this.prevSlow = slow;
    this.prevClose = candle.close;
    return signals;
  }

  async cleanup(): Promise<void> {
    this.prevFast = null;
    this.prevSlow = null;
    this.prevClose = null;
  }
}
