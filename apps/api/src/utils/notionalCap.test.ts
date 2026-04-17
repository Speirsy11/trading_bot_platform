import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { checkNotionalCap, getMaxNotionalUSD } from "./notionalCap";

describe("getMaxNotionalUSD", () => {
  const original = process.env.MAX_NOTIONAL_USD;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.MAX_NOTIONAL_USD;
    } else {
      process.env.MAX_NOTIONAL_USD = original;
    }
  });

  it("returns 10000 when env var is unset", () => {
    delete process.env.MAX_NOTIONAL_USD;
    expect(getMaxNotionalUSD()).toBe(10_000);
  });

  it("returns 10000 when env var is an empty string", () => {
    process.env.MAX_NOTIONAL_USD = "";
    expect(getMaxNotionalUSD()).toBe(10_000);
  });

  it("returns 10000 when env var is zero", () => {
    process.env.MAX_NOTIONAL_USD = "0";
    expect(getMaxNotionalUSD()).toBe(10_000);
  });

  it("returns 10000 when env var is negative", () => {
    process.env.MAX_NOTIONAL_USD = "-500";
    expect(getMaxNotionalUSD()).toBe(10_000);
  });

  it("returns the parsed value when env var is a valid positive number", () => {
    process.env.MAX_NOTIONAL_USD = "50000";
    expect(getMaxNotionalUSD()).toBe(50_000);
  });
});

describe("checkNotionalCap", () => {
  const original = process.env.MAX_NOTIONAL_USD;

  beforeEach(() => {
    // Use the default $10k cap for most tests
    delete process.env.MAX_NOTIONAL_USD;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.MAX_NOTIONAL_USD;
    } else {
      process.env.MAX_NOTIONAL_USD = original;
    }
  });

  it("throws when limit order notional exceeds cap", () => {
    // 2 BTC at $6000 = $12,000 > $10,000 cap
    expect(() => checkNotionalCap(2, 6_000, "limit")).toThrow(
      "Order notional $12000.00 exceeds MAX_NOTIONAL_USD cap $10000"
    );
  });

  it("throws when notional is exactly one cent above the cap", () => {
    // 1 unit at $10000.01 = $10000.01 > $10000
    expect(() => checkNotionalCap(1, 10_000.01, "limit")).toThrow("exceeds MAX_NOTIONAL_USD cap");
  });

  it("does not throw when limit order notional equals the cap", () => {
    // 1 BTC at $10,000 = exactly $10,000 cap
    expect(() => checkNotionalCap(1, 10_000, "limit")).not.toThrow();
  });

  it("does not throw when limit order notional is below the cap", () => {
    // 0.5 BTC at $5000 = $2,500 < $10,000 cap
    expect(() => checkNotionalCap(0.5, 5_000, "limit")).not.toThrow();
  });

  it("does not throw for market orders even with a large amount", () => {
    // Market orders can't be checked without a confirmed price
    expect(() => checkNotionalCap(1000, undefined, "market")).not.toThrow();
  });

  it("does not throw for market orders when price is provided but type is market", () => {
    // The check only applies to 'limit' type
    expect(() => checkNotionalCap(1000, 50_000, "market")).not.toThrow();
  });

  it("does not throw for limit orders when price is undefined", () => {
    // Shouldn't happen in practice but guard just in case
    expect(() => checkNotionalCap(1000, undefined, "limit")).not.toThrow();
  });

  it("respects a custom cap set via MAX_NOTIONAL_USD", () => {
    process.env.MAX_NOTIONAL_USD = "500";
    // 1 unit at $600 = $600 > $500 cap
    expect(() => checkNotionalCap(1, 600, "limit")).toThrow("exceeds MAX_NOTIONAL_USD cap $500");
    // 1 unit at $500 = $500 exactly = allowed
    expect(() => checkNotionalCap(1, 500, "limit")).not.toThrow();
  });
});
