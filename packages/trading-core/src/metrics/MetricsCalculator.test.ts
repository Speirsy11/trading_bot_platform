import { describe, it, expect } from "vitest";

import type { TradeRecord } from "../exchange/types.js";
import { MetricsCalculator } from "../metrics/MetricsCalculator.js";
import type { EquityPoint } from "../metrics/types.js";

function makeTrade(overrides: Partial<TradeRecord> = {}): TradeRecord {
  return {
    id: "t-1",
    orderId: "o-1",
    symbol: "BTC/USDT",
    side: "sell",
    type: "market",
    amount: 1,
    price: 100,
    cost: 100,
    fee: 0.1,
    pnl: 10,
    entryPrice: 90,
    exitPrice: 100,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("MetricsCalculator", () => {
  const calc = new MetricsCalculator();

  it("calculates metrics from trades and equity curve", () => {
    const trades: TradeRecord[] = [
      makeTrade({ pnl: 50, timestamp: 1000 }),
      makeTrade({ id: "t-2", pnl: -20, timestamp: 2000 }),
      makeTrade({ id: "t-3", pnl: 30, timestamp: 3000 }),
    ];

    const equityCurve: EquityPoint[] = [
      { time: 0, equity: 10000 },
      { time: 1000, equity: 10050 },
      { time: 2000, equity: 10030 },
      { time: 3000, equity: 10060 },
    ];

    const metrics = calc.calculate(trades, equityCurve, [0.005, -0.002, 0.003], 10000);

    expect(metrics.totalReturn).toBeCloseTo(0.6, 0);
    expect(metrics.totalTrades).toBe(3);
    expect(metrics.winRate).toBeCloseTo(66.67, 0);
    expect(metrics.profitFactor).toBe(4); // 80/20
    expect(metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(metrics.averageWin).toBe(40); // (50+30)/2
    expect(metrics.averageLoss).toBe(20);
  });

  it("handles empty trades and equity", () => {
    const metrics = calc.calculate([], [], [], 10000);

    expect(metrics.totalReturn).toBe(0);
    expect(metrics.totalTrades).toBe(0);
    expect(metrics.winRate).toBe(0);
    expect(metrics.profitFactor).toBe(0);
    expect(metrics.sharpeRatio).toBe(0);
  });

  it("handles all winning trades", () => {
    const trades = [makeTrade({ pnl: 10 }), makeTrade({ id: "t-2", pnl: 20 })];

    const metrics = calc.calculate(
      trades,
      [
        { time: 0, equity: 1000 },
        { time: 1000, equity: 1030 },
      ],
      [0.01, 0.02],
      1000
    );

    expect(metrics.winRate).toBe(100);
    expect(metrics.profitFactor).toBe(Infinity);
    expect(metrics.maxWinStreak).toBe(2);
    expect(metrics.maxLossStreak).toBe(0);
  });

  it("handles all losing trades", () => {
    const trades = [makeTrade({ pnl: -10 }), makeTrade({ id: "t-2", pnl: -20 })];

    const metrics = calc.calculate(
      trades,
      [
        { time: 0, equity: 1000 },
        { time: 1000, equity: 970 },
      ],
      [-0.01, -0.02],
      1000
    );

    expect(metrics.winRate).toBe(0);
    expect(metrics.profitFactor).toBe(0);
    expect(metrics.maxWinStreak).toBe(0);
    expect(metrics.maxLossStreak).toBe(2);
  });
});
