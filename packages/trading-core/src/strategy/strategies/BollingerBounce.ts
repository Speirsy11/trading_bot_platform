import type { Candle } from "@tb/types";
import { z } from "zod";

import type { IStrategy, Signal } from "../IStrategy";
import type { StrategyContext } from "../StrategyContext";

/**
 * Bollinger Bounce Strategy
 * BUY  when close crosses below the lower band AND RSI is in oversold territory.
 * CLOSE_LONG when close crosses above the middle band (mean reversion exit).
 * SELL (short) when close crosses above the upper band AND RSI is overbought.
 * CLOSE_SHORT when close crosses below the middle band.
 */
export class BollingerBounce implements IStrategy {
  readonly name = "Bollinger Bounce";
  readonly description =
    "Buy on lower-band cross with oversold RSI; sell short on upper-band cross with overbought RSI";

  readonly paramsSchema = z.object({
    period: z.number().int().min(2).max(500).default(20),
    stdDevMultiplier: z.number().min(0.1).max(10).default(2.0),
    rsiPeriod: z.number().int().min(2).max(100).default(14),
    rsiOversold: z.number().min(0).max(50).default(35),
    rsiOverbought: z.number().min(50).max(100).default(65),
  });

  private ctx!: StrategyContext;
  private params!: {
    period: number;
    stdDevMultiplier: number;
    rsiPeriod: number;
    rsiOversold: number;
    rsiOverbought: number;
  };

  private prevClose: number | null = null;
  private prevLower: number | null = null;
  private prevMiddle: number | null = null;
  private prevUpper: number | null = null;

  async initialize(ctx: StrategyContext): Promise<void> {
    this.ctx = ctx;
    this.params = this.paramsSchema.parse(ctx.config.strategyParams);
  }

  async onCandle(candle: Candle, history: Candle[]): Promise<Signal[]> {
    const closes = history.map((c) => c.close);

    // Need enough history for both Bollinger Bands and RSI
    const minLength = Math.max(this.params.period, this.params.rsiPeriod + 1);
    if (closes.length < minLength) {
      return [];
    }

    const bb = this.ctx.indicators.bollingerBands(
      closes,
      this.params.period,
      this.params.stdDevMultiplier
    );
    const rsiValues = this.ctx.indicators.rsi(closes, this.params.rsiPeriod);

    if (bb.upper.length === 0 || bb.middle.length === 0 || bb.lower.length === 0) {
      return [];
    }
    if (rsiValues.length === 0) {
      return [];
    }

    const currentClose = closes[closes.length - 1]!;
    const currentUpper = bb.upper[bb.upper.length - 1]!;
    const currentMiddle = bb.middle[bb.middle.length - 1]!;
    const currentLower = bb.lower[bb.lower.length - 1]!;
    const currentRSI = rsiValues[rsiValues.length - 1]!;

    const signals: Signal[] = [];

    if (
      this.prevClose !== null &&
      this.prevLower !== null &&
      this.prevMiddle !== null &&
      this.prevUpper !== null
    ) {
      // BUY: close crosses below lower band AND RSI is oversold
      if (
        this.prevClose >= this.prevLower &&
        currentClose < currentLower &&
        currentRSI < this.params.rsiOversold
      ) {
        signals.push({
          action: "BUY",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: `Price crossed below lower band (${currentLower.toFixed(4)}) with RSI ${currentRSI.toFixed(1)} < ${this.params.rsiOversold}`,
        });
      }

      // CLOSE_LONG: close crosses above middle band
      if (this.prevClose <= this.prevMiddle && currentClose > currentMiddle) {
        signals.push({
          action: "CLOSE_LONG",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: `Price crossed above middle band (${currentMiddle.toFixed(4)}) — mean reversion exit`,
        });
      }

      // SELL (short): close crosses above upper band AND RSI is overbought
      if (
        this.prevClose <= this.prevUpper &&
        currentClose > currentUpper &&
        currentRSI > this.params.rsiOverbought
      ) {
        signals.push({
          action: "SELL",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: `Price crossed above upper band (${currentUpper.toFixed(4)}) with RSI ${currentRSI.toFixed(1)} > ${this.params.rsiOverbought}`,
        });
      }

      // CLOSE_SHORT: close crosses below middle band
      if (this.prevClose >= this.prevMiddle && currentClose < currentMiddle) {
        signals.push({
          action: "CLOSE_SHORT",
          symbol: this.ctx.config.symbol,
          orderType: "market",
          reason: `Price crossed below middle band (${currentMiddle.toFixed(4)}) — short mean reversion exit`,
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
