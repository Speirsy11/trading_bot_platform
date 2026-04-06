import { describe, it, expect } from "vitest";

import { PositionSizer } from "./PositionSizer";
import { DEFAULT_RISK_CONFIG } from "./RiskManager";

describe("PositionSizer", () => {
  const sizer = new PositionSizer(DEFAULT_RISK_CONFIG);

  it("calculates size based on risk and stop loss", () => {
    // Portfolio: 10000, risk: 2% = $200
    // Entry: 100, stop: 95 → risk per unit = $5
    // Uncapped = 200 / 5 = 40, but maxPositionSize = 10% = $1000, maxSize = 1000/100 = 10
    const size = sizer.calculate(10000, 100, 95);
    expect(size).toBe(10);
  });

  it("uses default risk distance when no stop loss", () => {
    // Portfolio: 10000, risk: 2% = $200
    // Entry: 100, default risk distance = 5% of 100 = $5
    // Uncapped = 200 / 5 = 40, but maxPositionSize = 10% = $1000, maxSize = 1000/100 = 10
    const size = sizer.calculate(10000, 100);
    expect(size).toBe(10);
  });

  it("caps at max position size", () => {
    // Portfolio: 10000, max position: 10% = $1000
    // Entry: 10, max size = 1000/10 = 100 units
    // Risk calc would give much larger, but capped
    const size = sizer.calculate(10000, 10, 9.99);
    // riskAmount = 200, riskPerUnit = 0.01, so uncapped = 20000
    // maxSize = 1000/10 = 100
    expect(size).toBe(100);
  });

  it("handles stop loss at same price as entry", () => {
    // When stop = entry, uses default risk distance
    const size = sizer.calculate(10000, 100, 100);
    expect(size).toBeGreaterThan(0);
    expect(Number.isFinite(size)).toBe(true);
  });
});
