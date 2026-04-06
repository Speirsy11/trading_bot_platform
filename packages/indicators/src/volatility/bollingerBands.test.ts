import { describe, it, expect } from "vitest";

import { bollingerBands } from "../volatility/bollingerBands";

describe("Bollinger Bands", () => {
  it("calculates bands correctly", () => {
    const values = [
      86.16, 89.09, 88.78, 90.32, 89.07, 91.15, 89.44, 89.18, 86.93, 87.68, 86.96, 89.43, 89.32,
      88.72, 87.45, 87.26, 89.5, 87.9, 89.13, 90.7,
    ];

    const result = bollingerBands(values, 20, 2);

    expect(result.middle).toHaveLength(1); // 20 values, period 20 → 1 SMA
    expect(result.upper).toHaveLength(1);
    expect(result.lower).toHaveLength(1);

    // Middle should be SMA
    const expectedMiddle = values.reduce((a, b) => a + b, 0) / 20;
    expect(result.middle[0]).toBeCloseTo(expectedMiddle, 4);

    // Upper > Middle > Lower
    expect(result.upper[0]).toBeGreaterThan(result.middle[0]!);
    expect(result.lower[0]).toBeLessThan(result.middle[0]!);

    // Symmetry: upper - middle ≈ middle - lower
    const upperDiff = result.upper[0]! - result.middle[0]!;
    const lowerDiff = result.middle[0]! - result.lower[0]!;
    expect(upperDiff).toBeCloseTo(lowerDiff, 10);
  });

  it("returns empty for insufficient data", () => {
    const result = bollingerBands([1, 2, 3], 20, 2);
    expect(result.middle).toHaveLength(0);
  });
});
