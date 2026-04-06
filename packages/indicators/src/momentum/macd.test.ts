import { describe, it, expect } from "vitest";

import { macd } from "../momentum/macd";

describe("MACD", () => {
  it("calculates MACD with default parameters", () => {
    // Generate enough data for MACD (26 + 9 - 1 = 34 minimum)
    const values = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 3) * 10);
    const result = macd(values, 12, 26, 9);

    expect(result.macd.length).toBeGreaterThan(0);
    expect(result.signal.length).toBeGreaterThan(0);
    expect(result.histogram.length).toBeGreaterThan(0);

    // All arrays should be same length
    expect(result.macd.length).toBe(result.signal.length);
    expect(result.signal.length).toBe(result.histogram.length);

    // Histogram = MACD - Signal
    for (let i = 0; i < result.histogram.length; i++) {
      expect(result.histogram[i]).toBeCloseTo(result.macd[i]! - result.signal[i]!, 10);
    }
  });

  it("returns empty for insufficient data", () => {
    const result = macd([1, 2, 3, 4, 5], 12, 26, 9);
    expect(result.macd).toHaveLength(0);
    expect(result.signal).toHaveLength(0);
  });

  it("throws if fast period >= slow period", () => {
    expect(() => macd([1, 2, 3], 26, 12, 9)).toThrow();
  });
});
