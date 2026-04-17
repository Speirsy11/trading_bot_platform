import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BalanceDropDetector, getBalanceDropThreshold } from "./balanceDropDetector";

// ---------------------------------------------------------------------------
// getBalanceDropThreshold
// ---------------------------------------------------------------------------

describe("getBalanceDropThreshold", () => {
  beforeEach(() => {
    delete process.env["BALANCE_DROP_THRESHOLD_PCT"];
  });
  afterEach(() => {
    delete process.env["BALANCE_DROP_THRESHOLD_PCT"];
  });

  it("returns the per-bot riskConfig value when set", () => {
    expect(getBalanceDropThreshold({ balanceDropThresholdPct: 10 })).toBe(10);
  });

  it("falls back to the env var when riskConfig has no value", () => {
    process.env["BALANCE_DROP_THRESHOLD_PCT"] = "30";
    expect(getBalanceDropThreshold({})).toBe(30);
  });

  it("falls back to the env var when riskConfig is undefined", () => {
    process.env["BALANCE_DROP_THRESHOLD_PCT"] = "15";
    expect(getBalanceDropThreshold(undefined)).toBe(15);
  });

  it("returns the default 20 when neither riskConfig nor env var is set", () => {
    expect(getBalanceDropThreshold({})).toBe(20);
  });

  it("returns the default 20 when riskConfig is undefined and env var is absent", () => {
    expect(getBalanceDropThreshold(undefined)).toBe(20);
  });

  it("ignores a non-positive riskConfig value and falls back to env var", () => {
    process.env["BALANCE_DROP_THRESHOLD_PCT"] = "25";
    expect(getBalanceDropThreshold({ balanceDropThresholdPct: 0 })).toBe(25);
  });

  it("ignores a negative riskConfig value and falls back to default", () => {
    expect(getBalanceDropThreshold({ balanceDropThresholdPct: -5 })).toBe(20);
  });

  it("ignores a riskConfig value of exactly 100 (boundary)", () => {
    process.env["BALANCE_DROP_THRESHOLD_PCT"] = "50";
    expect(getBalanceDropThreshold({ balanceDropThresholdPct: 100 })).toBe(50);
  });

  it("ignores an invalid env var and returns the default", () => {
    process.env["BALANCE_DROP_THRESHOLD_PCT"] = "not-a-number";
    expect(getBalanceDropThreshold({})).toBe(20);
  });

  it("ignores a zero env var and returns the default", () => {
    process.env["BALANCE_DROP_THRESHOLD_PCT"] = "0";
    expect(getBalanceDropThreshold({})).toBe(20);
  });

  it("prefers riskConfig over env var", () => {
    process.env["BALANCE_DROP_THRESHOLD_PCT"] = "40";
    expect(getBalanceDropThreshold({ balanceDropThresholdPct: 5 })).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// BalanceDropDetector — dropPercent
// ---------------------------------------------------------------------------

describe("BalanceDropDetector.dropPercent", () => {
  it("returns 0 when the balance has not changed", () => {
    const d = new BalanceDropDetector(10_000, 20);
    expect(d.dropPercent(10_000)).toBe(0);
  });

  it("returns the correct percentage for a partial drop", () => {
    const d = new BalanceDropDetector(10_000, 20);
    // $1,000 drop from $10,000 = 10 %
    expect(d.dropPercent(9_000)).toBeCloseTo(10);
  });

  it("returns 20 % for a $2,000 drop from $10,000", () => {
    const d = new BalanceDropDetector(10_000, 20);
    expect(d.dropPercent(8_000)).toBeCloseTo(20);
  });

  it("returns 100 when balance reaches zero", () => {
    const d = new BalanceDropDetector(10_000, 20);
    expect(d.dropPercent(0)).toBeCloseTo(100);
  });

  it("returns a negative value (gain) when balance increases", () => {
    const d = new BalanceDropDetector(10_000, 20);
    expect(d.dropPercent(12_000)).toBeCloseTo(-20);
  });

  it("returns 0 when starting balance is 0 (avoids division by zero)", () => {
    const d = new BalanceDropDetector(0, 20);
    expect(d.dropPercent(0)).toBe(0);
    expect(d.dropPercent(5_000)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// BalanceDropDetector — check
// ---------------------------------------------------------------------------

describe("BalanceDropDetector.check", () => {
  it("returns false when the drop is below the threshold", () => {
    const d = new BalanceDropDetector(10_000, 20);
    // 15 % drop — below 20 % threshold
    expect(d.check(8_500)).toBe(false);
  });

  it("returns true when the drop exactly equals the threshold", () => {
    const d = new BalanceDropDetector(10_000, 20);
    // 20 % drop — exactly at threshold
    expect(d.check(8_000)).toBe(true);
  });

  it("returns true when the drop exceeds the threshold", () => {
    const d = new BalanceDropDetector(10_000, 20);
    // 25 % drop
    expect(d.check(7_500)).toBe(true);
  });

  it("returns false when the balance is unchanged", () => {
    const d = new BalanceDropDetector(10_000, 20);
    expect(d.check(10_000)).toBe(false);
  });

  it("returns false when the balance has increased (gain)", () => {
    const d = new BalanceDropDetector(10_000, 20);
    expect(d.check(12_000)).toBe(false);
  });

  it("returns true when balance drops to zero (100 % loss)", () => {
    const d = new BalanceDropDetector(10_000, 20);
    expect(d.check(0)).toBe(true);
  });

  it("respects a custom threshold of 5 %", () => {
    const d = new BalanceDropDetector(10_000, 5);
    expect(d.check(9_600)).toBe(false); // 4 % drop
    expect(d.check(9_500)).toBe(true); // 5 % drop exactly
    expect(d.check(9_000)).toBe(true); // 10 % drop
  });

  it("respects a custom threshold of 50 %", () => {
    const d = new BalanceDropDetector(10_000, 50);
    expect(d.check(5_001)).toBe(false); // just under 50 %
    expect(d.check(5_000)).toBe(true); // exactly 50 %
    expect(d.check(4_999)).toBe(true); // just over 50 %
  });

  it("returns false when starting balance is 0 (no drop possible)", () => {
    const d = new BalanceDropDetector(0, 20);
    expect(d.check(0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BalanceDropDetector — constructor guards
// ---------------------------------------------------------------------------

describe("BalanceDropDetector constructor", () => {
  it("throws when starting balance is negative", () => {
    expect(() => new BalanceDropDetector(-1, 20)).toThrow("Starting balance must be non-negative");
  });

  it("throws when threshold is 0", () => {
    expect(() => new BalanceDropDetector(10_000, 0)).toThrow();
  });

  it("throws when threshold is 100", () => {
    expect(() => new BalanceDropDetector(10_000, 100)).toThrow();
  });

  it("throws when threshold is negative", () => {
    expect(() => new BalanceDropDetector(10_000, -5)).toThrow();
  });

  it("does not throw for a valid starting balance of 0", () => {
    expect(() => new BalanceDropDetector(0, 20)).not.toThrow();
  });
});
