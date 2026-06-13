import { describe, expect, it } from "vitest";

import { buildBacktestBuyAndHoldBenchmark } from "./backtestRunner";

describe("backtest runner benchmark evidence", () => {
  it("builds a fee and slippage adjusted buy-and-hold benchmark for manual backtests", () => {
    const benchmark = buildBacktestBuyAndHoldBenchmark(
      [
        { time: 1, open: 100, high: 100, low: 100, close: 100, volume: 1 },
        { time: 2, open: 110, high: 110, low: 100, close: 110, volume: 1 },
        { time: 3, open: 120, high: 120, low: 105, close: 120, volume: 1 },
      ],
      20_000,
      { maker: 0.001, taker: 0.001 },
      { enabled: true, percentage: 0.0005 }
    );

    expect(benchmark.totalReturn).toBeGreaterThan(19);
    expect(benchmark.totalReturn).toBeLessThan(20);
    expect(benchmark.netProfit).toBeGreaterThan(3_800);
    expect(benchmark.finalBalance).toBeGreaterThan(23_800);
    expect(benchmark.equityCurve).toHaveLength(3);
    expect(benchmark.drawdownCurve).toHaveLength(3);
  });

  it("downsamples large benchmark curves before persistence", () => {
    const candles = Array.from({ length: 2_500 }, (_, index) => ({
      time: index,
      open: 100 + index * 0.01,
      high: 100 + index * 0.01,
      low: 100 + index * 0.01,
      close: 100 + index * 0.01,
      volume: 1,
    }));

    const benchmark = buildBacktestBuyAndHoldBenchmark(
      candles,
      10_000,
      { maker: 0.001, taker: 0.001 },
      { enabled: true, percentage: 0.0005 }
    );

    expect(benchmark.equityCurve).toHaveLength(1000);
    expect(benchmark.drawdownCurve).toHaveLength(1000);
    expect(benchmark.equityCurve[0]?.time).toBe(0);
    expect(benchmark.equityCurve.at(-1)?.time).toBe(2499);
  });
});
