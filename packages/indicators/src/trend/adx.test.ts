import { describe, it, expect } from "vitest";

import { adx } from "../trend/adx";

describe("ADX", () => {
  it("calculates ADX correctly with trending data", () => {
    // Generate a strong uptrend
    const candles = Array.from({ length: 40 }, (_, i) => ({
      time: i * 60000,
      open: 100 + i * 2,
      high: 105 + i * 2,
      low: 98 + i * 2,
      close: 103 + i * 2,
      volume: 1000,
    }));

    const result = adx(candles, 14);
    expect(result.adx.length).toBeGreaterThan(0);
    expect(result.plusDI.length).toBe(result.adx.length);
    expect(result.minusDI.length).toBe(result.adx.length);

    // In an uptrend, +DI should be > -DI
    expect(result.plusDI[result.plusDI.length - 1]).toBeGreaterThan(
      result.minusDI[result.minusDI.length - 1]!
    );

    // ADX should be high in strong trend
    expect(result.adx[result.adx.length - 1]).toBeGreaterThan(20);
  });

  it("returns empty for insufficient data", () => {
    const candles = Array.from({ length: 10 }, (_, i) => ({
      time: i * 60000,
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 1000,
    }));
    const result = adx(candles, 14);
    expect(result.adx).toHaveLength(0);
  });
});
