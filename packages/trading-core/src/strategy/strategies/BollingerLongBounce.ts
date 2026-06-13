import type { Candle } from "@tb/types";
import { z } from "zod";

import type { IStrategy, Signal } from "../IStrategy";
import type { StrategyContext } from "../StrategyContext";

const paramsSchema = z.object({
  period: z.number().int().min(2).max(500).default(20),
  stdDevMultiplier: z.number().min(0.1).max(10).default(2),
  rsiPeriod: z.number().int().min(2).max(100).default(14),
  rsiOversold: z.number().min(0).max(50).default(35),
  exitBand: z.enum(["middle", "upper"]).default("middle"),
});

export class BollingerLongBounce implements IStrategy {
  readonly name = "Bollinger Long Bounce";
  readonly description =
    "Spot long-only mean reversion: buy lower-band washouts with RSI confirmation and exit on recovery.";

  readonly paramsSchema = paramsSchema;

  private ctx!: StrategyContext;
  private params!: z.infer<typeof paramsSchema>;
  private prevClose: number | null = null;
  private prevLower: number | null = null;
  private prevMiddle: number | null = null;
  private prevUpper: number | null = null;

  async initialize(ctx: StrategyContext): Promise<void> {
    this.ctx = ctx;
    this.params = this.paramsSchema.parse(ctx.config.strategyParams);
  }

  async onCandle(_candle: Candle, history: Candle[]): Promise<Signal[]> {
    const closes = history.map((c) => c.close);
    const minLength = Math.max(this.params.period, this.params.rsiPeriod + 1);
    if (closes.length < minLength) return [];

    const bb = this.ctx.indicators.bollingerBands(
      closes,
      this.params.period,
      this.params.stdDevMultiplier
    );
    const rsi = this.ctx.indicators.rsi(closes, this.params.rsiPeriod);
    if (!bb.lower.length || !bb.middle.length || !bb.upper.length || !rsi.length) return [];

    const currentClose = closes[closes.length - 1]!;
    const currentLower = bb.lower[bb.lower.length - 1]!;
    const currentMiddle = bb.middle[bb.middle.length - 1]!;
    const currentUpper = bb.upper[bb.upper.length - 1]!;
    const currentRsi = rsi[rsi.length - 1]!;
    const signals: Signal[] = [];

    if (
      this.prevClose !== null &&
      this.prevLower !== null &&
      this.prevMiddle !== null &&
      this.prevUpper !== null
    ) {
      if (
        this.prevClose >= this.prevLower &&
        currentClose < currentLower &&
        currentRsi < this.params.rsiOversold
      ) {
        signals.push({
          action: "BUY",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: `Lower band washout with RSI ${currentRsi.toFixed(1)}`,
        });
      }

      const exitLevel = this.params.exitBand === "upper" ? currentUpper : currentMiddle;
      const prevExitLevel = this.params.exitBand === "upper" ? this.prevUpper : this.prevMiddle;
      if (this.prevClose <= prevExitLevel && currentClose > exitLevel) {
        signals.push({
          action: "CLOSE_LONG",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: `Recovered above ${this.params.exitBand} Bollinger band`,
        });
      }
    }

    this.prevClose = currentClose;
    this.prevLower = currentLower;
    this.prevMiddle = currentMiddle;
    this.prevUpper = currentUpper;
    return signals;
  }

  async cleanup(): Promise<void> {
    this.prevClose = null;
    this.prevLower = null;
    this.prevMiddle = null;
    this.prevUpper = null;
  }
}
