import type { TradeRecord } from "../exchange/types";

import type { PerformanceMetrics, EquityPoint } from "./types";

/**
 * Computes all performance metrics from trade results and equity curve.
 */
export class MetricsCalculator {
  private riskFreeRate: number;

  constructor(riskFreeRate: number = 0.02) {
    this.riskFreeRate = riskFreeRate;
  }

  calculate(
    trades: TradeRecord[],
    equityCurve: EquityPoint[],
    dailyReturns: number[],
    initialBalance: number
  ): PerformanceMetrics {
    const finalBalance =
      equityCurve.length > 0 ? equityCurve[equityCurve.length - 1]!.equity : initialBalance;

    // Total Return
    const totalReturn =
      initialBalance > 0 ? ((finalBalance - initialBalance) / initialBalance) * 100 : 0;

    // Net Profit
    const netProfit = finalBalance - initialBalance;

    // CAGR
    const startTime = equityCurve.length > 0 ? equityCurve[0]!.time : 0;
    const endTime = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1]!.time : 0;
    const durationMs = endTime - startTime;
    const years = durationMs > 0 ? durationMs / (365.25 * 24 * 60 * 60 * 1000) : 1 / 365;
    const cagr =
      initialBalance > 0 && years > 0
        ? (Math.pow(finalBalance / initialBalance, 1 / years) - 1) * 100
        : 0;

    // Max Drawdown
    const { maxDrawdown, maxDrawdownDuration } = this.calcDrawdown(equityCurve);

    // Win/Loss stats
    const closedTrades = trades.filter((t) => t.pnl !== 0 || t.cost > 0);
    const winningTrades = closedTrades.filter((t) => t.pnl > 0);
    const losingTrades = closedTrades.filter((t) => t.pnl < 0);

    const totalTrades = closedTrades.length;
    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const averageWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;

    const riskRewardRatio = averageLoss > 0 ? averageWin / averageLoss : 0;

    const winRateFrac = totalTrades > 0 ? winningTrades.length / totalTrades : 0;
    const lossRateFrac = 1 - winRateFrac;
    const expectancy = winRateFrac * averageWin - lossRateFrac * averageLoss;

    // Sharpe Ratio
    const sharpeRatio = this.calcSharpe(dailyReturns);

    // Sortino Ratio
    const sortinoRatio = this.calcSortino(dailyReturns);

    // Calmar Ratio
    const calmarRatio = maxDrawdown > 0 ? cagr / 100 / (maxDrawdown / 100) : 0;

    // Average hold time
    const avgHoldTime = this.calcAvgHoldTime(trades);

    // Win/Loss streaks
    const { maxWinStreak, maxLossStreak } = this.calcStreaks(closedTrades);

    return {
      totalReturn: round(totalReturn),
      cagr: round(cagr),
      netProfit: round(netProfit),
      sharpeRatio: round(sharpeRatio),
      sortinoRatio: round(sortinoRatio),
      calmarRatio: round(calmarRatio),
      maxDrawdown: round(maxDrawdown),
      maxDrawdownDuration,
      winRate: round(winRate),
      profitFactor: round(profitFactor),
      averageWin: round(averageWin),
      averageLoss: round(averageLoss),
      riskRewardRatio: round(riskRewardRatio),
      expectancy: round(expectancy),
      totalTrades,
      avgHoldTime,
      maxWinStreak,
      maxLossStreak,
    };
  }

  private calcDrawdown(equityCurve: EquityPoint[]): {
    maxDrawdown: number;
    maxDrawdownDuration: number;
  } {
    let peak = 0;
    let maxDD = 0;
    let maxDDDuration = 0;
    let peakTime = 0;

    for (const point of equityCurve) {
      if (point.equity > peak) {
        peak = point.equity;
        peakTime = point.time;
      }
      const dd = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0;
      if (dd > maxDD) {
        maxDD = dd;
        maxDDDuration = point.time - peakTime;
      }
    }

    return { maxDrawdown: maxDD, maxDrawdownDuration: maxDDDuration };
  }

  private calcSharpe(dailyReturns: number[]): number {
    if (dailyReturns.length < 2) return 0;

    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    const annualizedReturn = mean * 252;
    const annualizedStdDev = stdDev * Math.sqrt(252);

    return (annualizedReturn - this.riskFreeRate) / annualizedStdDev;
  }

  private calcSortino(dailyReturns: number[]): number {
    if (dailyReturns.length < 2) return 0;

    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const downsideReturns = dailyReturns.filter((r) => r < 0);

    if (downsideReturns.length === 0) return mean > 0 ? Infinity : 0;

    const downsideVariance =
      downsideReturns.reduce((sum, r) => sum + r ** 2, 0) / downsideReturns.length;
    const downsideStdDev = Math.sqrt(downsideVariance);

    if (downsideStdDev === 0) return 0;

    const annualizedReturn = mean * 252;
    const annualizedDownsideDev = downsideStdDev * Math.sqrt(252);

    return (annualizedReturn - this.riskFreeRate) / annualizedDownsideDev;
  }

  private calcAvgHoldTime(trades: TradeRecord[]): number {
    if (trades.length < 2) return 0;

    // Group trades by symbol to find entry/exit pairs (FIFO)
    let totalHoldTime = 0;
    let pairCount = 0;

    const entryMap = new Map<string, number[]>();

    for (const trade of trades) {
      if (trade.side === "buy") {
        const entries = entryMap.get(trade.symbol) ?? [];
        entries.push(trade.timestamp);
        entryMap.set(trade.symbol, entries);
      } else if (trade.side === "sell") {
        const entries = entryMap.get(trade.symbol);
        if (entries && entries.length > 0) {
          const entryTime = entries.shift()!;
          totalHoldTime += trade.timestamp - entryTime;
          pairCount++;
        }
      }
    }

    return pairCount > 0 ? totalHoldTime / pairCount : 0;
  }

  private calcStreaks(trades: TradeRecord[]): {
    maxWinStreak: number;
    maxLossStreak: number;
  } {
    let maxWin = 0;
    let maxLoss = 0;
    let currentWin = 0;
    let currentLoss = 0;

    for (const trade of trades) {
      if (trade.pnl > 0) {
        currentWin++;
        currentLoss = 0;
        if (currentWin > maxWin) maxWin = currentWin;
      } else if (trade.pnl < 0) {
        currentLoss++;
        currentWin = 0;
        if (currentLoss > maxLoss) maxLoss = currentLoss;
      }
    }

    return { maxWinStreak: maxWin, maxLossStreak: maxLoss };
  }
}

function round(value: number): number {
  if (!isFinite(value)) return value;
  return Math.round(value * 10000) / 10000;
}
