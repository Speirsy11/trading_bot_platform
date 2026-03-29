import { describe, it, expect } from "vitest";

import { GapDetector } from "../validation/GapDetector.js";

describe("GapDetector (unit)", () => {
  it("returns correct timeframe in ms", () => {
    // GapDetector uses TIMEFRAME_MS internally; test via public method
    const detector = new GapDetector(null as never);
    expect(detector.getTimeframeMs("1m")).toBe(60_000);
    expect(detector.getTimeframeMs("5m")).toBe(300_000);
    expect(detector.getTimeframeMs("15m")).toBe(900_000);
    expect(detector.getTimeframeMs("1h")).toBe(3_600_000);
    expect(detector.getTimeframeMs("4h")).toBe(14_400_000);
    expect(detector.getTimeframeMs("1d")).toBe(86_400_000);
  });
});
