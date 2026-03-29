import type { RiskConfig } from "./RiskManager.js";

/**
 * Calculates position size based on risk parameters.
 * Ensures each trade risks a consistent percentage of the portfolio.
 */
export class PositionSizer {
  private config: RiskConfig;

  constructor(config: RiskConfig) {
    this.config = config;
  }

  /**
   * Calculate position size given portfolio value, entry price, and stop loss.
   *
   * riskAmount = portfolioValue * riskPerTradePercent / 100
   * positionSize = riskAmount / |entryPrice - stopLossPrice|
   *
   * Caps at maxPositionSizePercent of portfolio.
   */
  calculate(portfolioValue: number, entryPrice: number, stopLossPrice?: number): number {
    if (portfolioValue <= 0) return 0;
    if (entryPrice <= 0) return 0;

    const riskAmount = portfolioValue * (this.config.riskPerTradePercent / 100);

    let positionSize: number;

    if (stopLossPrice && stopLossPrice !== entryPrice) {
      const riskPerUnit = Math.abs(entryPrice - stopLossPrice);
      positionSize = riskAmount / riskPerUnit;
    } else {
      // No stop loss: use a default risk distance (e.g., 5% of entry price)
      const defaultRiskDistance = entryPrice * 0.05;
      positionSize = riskAmount / defaultRiskDistance;
    }

    // Cap at max position size
    const maxPositionValue = portfolioValue * (this.config.maxPositionSizePercent / 100);
    const maxSize = maxPositionValue / entryPrice;

    return Math.min(positionSize, maxSize);
  }
}
