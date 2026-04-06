import type { Candle } from "@tb/types";
import { describe, it, expect } from "vitest";

import { CandleValidator } from "../validation/CandleValidator";

describe("CandleValidator", () => {
  const validator = new CandleValidator();

  const validCandle: Candle = {
    time: new Date("2024-01-01T00:00:00Z").getTime(),
    open: 42000,
    high: 42500,
    low: 41800,
    close: 42300,
    volume: 500,
  };

  it("accepts a valid candle", () => {
    const result = validator.validate(validCandle);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects candle where high < low", () => {
    const candle: Candle = { ...validCandle, high: 41000, low: 42000 };
    const result = validator.validate(candle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "high_gte_low")).toBe(true);
  });

  it("rejects candle where open is outside [low, high]", () => {
    const candle: Candle = { ...validCandle, open: 50000 };
    const result = validator.validate(candle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "open_in_range")).toBe(true);
  });

  it("rejects candle where close is outside [low, high]", () => {
    const candle: Candle = { ...validCandle, close: 30000 };
    const result = validator.validate(candle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "close_in_range")).toBe(true);
  });

  it("rejects candle with negative volume", () => {
    const candle: Candle = { ...validCandle, volume: -100 };
    const result = validator.validate(candle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "volume_non_negative")).toBe(true);
  });

  it("rejects candle with invalid timestamp", () => {
    const candle: Candle = { ...validCandle, time: NaN };
    const result = validator.validate(candle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "valid_timestamp")).toBe(true);
  });

  it("rejects candle with future timestamp", () => {
    const candle: Candle = { ...validCandle, time: Date.now() + 365 * 24 * 60 * 60 * 1000 };
    const result = validator.validate(candle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "timestamp_not_future")).toBe(true);
  });

  it("warns on all-same OHLC values", () => {
    const candle: Candle = {
      ...validCandle,
      open: 42000,
      high: 42000,
      low: 42000,
      close: 42000,
    };
    const result = validator.validate(candle);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.rule === "all_same_values")).toBe(true);
  });

  it("warns on extreme price change > 20%", () => {
    const candle: Candle = {
      ...validCandle,
      low: 40000,
      high: 50000,
      open: 40500,
      close: 49000,
    };
    const result = validator.validate(candle);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.rule === "extreme_price_change")).toBe(true);
  });

  it("warns on zero volume", () => {
    const candle: Candle = { ...validCandle, volume: 0 };
    const result = validator.validate(candle);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.rule === "zero_volume")).toBe(true);
  });

  describe("validateBatch", () => {
    it("separates valid and invalid candles", () => {
      const candles: Candle[] = [
        validCandle,
        { ...validCandle, time: validCandle.time + 3600000, high: 39000, low: 42000 }, // invalid
        { ...validCandle, time: validCandle.time + 7200000 }, // valid
      ];
      const result = validator.validateBatch(candles);
      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(1);
    });
  });
});
