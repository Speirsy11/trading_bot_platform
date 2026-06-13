import type { Candle } from "@tb/types";
import { z } from "zod";

import type { IStrategy, Signal } from "../IStrategy";
import type { StrategyContext } from "../StrategyContext";

const paramsSchema = z
  .object({
    fastPeriod: z.number().int().min(2).max(200).default(20),
    slowPeriod: z.number().int().min(5).max(500).default(100),
    atrPeriod: z.number().int().min(2).max(100).default(14),
    atrStop: z.number().min(0.1).max(10).default(2),
  })
  .refine((p) => p.fastPeriod < p.slowPeriod, {
    message: "fastPeriod must be less than slowPeriod",
  });

export class EMAATRTrend implements IStrategy {
  readonly name = "EMA ATR Trend";
  readonly description =
    "Spot long-only EMA trend strategy with ATR-based risk sizing and exit on trend reversal.";

  readonly paramsSchema = paramsSchema;

  private ctx!: StrategyContext;
  private params!: z.infer<typeof paramsSchema>;
  private prevFast: number | null = null;
  private prevSlow: number | null = null;

  async initialize(ctx: StrategyContext): Promise<void> {
    this.ctx = ctx;
    this.params = this.paramsSchema.parse(ctx.config.strategyParams);
  }

  async onCandle(candle: Candle, history: Candle[]): Promise<Signal[]> {
    const closes = history.map((c) => c.close);
    const warmup = Math.max(this.params.slowPeriod, this.params.atrPeriod + 1);
    if (history.length < warmup) return [];

    const fast = this.ctx.indicators.ema(closes, this.params.fastPeriod);
    const slow = this.ctx.indicators.ema(closes, this.params.slowPeriod);
    const atr = this.ctx.indicators.atr(history, this.params.atrPeriod);
    const currentFast = fast[fast.length - 1]!;
    const currentSlow = slow[slow.length - 1]!;
    const latestAtr = atr[atr.length - 1] ?? 0;
    const signals: Signal[] = [];

    if (this.prevFast !== null && this.prevSlow !== null) {
      if (this.prevFast <= this.prevSlow && currentFast > currentSlow) {
        signals.push({
          action: "BUY",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          stopLoss: latestAtr > 0 ? candle.close - latestAtr * this.params.atrStop : undefined,
          reason: `EMA(${this.params.fastPeriod}) crossed above EMA(${this.params.slowPeriod})`,
        });
      }

      if (this.prevFast >= this.prevSlow && currentFast < currentSlow) {
        signals.push({
          action: "CLOSE_LONG",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: `EMA(${this.params.fastPeriod}) crossed below EMA(${this.params.slowPeriod})`,
        });
      }
    }

    this.prevFast = currentFast;
    this.prevSlow = currentSlow;
    return signals;
  }

  async cleanup(): Promise<void> {
    this.prevFast = null;
    this.prevSlow = null;
  }
}
