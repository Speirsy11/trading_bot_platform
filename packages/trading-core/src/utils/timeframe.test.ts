import { describe, it, expect } from "vitest";

import { timeframeToMs, msToTimeframe, candlesInRange } from "../utils/timeframe";

describe("timeframe utils", () => {
  describe("timeframeToMs", () => {
    it("converts standard timeframes", () => {
      expect(timeframeToMs("1m")).toBe(60_000);
      expect(timeframeToMs("5m")).toBe(300_000);
      expect(timeframeToMs("15m")).toBe(900_000);
      expect(timeframeToMs("1h")).toBe(3_600_000);
      expect(timeframeToMs("4h")).toBe(14_400_000);
      expect(timeframeToMs("1d")).toBe(86_400_000);
    });

    it("throws for unknown timeframe", () => {
      expect(() => timeframeToMs("invalid")).toThrow();
    });
  });

  describe("msToTimeframe", () => {
    it("converts ms to timeframe", () => {
      expect(msToTimeframe(60_000)).toBe("1m");
      expect(msToTimeframe(3_600_000)).toBe("1h");
      expect(msToTimeframe(86_400_000)).toBe("1d");
    });
  });

  describe("candlesInRange", () => {
    it("calculates number of candles", () => {
      // 1 hour range with 1m candles = 60 candles
      expect(candlesInRange(0, 3_600_000, "1m")).toBe(60);
    });
  });
});
