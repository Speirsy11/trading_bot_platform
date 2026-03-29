import type { EquityPoint } from "./types.js";

/**
 * Tracks equity curve and daily returns over the course of a backtest or live run.
 */
export class PerformanceTracker {
  private equityCurve: EquityPoint[] = [];
  private dailyReturns: Map<string, { start: number; end: number }> = new Map();

  record(time: number, equity: number): void {
    this.equityCurve.push({ time, equity });

    const day = new Date(time).toISOString().split("T")[0]!;
    const existing = this.dailyReturns.get(day);
    if (!existing) {
      this.dailyReturns.set(day, { start: equity, end: equity });
    } else {
      existing.end = equity;
    }
  }

  getEquityCurve(): EquityPoint[] {
    return [...this.equityCurve];
  }

  getDrawdownCurve(): EquityPoint[] {
    const curve: EquityPoint[] = [];
    let peak = 0;

    for (const point of this.equityCurve) {
      if (point.equity > peak) peak = point.equity;
      const dd = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0;
      curve.push({ time: point.time, equity: dd });
    }

    return curve;
  }

  getDailyReturns(): number[] {
    const returns: number[] = [];
    for (const { start, end } of this.dailyReturns.values()) {
      if (start !== 0) {
        returns.push((end - start) / start);
      }
    }
    return returns;
  }

  getLastEquity(): number {
    if (this.equityCurve.length === 0) return 0;
    return this.equityCurve[this.equityCurve.length - 1]!.equity;
  }

  reset(): void {
    this.equityCurve = [];
    this.dailyReturns.clear();
  }
}
