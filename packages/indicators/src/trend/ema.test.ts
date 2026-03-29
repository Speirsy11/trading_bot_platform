import { describe, it, expect } from "vitest";

import { ema } from "../trend/ema.js";

describe("EMA", () => {
  it("calculates EMA correctly for period 10", () => {
    // Known example values
    const values = [
      22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29, 22.15, 22.39, 22.38,
      22.61, 23.36, 24.05, 23.75, 23.83, 23.95, 23.63,
    ];
    const result = ema(values, 10);
    // First EMA value should be SMA of first 10 values
    const smaFirst10 = values.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    expect(result[0]).toBeCloseTo(smaFirst10, 4);
    expect(result).toHaveLength(11);
  });

  it("returns empty for insufficient data", () => {
    expect(ema([1, 2, 3], 5)).toHaveLength(0);
  });

  it("first value equals SMA seed", () => {
    const values = [10, 20, 30, 40, 50, 60];
    const result = ema(values, 3);
    expect(result[0]).toBeCloseTo(20, 4); // SMA(10,20,30) = 20
  });

  it("throws for invalid period", () => {
    expect(() => ema([1, 2], 0)).toThrow();
  });
});
