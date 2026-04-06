import { describe, it, expect } from "vitest";

import { sma } from "../trend/sma";

describe("SMA", () => {
  it("calculates SMA correctly for period 5", () => {
    const values = [44.34, 44.09, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84];
    const result = sma(values, 5);
    expect(result).toHaveLength(4);
    expect(result[0]).toBeCloseTo(44.24, 2);
    expect(result[1]).toBeCloseTo(44.392, 2);
    expect(result[2]).toBeCloseTo(44.658, 2);
    expect(result[3]).toBeCloseTo(45.104, 2);
  });

  it("returns empty for insufficient data", () => {
    expect(sma([1, 2, 3], 5)).toHaveLength(0);
  });

  it("handles period of 1", () => {
    const values = [10, 20, 30];
    const result = sma(values, 1);
    expect(result).toEqual([10, 20, 30]);
  });

  it("handles single-element array", () => {
    expect(sma([42], 1)).toEqual([42]);
  });

  it("throws for invalid period", () => {
    expect(() => sma([1, 2, 3], 0)).toThrow();
  });
});
