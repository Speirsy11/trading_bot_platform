import type { Balance } from "@tb/types";

import type { Position } from "../exchange/types.js";

export interface RiskConfig {
  maxPositionSizePercent: number;
  maxDrawdownPercent: number;
  riskPerTradePercent: number;
  maxConcurrentPositions: number;
  maxDailyLossPercent: number;
  trailingStopEnabled: boolean;
  trailingStopPercent: number;
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxPositionSizePercent: 10,
  maxDrawdownPercent: 20,
  riskPerTradePercent: 2,
  maxConcurrentPositions: 5,
  maxDailyLossPercent: 5,
  trailingStopEnabled: false,
  trailingStopPercent: 5,
};

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Pre-trade risk checks.
 * Verifies position size, drawdown limits, concurrent positions,
 * daily loss limits, and balance sufficiency.
 */
export class RiskManager {
  private config: RiskConfig;
  private initialEquity: number;
  private peakEquity: number;
  private dailyStartEquity: number;
  private currentDay: string = "";

  constructor(config: RiskConfig, initialEquity: number) {
    if (initialEquity < 0) throw new Error("Initial equity must be non-negative");
    this.config = config;
    this.initialEquity = initialEquity;
    this.peakEquity = initialEquity;
    this.dailyStartEquity = initialEquity;
  }

  /**
   * Run all risk checks before placing an order.
   */
  checkOrder(
    orderCost: number,
    currentEquity: number,
    positions: Position[],
    balance: Balance,
    quoteCurrency: string,
    timestamp?: number
  ): RiskCheckResult {
    // Update peak equity
    if (currentEquity > this.peakEquity) {
      this.peakEquity = currentEquity;
    }

    // Update daily tracking
    const ts = timestamp ?? Date.now();
    const day = new Date(ts).toISOString().split("T")[0]!;
    if (day !== this.currentDay) {
      this.currentDay = day;
      this.dailyStartEquity = currentEquity;
    }

    // Check 1: Position size limit
    if (currentEquity <= 0) {
      return { allowed: false, reason: "Current equity is zero or negative" };
    }
    const positionSizePercent = (orderCost / currentEquity) * 100;
    if (positionSizePercent > this.config.maxPositionSizePercent) {
      return {
        allowed: false,
        reason: `Position size (${positionSizePercent.toFixed(1)}%) exceeds limit (${this.config.maxPositionSizePercent}%)`,
      };
    }

    // Check 2: Portfolio drawdown limit
    const drawdownPercent = ((this.peakEquity - currentEquity) / this.peakEquity) * 100;
    if (drawdownPercent > this.config.maxDrawdownPercent) {
      return {
        allowed: false,
        reason: `Drawdown (${drawdownPercent.toFixed(1)}%) exceeds limit (${this.config.maxDrawdownPercent}%)`,
      };
    }

    // Check 3: Max concurrent positions
    if (positions.length >= this.config.maxConcurrentPositions) {
      return {
        allowed: false,
        reason: `Max concurrent positions (${this.config.maxConcurrentPositions}) reached`,
      };
    }

    // Check 4: Daily loss limit
    const dailyLossPercent =
      ((this.dailyStartEquity - currentEquity) / this.dailyStartEquity) * 100;
    if (dailyLossPercent > this.config.maxDailyLossPercent) {
      return {
        allowed: false,
        reason: `Daily loss (${dailyLossPercent.toFixed(1)}%) exceeds limit (${this.config.maxDailyLossPercent}%)`,
      };
    }

    // Check 5: Sufficient balance
    const freeBalance = balance.free[quoteCurrency] ?? 0;
    if (freeBalance < orderCost) {
      return {
        allowed: false,
        reason: `Insufficient balance: need ${orderCost.toFixed(2)}, have ${freeBalance.toFixed(2)} ${quoteCurrency}`,
      };
    }

    return { allowed: true };
  }

  updatePeakEquity(equity: number): void {
    if (equity > this.peakEquity) {
      this.peakEquity = equity;
    }
  }

  getCurrentDrawdown(currentEquity: number): number {
    return ((this.peakEquity - currentEquity) / this.peakEquity) * 100;
  }
}
