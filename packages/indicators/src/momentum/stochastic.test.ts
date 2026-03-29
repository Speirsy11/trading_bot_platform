import { describe, it, expect } from "vitest";

import { stochastic } from "../momentum/stochastic.js";

describe("Stochastic", () => {
  it("calculates %K and %D correctly", () => {
    const highs = [
      130, 132, 131, 129, 133, 135, 134, 132, 136, 137, 138, 135, 133, 131, 134, 136, 138,
    ];
    const lows = [
      125, 127, 126, 124, 128, 130, 129, 127, 131, 132, 133, 130, 128, 126, 129, 131, 133,
    ];
    const closes = [
      128, 130, 129, 127, 131, 133, 132, 130, 134, 135, 136, 133, 131, 129, 132, 134, 136,
    ];

    const result = stochastic(highs, lows, closes, 14, 3);

    expect(result.k.length).toBeGreaterThan(0);
    expect(result.d.length).toBeGreaterThan(0);
    expect(result.k.length).toBe(result.d.length);

    // Values should be 0-100
    for (const val of result.k) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it("returns empty for insufficient data", () => {
    const result = stochastic([1, 2, 3], [1, 2, 3], [1, 2, 3], 14, 3);
    expect(result.k).toHaveLength(0);
    expect(result.d).toHaveLength(0);
  });

  it("handles equal high/low (returns 50)", () => {
    const highs = Array(20).fill(100);
    const lows = Array(20).fill(100);
    const closes = Array(20).fill(100);

    const result = stochastic(highs as number[], lows as number[], closes as number[], 14, 3);
    // When range is 0, should return 50
    for (const val of result.k) {
      expect(val).toBe(50);
    }
  });
});
