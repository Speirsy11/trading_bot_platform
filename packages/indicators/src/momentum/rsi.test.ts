import { describe, it, expect } from "vitest";

import { rsi } from "../momentum/rsi.js";

describe("RSI", () => {
  it("calculates RSI correctly", () => {
    // Known values from Investopedia RSI example (period 14)
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61,
      46.28, 46.28, 46.0, 46.03, 46.41, 46.22, 46.21,
    ];
    const result = rsi(closes, 14);
    expect(result.length).toBeGreaterThan(0);
    // RSI should be between 0 and 100
    for (const val of result) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
    // First RSI value (after 14-period warmup)
    expect(result[0]).toBeCloseTo(70.46, 0);
  });

  it("returns empty for insufficient data", () => {
    expect(rsi([1, 2, 3], 14)).toHaveLength(0);
  });

  it("returns 100 for only upward movement", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    const result = rsi(closes, 14);
    expect(result[0]).toBe(100);
  });

  it("returns 0 for only downward movement", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i);
    const result = rsi(closes, 14);
    expect(result[0]).toBe(0);
  });

  it("throws for invalid period", () => {
    expect(() => rsi([1, 2], 0)).toThrow();
  });
});
