import { IndicatorCalculator } from "@tb/indicators";
import type { Candle } from "@tb/types";
import { describe, it, expect } from "vitest";

import { BacktestExchange } from "../../exchange/BacktestExchange";
import { PositionManager } from "../../orders/PositionManager";
import type { Signal } from "../IStrategy";
import { StrategyContext } from "../StrategyContext";

import { BollingerBounce } from "./BollingerBounce";

/**
 * Build a StrategyContext with the given strategyParams.
 */
function makeCtx(strategyParams: Record<string, unknown>): StrategyContext {
  return new StrategyContext(
    new BacktestExchange(10000),
    { symbol: "BTC/USDT", timeframe: "1h", strategyParams },
    new IndicatorCalculator(),
    new PositionManager()
  );
}

/**
 * Feed candles one-by-one and return all signals collected.
 */
async function runStrategy(
  strategy: BollingerBounce,
  candles: Candle[]
): Promise<{ candle: Candle; signals: Signal[] }[]> {
  const results: { candle: Candle; signals: Signal[] }[] = [];
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]!;
    const history = candles.slice(0, i + 1);
    const signals = await strategy.onCandle(candle, history);
    results.push({ candle, signals });
  }
  return results;
}

describe("BollingerBounce strategy", () => {
  /**
   * BUY signal test:
   * Build a stable price series around 100 so the Bollinger Bands settle.
   * Then send one candle that spikes sharply downward below the lower band
   * while the RSI should be well under the oversold threshold (35).
   *
   * Strategy params use a short period (10) and rsiPeriod (5) so the warm-up
   * is short and the test candle count remains manageable.
   */
  it("generates a BUY signal when close crosses below lower band with oversold RSI", async () => {
    const period = 10;
    const rsiPeriod = 5;

    const strategy = new BollingerBounce();
    const ctx = makeCtx({
      period,
      stdDevMultiplier: 2.0,
      rsiPeriod,
      rsiOversold: 35,
      rsiOverbought: 65,
    });
    await strategy.initialize(ctx);

    // 30 stable candles around 100 — gives BB and RSI time to settle
    const stableCandles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
      time: i * 3_600_000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1000,
    }));

    // One "prev" candle that is still above the lower band (price ~100, lower band ~97-98)
    const prevCandle: Candle = {
      time: 30 * 3_600_000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1000,
    };

    // A big drop candle: drops to 70, far below the lower band (~97).
    // After ~30 down-ticks the RSI will be deeply oversold.
    const dropCandles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
      time: (31 + i) * 3_600_000,
      open: 100 - i * 3,
      high: 100 - i * 3 + 0.5,
      low: 100 - i * 3 - 3,
      close: 100 - i * 3 - 2, // falling hard each step
      volume: 2000,
    }));

    const allCandles = [...stableCandles, prevCandle, ...dropCandles];

    const results = await runStrategy(strategy, allCandles);
    const buyFound = results.some((r) => r.signals.some((s) => s.action === "BUY"));

    expect(buyFound).toBe(true);
  });

  it("uses default params when no strategyParams are provided", async () => {
    const strategy = new BollingerBounce();
    const ctx = makeCtx({});
    // Should not throw — Zod defaults fill in all params
    await expect(strategy.initialize(ctx)).resolves.toBeUndefined();
  });

  it("does not emit signals during warm-up period", async () => {
    const strategy = new BollingerBounce();
    const ctx = makeCtx({ period: 20, rsiPeriod: 14 });
    await strategy.initialize(ctx);

    // Only 10 candles — below the warm-up threshold of max(20, 15) = 20
    const warmupCandles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
      time: i * 3_600_000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1000,
    }));

    const results = await runStrategy(strategy, warmupCandles);
    const anySignal = results.some((r) => r.signals.length > 0);
    expect(anySignal).toBe(false);
  });

  it("generates a CLOSE_LONG signal when close crosses above the middle band", async () => {
    const period = 10;
    const rsiPeriod = 5;

    const strategy = new BollingerBounce();
    const ctx = makeCtx({
      period,
      stdDevMultiplier: 2.0,
      rsiPeriod,
      rsiOversold: 35,
      rsiOverbought: 65,
    });
    await strategy.initialize(ctx);

    // Start low (around 80), then recover above the middle band (~80 once stabilised)
    const lowCandles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
      time: i * 3_600_000,
      open: 80,
      high: 81,
      low: 79,
      close: 80,
      volume: 1000,
    }));

    // Rise sharply above 80, crossing the middle band from below
    const riseCandles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
      time: (20 + i) * 3_600_000,
      open: 80 + i * 2,
      high: 81 + i * 2,
      low: 79 + i * 2,
      close: 80 + i * 2 + 1,
      volume: 1000,
    }));

    const allCandles = [...lowCandles, ...riseCandles];
    const results = await runStrategy(strategy, allCandles);
    const closeLongFound = results.some((r) => r.signals.some((s) => s.action === "CLOSE_LONG"));

    expect(closeLongFound).toBe(true);
  });
});
