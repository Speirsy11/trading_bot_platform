import type { Candle } from "@tb/types";
import { z } from "zod";

import type { IStrategy, Signal } from "../IStrategy";
import type { StrategyContext } from "../StrategyContext";

const paramsSchema = z
  .object({
    entryPeriod: z.number().int().min(5).max(200).default(55),
    exitPeriod: z.number().int().min(2).max(100).default(20),
    atrPeriod: z.number().int().min(2).max(100).default(14),
    atrStop: z.number().min(0).max(10).default(2),
  })
  .refine((p) => p.exitPeriod < p.entryPeriod, {
    message: "exitPeriod must be less than entryPeriod",
  });

export class DonchianBreakout implements IStrategy {
  readonly name = "Donchian Breakout";
  readonly description =
    "Spot long-only trend following: buy channel breakouts and exit on shorter-channel breakdowns.";

  readonly paramsSchema = paramsSchema;

  private ctx!: StrategyContext;
  private params!: z.infer<typeof paramsSchema>;

  async initialize(ctx: StrategyContext): Promise<void> {
    this.ctx = ctx;
    this.params = this.paramsSchema.parse(ctx.config.strategyParams);
  }

  async onCandle(candle: Candle, history: Candle[]): Promise<Signal[]> {
    const warmup = Math.max(this.params.entryPeriod + 1, this.params.atrPeriod + 1);
    if (history.length < warmup) return [];

    const previous = history.slice(0, -1);
    const entryWindow = previous.slice(-this.params.entryPeriod);
    const exitWindow = previous.slice(-this.params.exitPeriod);
    const channelHigh = Math.max(...entryWindow.map((c) => c.high));
    const channelLow = Math.min(...exitWindow.map((c) => c.low));
    const atr = this.ctx.indicators.atr(history, this.params.atrPeriod);
    const latestAtr = atr[atr.length - 1] ?? 0;
    const stopLoss =
      this.params.atrStop > 0 && latestAtr > 0
        ? candle.close - latestAtr * this.params.atrStop
        : undefined;

    if (candle.close > channelHigh) {
      return [
        {
          action: "BUY",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          stopLoss,
          reason: `Close broke above ${this.params.entryPeriod}-candle Donchian high`,
        },
      ];
    }

    if (candle.close < channelLow) {
      return [
        {
          action: "CLOSE_LONG",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: `Close broke below ${this.params.exitPeriod}-candle Donchian exit channel`,
        },
      ];
    }

    return [];
  }

  async cleanup(): Promise<void> {}
}
