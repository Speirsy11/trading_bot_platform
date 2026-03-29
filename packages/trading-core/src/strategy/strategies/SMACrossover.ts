import type { Candle } from "@tb/types";
import { z } from "zod";

import type { IStrategy, Signal } from "../IStrategy.js";
import type { StrategyContext } from "../StrategyContext.js";

/**
 * SMA Crossover Strategy
 * Buy when fast SMA crosses above slow SMA (golden cross).
 * Sell when fast SMA crosses below slow SMA (death cross).
 */
export class SMACrossover implements IStrategy {
  readonly name = "SMA Crossover";
  readonly description = "Buy when fast SMA crosses above slow SMA, sell on cross below";

  readonly paramsSchema = z.object({
    fastPeriod: z.number().int().min(2).max(200).default(9),
    slowPeriod: z.number().int().min(5).max(500).default(21),
  });

  private ctx!: StrategyContext;
  private params!: { fastPeriod: number; slowPeriod: number };
  private prevFastSMA: number | null = null;
  private prevSlowSMA: number | null = null;

  async initialize(ctx: StrategyContext): Promise<void> {
    this.ctx = ctx;
    this.params = this.paramsSchema.parse(ctx.config.strategyParams);
  }

  async onCandle(candle: Candle, history: Candle[]): Promise<Signal[]> {
    const closes = history.map((c) => c.close);

    if (closes.length < this.params.slowPeriod) {
      return [];
    }

    const fastSMA = this.ctx.indicators.sma(closes, this.params.fastPeriod);
    const slowSMA = this.ctx.indicators.sma(closes, this.params.slowPeriod);

    const currentFast = fastSMA[fastSMA.length - 1]!;
    const currentSlow = slowSMA[slowSMA.length - 1]!;
    const signals: Signal[] = [];

    if (this.prevFastSMA !== null && this.prevSlowSMA !== null) {
      // Golden cross: fast SMA crosses above slow SMA
      if (this.prevFastSMA <= this.prevSlowSMA && currentFast > currentSlow) {
        signals.push({
          action: "BUY",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: `Golden cross: SMA(${this.params.fastPeriod}) crossed above SMA(${this.params.slowPeriod})`,
        });
      }

      // Death cross: fast SMA crosses below slow SMA
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

    return signals;
  }

  async cleanup(): Promise<void> {
    this.prevFastSMA = null;
    this.prevSlowSMA = null;
  }
}
