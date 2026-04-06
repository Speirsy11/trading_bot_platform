import { IndicatorCalculator } from "@tb/indicators";
import type { Candle } from "@tb/types";
import { describe, it, expect } from "vitest";

import { BacktestExchange } from "../../exchange/BacktestExchange";
import { PositionManager } from "../../orders/PositionManager";
import { StrategyContext } from "../StrategyContext";

import { SMACrossover } from "./SMACrossover";

describe("SMACrossover strategy", () => {
  it("generates buy signal on golden cross", async () => {
    const exchange = new BacktestExchange(10000);
    const posManager = new PositionManager();
    const indicators = new IndicatorCalculator();
    const ctx = new StrategyContext(
      exchange,
      { symbol: "BTC/USDT", timeframe: "1m", strategyParams: { fastPeriod: 5, slowPeriod: 10 } },
      indicators,
      posManager
    );

    const strategy = new SMACrossover();
    await strategy.initialize(ctx);

    // Create candles: first trending down then sharply up → golden cross
    const downCandles: Candle[] = Array.from({ length: 15 }, (_, i) => ({
      time: i * 60_000,
      open: 100 - i * 0.5,
      high: 101 - i * 0.5,
      low: 99 - i * 0.5,
      close: 100 - i * 0.5,
      volume: 1000,
    }));

    const upCandles: Candle[] = Array.from({ length: 15 }, (_, i) => ({
      time: (15 + i) * 60_000,
      open: 93 + i * 2,
      high: 94 + i * 2,
      low: 92 + i * 2,
      close: 93 + i * 2,
      volume: 1000,
    }));

    const allCandles = [...downCandles, ...upCandles];
    let buySignalFound = false;

    for (let i = 0; i < allCandles.length; i++) {
      const candle = allCandles[i]!;
      const history = allCandles.slice(0, i + 1);
      const signals = await strategy.onCandle(candle, history);
      if (signals.some((s) => s.action === "BUY")) {
        buySignalFound = true;
        break;
      }
    }

    expect(buySignalFound).toBe(true);
  });

  it("validates parameters via Zod schema", async () => {
    const strategy = new SMACrossover();
    const exchange = new BacktestExchange(10000);
    const ctx = new StrategyContext(
      exchange,
      { symbol: "BTC/USDT", timeframe: "1m", strategyParams: { fastPeriod: 1 } },
      new IndicatorCalculator(),
      new PositionManager()
    );

    await expect(strategy.initialize(ctx)).rejects.toThrow();
  });
});
