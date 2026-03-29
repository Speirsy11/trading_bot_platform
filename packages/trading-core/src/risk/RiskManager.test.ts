import { describe, it, expect, beforeEach } from "vitest";

import { RiskManager, DEFAULT_RISK_CONFIG, type RiskConfig } from "../risk/RiskManager.js";

function makeBalance(free: number) {
  return {
    total: { USDT: free },
    free: { USDT: free },
    used: { USDT: 0 },
  };
}

describe("RiskManager", () => {
  let riskManager: RiskManager;
  const config: RiskConfig = { ...DEFAULT_RISK_CONFIG };

  beforeEach(() => {
    riskManager = new RiskManager(config, 10000);
  });

  it("allows order within all limits", () => {
    const result = riskManager.checkOrder(
      500, // 5% of equity
      10000,
      [],
      makeBalance(10000),
      "USDT"
    );
    expect(result.allowed).toBe(true);
  });

  it("rejects order exceeding max position size", () => {
    const result = riskManager.checkOrder(
      2000, // 20% of equity, limit is 10%
      10000,
      [],
      makeBalance(10000),
      "USDT"
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Position size");
  });

  it("rejects order when drawdown exceeds limit", () => {
    // Peak equity was 10000, now at 7500 (25% drawdown, limit is 20%)
    const result = riskManager.checkOrder(100, 7500, [], makeBalance(7500), "USDT");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Drawdown");
  });

  it("rejects when max concurrent positions reached", () => {
    const positions = Array.from({ length: 5 }, (_, i) => ({
      symbol: `SYM${i}/USDT`,
      side: "long" as const,
      amount: 1,
      entryPrice: 100,
      currentPrice: 100,
      unrealisedPnl: 0,
      realisedPnl: 0,
      timestamp: Date.now(),
    }));

    const result = riskManager.checkOrder(100, 10000, positions, makeBalance(10000), "USDT");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("concurrent positions");
  });

  it("rejects when daily loss exceeds limit", () => {
    // First call on a day sets the daily start equity
    riskManager.checkOrder(
      100,
      10000,
      [],
      makeBalance(10000),
      "USDT",
      new Date("2024-01-01T09:00:00Z").getTime()
    );

    // Same day, equity dropped
    const result = riskManager.checkOrder(
      100,
      9400, // 6% daily loss, limit is 5%
      [],
      makeBalance(9400),
      "USDT",
      new Date("2024-01-01T15:00:00Z").getTime()
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Daily loss");
  });

  it("rejects when insufficient balance", () => {
    const result = riskManager.checkOrder(
      500,
      10000,
      [],
      makeBalance(200), // Only 200 free
      "USDT"
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Insufficient balance");
  });

  it("tracks drawdown correctly", () => {
    riskManager.updatePeakEquity(12000);
    expect(riskManager.getCurrentDrawdown(10000)).toBeCloseTo(16.67, 1);
  });
});
