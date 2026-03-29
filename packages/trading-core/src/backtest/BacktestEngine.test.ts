import type { Candle } from "@tb/types";
import { describe, it, expect } from "vitest";

import type { BacktestConfig } from "../backtest/BacktestConfig.js";
import { BacktestEngine } from "../backtest/BacktestEngine.js";
import { DEFAULT_RISK_CONFIG } from "../risk/RiskManager.js";
import { StrategyRegistry } from "../strategy/StrategyRegistry.js";
import { SMACrossover } from "../strategy/strategies/SMACrossover.js";

/**
 * Generate synthetic market data with an uptrend followed by downtrend.
 * This creates opportunities for an SMA crossover strategy.
 */
function generateTestCandles(count: number): Candle[] {
  const candles: Candle[] = [];
  let price = 100;

  for (let i = 0; i < count; i++) {
    // Create a cyclical pattern: up for first half, down for second half
    const cycle = Math.sin((i / count) * Math.PI * 4) * 20;
    const noise = Math.sin(i * 0.7) * 3;
    price = 100 + cycle + noise;

    candles.push({
      time: i * 60_000, // 1m candles
      open: price - 1,
      high: price + 3,
      low: price - 3,
      close: price,
      volume: 1000 + Math.random() * 500,
    });
  }

  return candles;
}

describe("BacktestEngine integration", () => {
  it("runs a full backtest with SMACrossover strategy", async () => {
    StrategyRegistry.register("sma-crossover", () => new SMACrossover());

    const config: BacktestConfig = {
      strategyName: "sma-crossover",
      strategyParams: { fastPeriod: 5, slowPeriod: 15 },
      exchange: "backtest",
      symbol: "BTC/USDT",
      timeframe: "1m",
      startDate: 0,
      endDate: 200 * 60_000,
      initialBalance: 10000,
      fees: { maker: 0.001, taker: 0.001 },
      slippage: { enabled: false, percentage: 0 },
      riskConfig: { ...DEFAULT_RISK_CONFIG },
      historyWindowSize: 100,
    };

    const engine = new BacktestEngine(config);
    const candles = generateTestCandles(200);
    const result = await engine.run(candles);

    // Verify result structure
    expect(result.strategyName).toBe("SMA Crossover");
    expect(result.symbol).toBe("BTC/USDT");
    expect(result.initialBalance).toBe(10000);
    expect(result.finalBalance).toBeGreaterThan(0);

    // Verify metrics
    expect(result.metrics).toBeDefined();
    expect(typeof result.metrics.totalReturn).toBe("number");
    expect(typeof result.metrics.maxDrawdown).toBe("number");
    expect(typeof result.metrics.sharpeRatio).toBe("number");
    expect(result.metrics.totalTrades).toBeGreaterThanOrEqual(0);

    // Verify equity curve
    expect(result.equityCurve.length).toBe(200);

    // Verify drawdown curve
    expect(result.drawdownCurve.length).toBe(200);

    StrategyRegistry.clear();
  });

  it("runs a backtest with a directly provided strategy", async () => {
    const config: BacktestConfig = {
      strategyName: "direct",
      strategyParams: { fastPeriod: 5, slowPeriod: 15 },
      exchange: "backtest",
      symbol: "BTC/USDT",
      timeframe: "1m",
      startDate: 0,
      endDate: 100 * 60_000,
      initialBalance: 5000,
      fees: { maker: 0.001, taker: 0.001 },
      slippage: { enabled: true, percentage: 0.001 },
      riskConfig: { ...DEFAULT_RISK_CONFIG },
    };

    const engine = new BacktestEngine(config);
    const candles = generateTestCandles(100);
    const strategy = new SMACrossover();
    const result = await engine.run(candles, strategy);

    expect(result.initialBalance).toBe(5000);
    expect(result.finalBalance).toBeGreaterThan(0);
    expect(result.metrics).toBeDefined();
  });
});
