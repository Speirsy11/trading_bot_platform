import { describe, it, expect } from "vitest";

import { atr } from "../volatility/atr.js";

describe("ATR", () => {
  it("calculates ATR correctly", () => {
    const candles = Array.from({ length: 20 }, (_, i) => ({
      time: i * 60000,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 102 + i,
      volume: 1000,
    }));

    const result = atr(candles, 14);
    expect(result.length).toBeGreaterThan(0);

    // ATR should be positive
    for (const val of result) {
      expect(val).toBeGreaterThan(0);
    }
  });

  it("returns empty for insufficient data", () => {
    const candles = Array.from({ length: 5 }, (_, i) => ({
      time: i * 60000,
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 1000,
    }));
    expect(atr(candles, 14)).toHaveLength(0);
  });

  it("ATR of constant-range candles is stable", () => {
    // All candles have the same range
    const candles = Array.from({ length: 30 }, (_, i) => ({
      time: i * 60000,
      open: 100,
      high: 110,
      low: 90,
      close: 100,
      volume: 1000,
    }));

    const result = atr(candles, 14);
    // All ATR values should be ~20 (high - low, since close doesn't change)
    for (const val of result) {
      expect(val).toBeCloseTo(20, 1);
    }
  });
});
