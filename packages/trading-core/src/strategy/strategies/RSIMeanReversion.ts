import type { Candle } from "@tb/types";
import { z } from "zod";

import type { IStrategy, Signal } from "../IStrategy";
import type { StrategyContext } from "../StrategyContext";

/**
 * RSI Mean Reversion Strategy
 * Buy when RSI drops below oversold level (mean reversion entry).
 * Sell when RSI rises above overbought level.
 */
export class RSIMeanReversion implements IStrategy {
  readonly name = "RSI Mean Reversion";
  readonly description = "Buy when RSI is oversold, sell when RSI is overbought";

  readonly paramsSchema = z.object({
    rsiPeriod: z.number().int().min(2).max(100).default(14),
    oversoldLevel: z.number().min(0).max(50).default(30),
    overboughtLevel: z.number().min(50).max(100).default(70),
  });

  private ctx!: StrategyContext;
  private params!: { rsiPeriod: number; oversoldLevel: number; overboughtLevel: number };
  private prevRSI: number | null = null;

  async initialize(ctx: StrategyContext): Promise<void> {
    this.ctx = ctx;
    this.params = this.paramsSchema.parse(ctx.config.strategyParams);
  }

  async onCandle(candle: Candle, history: Candle[]): Promise<Signal[]> {
    const closes = history.map((c) => c.close);

    if (closes.length < this.params.rsiPeriod + 1) {
      return [];
    }

    const rsiValues = this.ctx.indicators.rsi(closes, this.params.rsiPeriod);
    if (rsiValues.length === 0) return [];

    const currentRSI = rsiValues[rsiValues.length - 1]!;
    const signals: Signal[] = [];

    if (this.prevRSI !== null) {
      // Oversold → entering: buy signal
      if (this.prevRSI >= this.params.oversoldLevel && currentRSI < this.params.oversoldLevel) {
        signals.push({
          action: "BUY",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: `RSI crossed below oversold level: ${currentRSI.toFixed(1)} < ${this.params.oversoldLevel}`,
        });
      }

      // Overbought → sell signal (close long)
      if (this.prevRSI <= this.params.overboughtLevel && currentRSI > this.params.overboughtLevel) {
        signals.push({
          action: "CLOSE_LONG",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: `RSI crossed above overbought level: ${currentRSI.toFixed(1)} > ${this.params.overboughtLevel}`,
        });
      }
    }

    this.prevRSI = currentRSI;
    return signals;
  }

  async cleanup(): Promise<void> {
    this.prevRSI = null;
  }
}
