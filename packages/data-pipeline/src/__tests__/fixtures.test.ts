import { describe, it, expect } from "vitest";

import { CandleValidator } from "../validation/CandleValidator";

import {
  generateRealisticCandles,
  generateCandlesWithGaps,
  generateCandlesWithInvalid,
  generateCandlesWithDuplicates,
} from "./fixtures";

describe("Test Fixtures", () => {
  const validator = new CandleValidator();

  it("generates 1000 realistic candles", () => {
    const candles = generateRealisticCandles(1000);
    expect(candles).toHaveLength(1000);

    // All should be valid
    for (const candle of candles) {
      const result = validator.validate(candle);
      expect(result.valid).toBe(true);
    }

    // Timestamps should be sequential (1h apart)
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i]!.time - candles[i - 1]!.time).toBe(3_600_000);
    }
  });

  it("generates candles with gaps", () => {
    const candles = generateCandlesWithGaps(20, [3, 7, 10]);
    expect(candles).toHaveLength(20); // 20 out of 23 expected

    // There should be time jumps where gaps are
    let hasGap = false;
    for (let i = 1; i < candles.length; i++) {
      const diff = candles[i]!.time - candles[i - 1]!.time;
      if (diff > 3_600_000) {
        hasGap = true;
        break;
      }
    }
    expect(hasGap).toBe(true);
  });

  it("generates candles with invalid ones", () => {
    const candles = generateCandlesWithInvalid();
    expect(candles.length).toBeGreaterThan(10);

    const { valid, invalid } = validator.validateBatch(candles);
    expect(invalid.length).toBeGreaterThan(0);
    expect(valid.length).toBeGreaterThan(0);
  });

  it("generates candles with duplicates", () => {
    const candles = generateCandlesWithDuplicates();
    expect(candles).toHaveLength(13); // 10 + 3 duplicates

    // Check that some timestamps are repeated
    const timestamps = candles.map((c) => c.time);
    const uniqueTimestamps = new Set(timestamps);
    expect(uniqueTimestamps.size).toBeLessThan(timestamps.length);
  });
});
